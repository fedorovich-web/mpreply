from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.adapters.registry import get_marketplace_adapter
from app.adapters.yandex_market import YandexMarketAdapter, YandexQuestionReplyState
from app.automation.state_machine import ensure_message_transition, ensure_reply_transition
from app.core.config import get_settings
from app.core.errors import bad_request, conflict, not_found
from app.core.security import CredentialService
from app.models.ai_draft import AIDraft
from app.models.automation_rule import AutomationRule
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus, ResponseMode
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput
from app.services.answer_entitlement_service import AnswerEntitlementService
from app.services.audit_service import AuditService
from app.services.automation_rule_service import AutomationRuleService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.quota_service import QuotaDecision, QuotaService

_WRITE_ROLES = {"owner", "admin", "manager"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_RETRYABLE_ERRORS = frozenset({"network_timeout", "network_error", "rate_limited", "marketplace_unavailable"})
_BLOCKING_MARKETPLACE_ERRORS = frozenset({"invalid_credentials", "insufficient_scope"})
_YANDEX_QUESTION_STATES = frozenset(
    {"ABSENT", "PUBLISHED", "UNMODERATED", "BANNED", "DELETED", "UNKNOWN"}
)
_YANDEX_AMBIGUOUS_SEND_ERRORS = frozenset({"network_timeout", "network_error"})
_OUTBOUND_SEND_AMBIGUOUS_ERRORS = frozenset({"network_timeout", "network_error"})
_YANDEX_QUESTION_BLOCK_MESSAGES = {
    "yandex_question_reply_unmoderated": "Yandex Market question answer is pending moderation",
    "yandex_question_reply_banned": "Yandex Market question answer is banned",
    "yandex_question_reply_deleted": "Yandex Market question answer is deleted and requires manual review",
    "yandex_question_reconciliation_unknown": "Yandex Market question reply state could not be confirmed",
    "yandex_question_send_ambiguous": "Yandex Market question send outcome is ambiguous; automatic resend is blocked",
}


def _object_mapping(value: object | None) -> dict[str, object] | None:
    if not isinstance(value, dict):
        return None
    return cast(dict[str, object], value)


@dataclass(frozen=True)
class QueueAutoReplyResult:
    queued: bool
    duplicate: bool
    reply: Reply | None
    reason: str | None
    matched_rule_id: UUID | None
    quota_reason: str | None


@dataclass(frozen=True)
class ExecuteReplyResult:
    reply_id: UUID
    status: str
    retryable: bool
    error_code: str | None = None
    externally_already_answered: bool = False
    retry_at: datetime | None = None


@dataclass(frozen=True)
class PreflightAnswerStatus:
    answered: bool | None
    failure: AdapterResult | None = None


@dataclass(frozen=True)
class YandexQuestionWriteAuthorization:
    state: YandexQuestionReplyState
    allowed: bool
    externally_already_answered: bool = False
    error_code: str | None = None
    answer_id: str | None = None


class ReplyExecutionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.entitlements = AnswerEntitlementService(session)
        self.message_service = MessageService(session)
        self.organization_service = OrganizationService(session)
        self.automation_service = AutomationRuleService(session)
        self.quota = QuotaService(session)
        self.safety_gate = SafetyGate()
        settings = get_settings()
        self.credentials = CredentialService(settings.credentials_encryption_key.get_secret_value())

    async def queue_auto_reply(
        self,
        *,
        actor: User,
        message_id: UUID,
        ai_draft_id: UUID | None = None,
    ) -> QueueAutoReplyResult:
        message, product = await self.message_service.get_message(actor=actor, message_id=message_id)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )
        draft = await self._get_draft(message=message, ai_draft_id=ai_draft_id)
        confidence = draft.confidence_score if draft.confidence_score is not None else 0.0
        safety = self.safety_gate.evaluate(
            SafetyInput(
                draft_text=draft.draft_text,
                confidence_score=confidence,
                message_type=message.type,
                rating=message.rating,
                has_product_context=product is not None,
                model_flags=draft.safety_flags_json or [],
            )
        )
        automation = await self.automation_service.evaluate_message(
            actor=actor,
            message_id=message.id,
            confidence_score=confidence,
        )

        if safety.decision is SafetyDecision.BLOCK:
            self._transition_message(message, MessageStatus.SAFETY_BLOCKED.value)
            await self._write_queue_audit(
                actor=actor,
                message=message,
                action="auto_reply.blocked_by_safety",
                metadata={"safety_flags": safety.flags, "safety_reasons": safety.reasons},
            )
            return QueueAutoReplyResult(False, False, None, "safety_blocked", automation.matched_rule_id, None)

        if safety.decision is SafetyDecision.MANUAL_REVIEW or automation.requires_manual_review:
            target = MessageStatus.NEEDS_MANUAL_CHECK.value
            self._transition_message(message, target)
            await self._write_queue_audit(
                actor=actor,
                message=message,
                action="auto_reply.manual_review_required",
                metadata={
                    "safety_decision": safety.decision.value,
                    "safety_flags": safety.flags,
                    "automation_reasons": automation.reasons,
                },
            )
            return QueueAutoReplyResult(False, False, None, "manual_review_required", automation.matched_rule_id, None)

        if automation.mode != ResponseMode.AUTO.value:
            self._transition_message(message, MessageStatus.WAITING_REVIEW.value)
            await self._write_queue_audit(
                actor=actor,
                message=message,
                action="auto_reply.semi_auto_selected",
                metadata={"automation_reasons": automation.reasons},
            )
            return QueueAutoReplyResult(False, False, None, "semi_auto_mode", automation.matched_rule_id, None)

        rule = await self._get_rule(automation.matched_rule_id)
        quota = await self._check_quota(message=message, rule=rule)
        if not quota.allowed:
            self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
            await self._write_queue_audit(
                actor=actor,
                message=message,
                action="auto_reply.quota_blocked",
                metadata=self._quota_metadata(quota),
            )
            return QueueAutoReplyResult(False, False, None, "quota_blocked", automation.matched_rule_id, quota.reason)

        idempotency_key = self.build_idempotency_key(message)
        existing = await self._get_reply_by_idempotency_key(idempotency_key)
        if existing is not None:
            await self._write_queue_audit(
                actor=actor,
                message=message,
                action="auto_reply.duplicate_suppressed",
                metadata={"reply_id": str(existing.id), "idempotency_key": idempotency_key},
            )
            return QueueAutoReplyResult(True, True, existing, "duplicate_suppressed", existing.automation_rule_id, None)

        settings = get_settings()
        reply = Reply(
            organization_id=message.organization_id,
            message_id=message.id,
            ai_draft_id=draft.id,
            automation_rule_id=automation.matched_rule_id,
            reply_text=draft.draft_text,
            status=ReplyStatus.QUEUED.value,
            mode=ResponseMode.AUTO.value,
            idempotency_key=idempotency_key,
            attempt_count=0,
            max_attempts=settings.auto_reply_max_attempts,
            created_by=actor.id,
            metadata_json={
                "safety_flags": safety.flags,
                "automation_reasons": automation.reasons,
                "prompt_version": draft.prompt_version,
                "model": draft.model,
            },
        )
        self.session.add(reply)
        await self.session.flush()
        self._transition_message(message, MessageStatus.AUTO_REPLY_PENDING.value)
        await self._write_queue_audit(
            actor=actor,
            message=message,
            action="auto_reply.queued",
            metadata={
                "reply_id": str(reply.id),
                "automation_rule_id": str(reply.automation_rule_id) if reply.automation_rule_id else None,
                "idempotency_key": idempotency_key,
            },
        )
        return QueueAutoReplyResult(True, False, reply, None, automation.matched_rule_id, None)

    async def get_reply(self, *, actor: User, reply_id: UUID) -> Reply:
        reply = await self._get_reply(reply_id)
        await self.organization_service.require_membership_role(
            organization_id=reply.organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        return reply

    async def list_replies(
        self,
        *,
        actor: User,
        organization_id: UUID,
        status: str | None = None,
    ) -> tuple[list[Reply], int]:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        stmt = select(Reply).where(Reply.organization_id == organization_id)
        count_stmt = select(func.count(Reply.id)).where(Reply.organization_id == organization_id)
        if status is not None:
            stmt = stmt.where(Reply.status == status)
            count_stmt = count_stmt.where(Reply.status == status)
        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())
        result = await self.session.execute(stmt.order_by(Reply.created_at.desc()).limit(200))
        return list(result.scalars().all()), total

    async def prepare_retry(self, *, actor: User, reply_id: UUID) -> Reply:
        reply = await self.get_reply(actor=actor, reply_id=reply_id)
        await self.organization_service.require_membership_role(
            organization_id=reply.organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )
        if reply.status not in {ReplyStatus.FAILED.value, ReplyStatus.RETRY_PENDING.value}:
            raise conflict("Only failed or retry-pending replies can be retried")
        if reply.attempt_count >= reply.max_attempts:
            raise conflict("Reply retry limit is exhausted")
        self._transition_reply(reply, ReplyStatus.QUEUED.value)
        reply.worker_message_id = None
        reply.next_retry_at = None
        reply.error_code = None
        reply.failed_reason = None
        message = await self._get_message(reply.message_id)
        retry_message_target = (
            MessageStatus.AUTO_REPLY_PENDING.value
            if reply.mode == ResponseMode.AUTO.value
            else MessageStatus.APPROVED.value
        )
        self._transition_message(message, retry_message_target)
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.retry_queued",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"attempt_count": reply.attempt_count, "max_attempts": reply.max_attempts},
        )
        return reply

    async def execute_reply(self, *, reply_id: UUID) -> ExecuteReplyResult:
        reply = await self._get_reply_for_update(reply_id)
        if reply.status == ReplyStatus.SENT.value:
            return ExecuteReplyResult(reply.id, reply.status, False)
        now = datetime.now(UTC)
        if (
            reply.status == ReplyStatus.RETRY_PENDING.value
            and reply.next_retry_at is not None
            and reply.next_retry_at > now
        ):
            return ExecuteReplyResult(
                reply.id,
                reply.status,
                True,
                "retry_not_due",
                retry_at=reply.next_retry_at,
            )
        settings = get_settings()
        if (
            reply.status == ReplyStatus.SENDING.value
            and reply.last_attempt_at is not None
            and reply.last_attempt_at >= datetime.now(UTC) - timedelta(seconds=settings.auto_reply_execution_lease_seconds)
        ):
            return ExecuteReplyResult(reply.id, reply.status, False, "execution_in_progress")
        if reply.attempt_count >= reply.max_attempts:
            await self._mark_final_failure(reply, "retry_limit_exhausted", "Retry limit exhausted")
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        if reply.status not in {
            ReplyStatus.QUEUED.value,
            ReplyStatus.RETRY_PENDING.value,
            ReplyStatus.FAILED.value,
            ReplyStatus.SENDING.value,
        }:
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)

        message = await self._get_message(reply.message_id)
        account = await self._get_account(message.marketplace_account_id)
        if not self._ozon_message_scope_is_allowed(account=account, message=message):
            await self._mark_ozon_scope_blocked(reply=reply, message=message)
            return ExecuteReplyResult(reply.id, reply.status, False, "insufficient_scope")
        if reply.mode == ResponseMode.AUTO.value:
            rule = await self._get_rule(reply.automation_rule_id)
            quota = await self._check_quota(message=message, rule=rule)
            if not quota.allowed:
                await self._mark_quota_blocked(reply=reply, message=message, quota=quota)
                return ExecuteReplyResult(reply.id, reply.status, False, quota.reason)

        billing_actor_user_id = reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by
        reservation = await self.entitlements.reserve_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            actor_user_id=billing_actor_user_id,
        )
        if not reservation.allowed:
            reason = reservation.reason or "answer_balance_unavailable"
            await self._mark_entitlement_blocked(reply=reply, message=message, reason=reason)
            return ExecuteReplyResult(reply.id, reply.status, False, reason)

        self._transition_reply(reply, ReplyStatus.SENDING.value)
        self._transition_message(message, MessageStatus.SENDING.value)
        reply.attempt_count += 1
        reply.last_attempt_at = datetime.now(UTC)
        reply.next_retry_at = None
        reply.error_code = None
        reply.failed_reason = None
        await self.session.commit()

        credential = self.credentials.decrypt(account.credentials_encrypted)
        adapter = self._adapter_for(account)
        is_yandex_question = (
            account.marketplace == Marketplace.YANDEX_MARKET.value
            and message.type == MessageType.QUESTION.value
        )
        if is_yandex_question:
            authorization = await self._authorize_yandex_question_write(
                adapter=cast(YandexMarketAdapter, adapter),
                credential=credential,
                seller_id=account.seller_id,
                message=message,
                reply=reply,
            )
            if authorization.externally_already_answered:
                reply = await self._get_reply_for_update(reply_id)
                message = await self._get_message(reply.message_id)
                await self.entitlements.release_for_reply(
                    organization_id=reply.organization_id,
                    reply_id=reply.id,
                    reason="externally_already_answered",
                    actor_user_id=billing_actor_user_id,
                )
                await self._mark_sent(
                    reply=reply,
                    message=message,
                    marketplace_reply_id=authorization.answer_id,
                    externally_already_answered=True,
                )
                return ExecuteReplyResult(
                    reply.id,
                    reply.status,
                    False,
                    externally_already_answered=True,
                )
            if not authorization.allowed:
                reply = await self._get_reply_for_update(reply_id)
                message = await self._get_message(reply.message_id)
                await self._mark_yandex_question_write_blocked(
                    reply=reply,
                    message=message,
                    authorization=authorization,
                    billing_actor_user_id=billing_actor_user_id,
                )
                return ExecuteReplyResult(
                    reply.id,
                    reply.status,
                    False,
                    authorization.error_code,
                )
        else:
            preflight = await self._preflight_answer_state(
                adapter=adapter,
                credential=credential,
                seller_id=account.seller_id,
                message=message,
            )
            if preflight.answered is True:
                reply = await self._get_reply_for_update(reply_id)
                message = await self._get_message(reply.message_id)
                await self.entitlements.release_for_reply(
                    organization_id=reply.organization_id,
                    reply_id=reply.id,
                    reason="externally_already_answered",
                    actor_user_id=billing_actor_user_id,
                )
                await self._mark_sent(
                    reply=reply,
                    message=message,
                    marketplace_reply_id=None,
                    externally_already_answered=True,
                )
                return ExecuteReplyResult(
                    reply.id,
                    reply.status,
                    False,
                    externally_already_answered=True,
                )
            if preflight.failure is not None:
                reply = await self._get_reply_for_update(reply_id)
                message = await self._get_message(reply.message_id)
                preflight_error = preflight.failure
                error_code = preflight_error.error_code or "marketplace_error"
                retryable = error_code in _RETRYABLE_ERRORS and reply.attempt_count < reply.max_attempts
                if retryable:
                    await self._mark_retry_pending(
                        reply=reply,
                        message=message,
                        result=preflight_error,
                    )
                else:
                    await self._mark_terminal_marketplace_failure(
                        reply=reply,
                        message=message,
                        result=preflight_error,
                    )
                return ExecuteReplyResult(
                    reply.id,
                    reply.status,
                    retryable,
                    error_code,
                    retry_at=reply.next_retry_at if retryable else None,
                )

        result = await self._send_through_adapter(
            adapter=adapter,
            credential=credential,
            seller_id=account.seller_id,
            message=message,
            reply=reply,
        )
        reply = await self._get_reply_for_update(reply_id)
        message = await self._get_message(reply.message_id)
        if result.ok:
            await self.entitlements.settle_for_reply(
                organization_id=reply.organization_id,
                reply_id=reply.id,
                actor_user_id=billing_actor_user_id,
            )
            await self._mark_sent(
                reply=reply,
                message=message,
                marketplace_reply_id=self._extract_marketplace_reply_id(result.data),
                externally_already_answered=False,
            )
            return ExecuteReplyResult(reply.id, reply.status, False)

        error_code = result.error_code or "marketplace_error"
        if is_yandex_question and self._is_yandex_question_send_ambiguous_error(error_code):
            self._record_yandex_question_send_ambiguity(
                reply=reply,
                error_code=error_code,
                now=datetime.now(UTC),
            )
            authorization = YandexQuestionWriteAuthorization(
                state="UNKNOWN",
                allowed=False,
                error_code="yandex_question_send_ambiguous",
            )
            await self._mark_yandex_question_write_blocked(
                reply=reply,
                message=message,
                authorization=authorization,
                billing_actor_user_id=billing_actor_user_id,
            )
            return ExecuteReplyResult(
                reply.id,
                reply.status,
                False,
                authorization.error_code,
            )
        if not is_yandex_question and (
            self._is_outbound_send_ambiguous_error(error_code)
            or (
                account.marketplace == Marketplace.OZON.value
                and error_code == "malformed_payload"
            )
        ):
            self._record_outbound_send_ambiguity(
                reply=reply,
                marketplace=message.marketplace,
                error_code=error_code,
                now=datetime.now(UTC),
            )
            await self._mark_outbound_send_ambiguous(
                reply=reply,
                message=message,
                billing_actor_user_id=billing_actor_user_id,
            )
            return ExecuteReplyResult(
                reply.id,
                reply.status,
                False,
                "outbound_send_ambiguous",
            )
        retryable = error_code in _RETRYABLE_ERRORS and reply.attempt_count < reply.max_attempts
        if retryable:
            await self._mark_retry_pending(reply=reply, message=message, result=result)
        else:
            await self._mark_terminal_marketplace_failure(reply=reply, message=message, result=result)
        return ExecuteReplyResult(reply.id, reply.status, retryable, error_code)

    async def _get_draft(self, *, message: CustomerMessage, ai_draft_id: UUID | None) -> AIDraft:
        stmt = select(AIDraft).where(
            AIDraft.organization_id == message.organization_id,
            AIDraft.message_id == message.id,
        )
        stmt = (
            stmt.where(AIDraft.id == ai_draft_id)
            if ai_draft_id is not None
            else stmt.order_by(AIDraft.created_at.desc()).limit(1)
        )
        result = await self.session.execute(stmt)
        draft = result.scalar_one_or_none()
        if draft is None:
            raise not_found("AI draft not found for this message")
        if not draft.draft_text.strip():
            raise bad_request("AI draft is empty")
        return draft

    async def _get_reply(self, reply_id: UUID) -> Reply:
        result = await self.session.execute(select(Reply).where(Reply.id == reply_id))
        reply = result.scalar_one_or_none()
        if reply is None:
            raise not_found("Reply not found")
        return reply

    async def _get_reply_for_update(self, reply_id: UUID) -> Reply:
        result = await self.session.execute(select(Reply).where(Reply.id == reply_id).with_for_update())
        reply = result.scalar_one_or_none()
        if reply is None:
            raise not_found("Reply not found")
        return reply

    async def _get_reply_by_idempotency_key(self, idempotency_key: str) -> Reply | None:
        result = await self.session.execute(select(Reply).where(Reply.idempotency_key == idempotency_key))
        return result.scalar_one_or_none()

    async def _get_message(self, message_id: UUID) -> CustomerMessage:
        result = await self.session.execute(select(CustomerMessage).where(CustomerMessage.id == message_id))
        message = result.scalar_one_or_none()
        if message is None:
            raise not_found("Customer message not found")
        return message

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        result = await self.session.execute(select(MarketplaceAccount).where(MarketplaceAccount.id == account_id))
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        return account

    async def _get_rule(self, rule_id: UUID | None) -> AutomationRule | None:
        if rule_id is None:
            return None
        result = await self.session.execute(select(AutomationRule).where(AutomationRule.id == rule_id))
        return result.scalar_one_or_none()

    async def _check_quota(self, *, message: CustomerMessage, rule: AutomationRule | None) -> QuotaDecision:
        return await self.quota.check_auto_reply_quota(
            organization_id=message.organization_id,
            automation_rule_id=rule.id if rule is not None else None,
            hourly_limit=rule.hourly_limit if rule is not None else None,
            daily_limit=rule.daily_limit if rule is not None else None,
        )

    @staticmethod
    def build_idempotency_key(message: CustomerMessage) -> str:
        raw = ":".join(
            [
                str(message.organization_id),
                str(message.marketplace_account_id),
                message.marketplace,
                message.type,
                message.external_id,
                "initial_reply",
            ]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _adapter_for(account: MarketplaceAccount) -> MarketplaceAdapter:
        return get_marketplace_adapter(account.marketplace)

    async def _preflight_answer_status(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
    ) -> bool | None:
        return (
            await self._preflight_answer_state(
                adapter=adapter,
                credential=credential,
                seller_id=seller_id,
                message=message,
            )
        ).answered

    async def _preflight_answer_state(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
    ) -> PreflightAnswerStatus:
        result = await adapter.has_existing_reply(
            credential=credential,
            message_type=message.type,
            external_id=message.external_id,
            seller_id=seller_id,
            context=self._provider_message_context(message),
        )
        if not result.ok:
            return PreflightAnswerStatus(answered=None, failure=result)
        payload = result.data
        if not isinstance(payload, dict):
            return PreflightAnswerStatus(
                answered=None,
                failure=AdapterResult(
                    False,
                    error_code="marketplace_malformed_response",
                    error_message_safe="Marketplace preflight response is malformed",
                ),
            )
        result_data = cast(dict[str, object], payload)
        answered = result_data.get("answered")
        if isinstance(answered, bool):
            return PreflightAnswerStatus(answered=answered)
        return PreflightAnswerStatus(
            answered=None,
            failure=AdapterResult(
                False,
                error_code="marketplace_malformed_response",
                error_message_safe="Marketplace preflight response is malformed",
            ),
        )

    async def _authorize_yandex_question_write(
        self,
        *,
        adapter: YandexMarketAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
        reply: Reply,
    ) -> YandexQuestionWriteAuthorization:
        result = await adapter.reconcile_question_reply(
            credential,
            message.external_id,
            seller_id=seller_id,
        )
        data = _object_mapping(result.data)
        if not result.ok or data is None:
            return YandexQuestionWriteAuthorization(
                state="UNKNOWN",
                allowed=False,
                error_code="yandex_question_reconciliation_unknown",
            )
        raw_state = str(data.get("state") or "UNKNOWN").upper()
        state = cast(
            YandexQuestionReplyState,
            raw_state if raw_state in _YANDEX_QUESTION_STATES else "UNKNOWN",
        )
        answer_id_value = data.get("answer_id")
        answer_id = str(answer_id_value) if answer_id_value is not None else None
        if state == "PUBLISHED":
            return YandexQuestionWriteAuthorization(
                state=state,
                allowed=False,
                externally_already_answered=True,
                answer_id=answer_id,
            )
        if state == "ABSENT":
            if self._has_yandex_question_send_ambiguity(reply):
                return YandexQuestionWriteAuthorization(
                    state=state,
                    allowed=False,
                    error_code="yandex_question_send_ambiguous",
                )
            return YandexQuestionWriteAuthorization(state=state, allowed=True)
        error_codes = {
            "UNMODERATED": "yandex_question_reply_unmoderated",
            "BANNED": "yandex_question_reply_banned",
            "DELETED": "yandex_question_reply_deleted",
            "UNKNOWN": "yandex_question_reconciliation_unknown",
        }
        return YandexQuestionWriteAuthorization(
            state=state,
            allowed=False,
            error_code=error_codes[state],
            answer_id=answer_id,
        )

    @staticmethod
    def _has_yandex_question_send_ambiguity(reply: Reply) -> bool:
        marker = _object_mapping(reply.metadata_json.get("yandex_question_send_ambiguity"))
        return marker is not None and marker.get("active") is True

    @staticmethod
    def _is_yandex_question_send_ambiguous_error(error_code: str | None) -> bool:
        return error_code in _YANDEX_AMBIGUOUS_SEND_ERRORS

    @staticmethod
    def _is_outbound_send_ambiguous_error(error_code: str | None) -> bool:
        return error_code in _OUTBOUND_SEND_AMBIGUOUS_ERRORS

    @staticmethod
    def _record_yandex_question_send_ambiguity(
        *,
        reply: Reply,
        error_code: str,
        now: datetime,
    ) -> None:
        metadata = dict(reply.metadata_json or {})
        metadata["yandex_question_send_ambiguity"] = {
            "active": True,
            "reason": error_code,
            "recorded_at": now.isoformat(),
        }
        reply.metadata_json = metadata

    @staticmethod
    def _record_outbound_send_ambiguity(
        *,
        reply: Reply,
        marketplace: str,
        error_code: str,
        now: datetime,
    ) -> None:
        metadata = dict(reply.metadata_json or {})
        metadata["outbound_send_ambiguity"] = {
            "active": True,
            "marketplace": marketplace,
            "reason": error_code,
            "recorded_at": now.isoformat(),
        }
        reply.metadata_json = metadata

    @staticmethod
    def _provider_message_context(message: CustomerMessage) -> ProviderMessageContext:
        return dict(message.metadata_json or {})

    @staticmethod
    def _ozon_message_scope_is_allowed(
        *,
        account: MarketplaceAccount,
        message: CustomerMessage,
    ) -> bool:
        if account.marketplace != Marketplace.OZON.value:
            return True
        scopes_json = _object_mapping(cast(object, getattr(account, "scopes_json", {})))
        if scopes_json is None or scopes_json.get("validated") is not True:
            return False
        raw_scopes = scopes_json.get("scopes")
        if not isinstance(raw_scopes, list):
            return False
        scopes = {scope for scope in cast(list[object], raw_scopes) if isinstance(scope, str)}
        if message.type == MessageType.REVIEW.value:
            return {"fetch_reviews", "send_review_reply"}.issubset(scopes)
        if message.type == MessageType.QUESTION.value:
            return {"fetch_questions", "send_question_reply"}.issubset(scopes)
        return False

    async def _mark_ozon_scope_blocked(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.BLOCKED.value)
        self._transition_message(message, MessageStatus.BLOCKED_BY_MARKETPLACE.value)
        reply.error_code = "insufficient_scope"
        reply.failed_reason = "Ozon account scope does not permit this message stream"
        reply.next_retry_at = None
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="failed",
            error_code="insufficient_scope",
            error_message_safe=reply.failed_reason,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.failed",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata={"attempt_count": reply.attempt_count, "error_code": "insufficient_scope"},
        )
        await self.session.commit()

    async def _send_through_adapter(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
        reply: Reply,
    ) -> AdapterResult:
        if message.type == MessageType.REVIEW.value:
            return await adapter.send_review_reply(
                credential,
                message.external_id,
                reply.reply_text,
                seller_id=seller_id,
                context=self._provider_message_context(message),
            )
        if message.type == MessageType.QUESTION.value:
            return await adapter.send_question_reply(
                credential,
                message.external_id,
                reply.reply_text,
                seller_id=seller_id,
                context=self._provider_message_context(message),
            )
        return AdapterResult(
            False,
            error_code="unsupported_message_type",
            error_message_safe="Message type cannot be replied to through the marketplace adapter",
        )

    async def _mark_sent(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        marketplace_reply_id: str | None,
        externally_already_answered: bool,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.SENT.value)
        message_target = (
            MessageStatus.AUTO_REPLY_SENT.value
            if reply.mode == ResponseMode.AUTO.value
            else MessageStatus.ANSWERED.value
        )
        self._transition_message(message, message_target)
        reply.sent_at = datetime.now(UTC)
        reply.marketplace_reply_id = marketplace_reply_id
        reply.error_code = None
        reply.failed_reason = None
        reply.next_retry_at = None
        reply.metadata_json = {
            **(reply.metadata_json or {}),
            "externally_already_answered": externally_already_answered,
        }
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        usage_user_id = reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by
        self.session.add(
            UsageEvent(
                organization_id=reply.organization_id,
                user_id=usage_user_id,
                event_type=f"{action_prefix}.sent",
                quantity=1,
                metadata_json={
                    "reply_id": str(reply.id),
                    "message_id": str(message.id),
                    "marketplace": message.marketplace,
                    "attempt_count": reply.attempt_count,
                    "externally_already_answered": externally_already_answered,
                },
            )
        )
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="success",
            error_code=None,
            error_message_safe=None,
        )
        await self.audit.write(
            action=f"{action_prefix}.sent",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=usage_user_id,
            entity_id=str(reply.id),
            metadata={
                "message_id": str(message.id),
                "marketplace": message.marketplace,
                "attempt_count": reply.attempt_count,
                "externally_already_answered": externally_already_answered,
            },
        )
        await self.session.commit()

    async def _mark_yandex_question_write_blocked(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        authorization: YandexQuestionWriteAuthorization,
        billing_actor_user_id: UUID | None,
    ) -> None:
        error_code = authorization.error_code or "yandex_question_reconciliation_unknown"
        await self.entitlements.release_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            reason=error_code,
            actor_user_id=billing_actor_user_id,
        )
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.error_code = error_code
        reply.failed_reason = _YANDEX_QUESTION_BLOCK_MESSAGES.get(
            error_code,
            "Yandex Market question send requires manual review",
        )
        reply.next_retry_at = None
        reply.metadata_json = {
            **(reply.metadata_json or {}),
            "yandex_question_reconciliation": {
                "state": authorization.state,
                "answer_id": authorization.answer_id,
                "blocked": True,
                "checked_at": datetime.now(UTC).isoformat(),
            },
        }
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="blocked",
            error_code=error_code,
            error_message_safe=reply.failed_reason,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.yandex_question_write_blocked",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=billing_actor_user_id,
            entity_id=str(reply.id),
            metadata={
                "message_id": str(message.id),
                "state": authorization.state,
                "error_code": error_code,
                "ambiguity_active": self._has_yandex_question_send_ambiguity(reply),
            },
        )
        await self.session.commit()

    async def _mark_outbound_send_ambiguous(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        billing_actor_user_id: UUID | None,
    ) -> None:
        error_code = "outbound_send_ambiguous"
        await self.entitlements.release_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            reason=error_code,
            actor_user_id=billing_actor_user_id,
        )
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.error_code = error_code
        reply.failed_reason = "Marketplace reply send outcome is ambiguous; automatic resend is blocked"
        reply.next_retry_at = None
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="blocked",
            error_code=error_code,
            error_message_safe=reply.failed_reason,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.outbound_send_ambiguous",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=billing_actor_user_id,
            entity_id=str(reply.id),
            metadata={
                "message_id": str(message.id),
                "marketplace": message.marketplace,
                "error_code": error_code,
            },
        )
        await self.session.commit()

    async def _mark_retry_pending(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        result: AdapterResult,
    ) -> None:
        await self.entitlements.release_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            reason=result.error_code or "retry_pending",
            actor_user_id=reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by,
        )
        self._transition_reply(reply, ReplyStatus.RETRY_PENDING.value)
        message_target = (
            MessageStatus.AUTO_REPLY_PENDING.value
            if reply.mode == ResponseMode.AUTO.value
            else MessageStatus.APPROVED.value
        )
        self._transition_message(message, message_target)
        reply.error_code = result.error_code
        reply.failed_reason = result.error_message_safe
        provider_delay = result.retry_after_seconds
        delay_seconds = (
            min(max(provider_delay, 1), 3600)
            if provider_delay is not None
            else min(60, 2 ** max(reply.attempt_count - 1, 0))
        )
        reply.next_retry_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="retry_pending",
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.retry_pending",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata={
                "attempt_count": reply.attempt_count,
                "max_attempts": reply.max_attempts,
                "error_code": result.error_code,
            },
        )
        await self.session.commit()

    async def _mark_terminal_marketplace_failure(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        result: AdapterResult,
    ) -> None:
        await self.entitlements.release_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            reason=result.error_code or "marketplace_error",
            actor_user_id=reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by,
        )
        error_code = result.error_code or "marketplace_error"
        if error_code in _BLOCKING_MARKETPLACE_ERRORS:
            reply_target = ReplyStatus.BLOCKED.value
            message_target = MessageStatus.BLOCKED_BY_MARKETPLACE.value
        else:
            reply_target = ReplyStatus.FAILED.value
            message_target = MessageStatus.FAILED.value
        self._transition_reply(reply, reply_target)
        self._transition_message(message, message_target)
        reply.error_code = error_code
        reply.failed_reason = result.error_message_safe
        reply.next_retry_at = None
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="failed",
            error_code=error_code,
            error_message_safe=result.error_message_safe,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.failed",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata={"attempt_count": reply.attempt_count, "error_code": error_code},
        )
        await self.session.commit()

    async def _mark_final_failure(self, reply: Reply, error_code: str, reason: str) -> None:
        await self.entitlements.release_for_reply(
            organization_id=reply.organization_id,
            reply_id=reply.id,
            reason=error_code,
            actor_user_id=reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by,
        )
        message = await self._get_message(reply.message_id)
        if reply.status != ReplyStatus.FAILED.value:
            self._transition_reply(reply, ReplyStatus.FAILED.value)
        self._transition_message(message, MessageStatus.FAILED.value)
        reply.error_code = error_code
        reply.failed_reason = reason
        reply.next_retry_at = None
        await self.session.commit()

    async def _mark_entitlement_blocked(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        reason: str,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.error_code = reason
        reply.failed_reason = "Answer balance blocked this send before the marketplace request"
        reply.next_retry_at = None
        await self.audit.write(
            action="answer_balance.publish_blocked",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by if reply.mode == ResponseMode.AUTO.value else reply.sent_by,
            entity_id=str(reply.id),
            metadata={"reason": reason, "marketplace": message.marketplace},
        )
        await self.session.commit()

    async def _mark_quota_blocked(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        quota: QuotaDecision,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.error_code = quota.reason
        reply.failed_reason = "Runtime auto-reply quota blocked this send"
        reply.next_retry_at = None
        await self.audit.write(
            action="auto_reply.quota_blocked_at_execution",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata=self._quota_metadata(quota),
        )
        await self.session.commit()

    async def _write_integration_event(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        status: str,
        error_code: str | None,
        error_message_safe: str | None,
    ) -> None:
        self.session.add(
            IntegrationEvent(
                organization_id=reply.organization_id,
                marketplace_account_id=message.marketplace_account_id,
                marketplace=message.marketplace,
                event_type="reply.send",
                status=status,
                error_code=error_code,
                error_message_safe=error_message_safe,
                metadata_json={
                    "reply_id": str(reply.id),
                    "message_id": str(message.id),
                    "attempt_count": reply.attempt_count,
                },
            )
        )

    async def _write_queue_audit(
        self,
        *,
        actor: User,
        message: CustomerMessage,
        action: str,
        metadata: dict[str, object],
    ) -> None:
        await self.audit.write(
            action=action,
            entity_type="customer_message",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata=metadata,
        )

    @staticmethod
    def _quota_metadata(quota: QuotaDecision) -> dict[str, object]:
        return {
            "allowed": quota.allowed,
            "hourly_count": quota.hourly_count,
            "daily_count": quota.daily_count,
            "hourly_limit": quota.hourly_limit,
            "daily_limit": quota.daily_limit,
            "organization_daily_limit": quota.organization_daily_limit,
            "reason": quota.reason,
        }

    @staticmethod
    def _extract_marketplace_reply_id(payload: object | None) -> str | None:
        if not isinstance(payload, dict):
            return None
        mapping = cast(dict[str, object], payload)
        data = mapping.get("data")
        if isinstance(data, dict):
            data_mapping = cast(dict[str, object], data)
            value = (
                data_mapping.get("id")
                or data_mapping.get("replyId")
                or data_mapping.get("answerId")
                or data_mapping.get("marketplace_reply_id")
            )
            return str(value) if value is not None else None
        value = (
            mapping.get("id")
            or mapping.get("replyId")
            or mapping.get("answerId")
            or mapping.get("marketplace_reply_id")
        )
        return str(value) if value is not None else None

    @staticmethod
    def _transition_message(message: CustomerMessage, target: str) -> None:
        try:
            ensure_message_transition(message.status, target)
        except ValueError as exc:
            if target in {
                MessageStatus.NEEDS_MANUAL_CHECK.value,
                MessageStatus.SAFETY_BLOCKED.value,
                MessageStatus.BLOCKED_BY_MARKETPLACE.value,
                MessageStatus.FAILED.value,
            }:
                message.status = target
                return
            raise conflict(str(exc)) from exc
        message.status = target

    @staticmethod
    def _transition_reply(reply: Reply, target: str) -> None:
        try:
            ensure_reply_transition(reply.status, target)
        except ValueError as exc:
            raise conflict(str(exc)) from exc
        reply.status = target
