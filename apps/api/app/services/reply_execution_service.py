from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import (
    AdapterResult,
    ExistingReplyResult,
    ProviderMessageContext,
    ProviderWriteReceipt,
    ReviewQuestionAdapter,
)
from app.adapters.capabilities import MarketplaceStream, validated_scope_names, write_scope_for_message
from app.adapters.conversation import ConversationAdapter
from app.adapters.registry import MarketplaceAdapterRegistry, UnsupportedCapabilityError
from app.automation.state_machine import ensure_message_transition, ensure_reply_transition
from app.core.config import get_settings
from app.core.errors import bad_request, conflict, not_found
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.ai_draft import AIDraft
from app.models.automation_rule import AutomationRule
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus, ResponseMode
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput
from app.services.audit_service import AuditService
from app.services.automation_rule_service import AutomationRuleService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.quota_service import QuotaDecision, QuotaService

_WRITE_ROLES = {"owner", "admin", "manager"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_RETRYABLE_ERRORS = frozenset({"network_timeout", "network_error", "rate_limited", "marketplace_unavailable", "coordination_unavailable"})
_BLOCKING_MARKETPLACE_ERRORS = frozenset({"invalid_credentials", "insufficient_scope"})
_AMBIGUOUS_WRITE_ERRORS = frozenset({"malformed_payload", "marketplace_unavailable", "network_error", "network_timeout"})
_NON_PUBLISHABLE_PROVIDER_STATES = frozenset({"unmoderated", "banned", "deleted", "unknown", "moderation", "rejected", "not_public"})


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


class ReplyExecutionService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: MarketplaceAdapterRegistry | None = None,
        credentials: CredentialService | None = None,
    ) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.message_service = MessageService(session)
        self.organization_service = OrganizationService(session)
        self.automation_service = AutomationRuleService(session)
        self.quota = QuotaService(session)
        self.safety_gate = SafetyGate()
        self.registry = registry
        if credentials is None:
            settings = get_settings()
            credentials = CredentialService(settings.credentials_encryption_key.get_secret_value())
        self.credentials = credentials

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

        rule = await self._get_rule(
            automation.matched_rule_id,
            organization_id=message.organization_id,
        )
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
        existing = await self._get_reply_by_idempotency_key(
            idempotency_key,
            organization_id=message.organization_id,
        )
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
        result = await self.session.execute(
            select(Reply)
            .join(
                OrganizationUser,
                OrganizationUser.organization_id == Reply.organization_id,
            )
            .where(
                Reply.id == reply_id,
                OrganizationUser.user_id == actor.id,
                OrganizationUser.status == "active",
                OrganizationUser.role.in_(_READ_ROLES),
            )
        )
        reply = result.scalar_one_or_none()
        if reply is None:
            raise not_found("Reply not found")
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
        reply.next_retry_at = None
        reply.error_code = None
        reply.failed_reason = None
        reply.worker_message_id = None
        reply.last_dispatched_at = None
        message = await self._get_message(
            reply.message_id,
            organization_id=reply.organization_id,
        )
        retry_message_target = MessageStatus.AUTO_REPLY_PENDING.value if reply.mode == ResponseMode.AUTO.value else MessageStatus.APPROVED.value
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

    async def recover_throttled_replies(self, *, limit: int = 25) -> int:
        """Recover legacy exhausted 429s without publishing stale question drafts."""
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("reply recovery limit must be between 1 and 100")
        # Earlier releases left automatic recovery drafts outside the review
        # queue. Route only untouched drafts and preserve handled messages.
        legacy = (await self.session.execute(select(Reply, CustomerMessage).join(
            CustomerMessage, (CustomerMessage.id == Reply.message_id)
            & (CustomerMessage.organization_id == Reply.organization_id),
        ).where(Reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
                Reply.error_code == "legacy_draft_review_required", Reply.mode == ResponseMode.AUTO.value,
                Reply.revision == 1, CustomerMessage.status == MessageStatus.NEEDS_MANUAL_CHECK.value)
          .with_for_update(of=(Reply, CustomerMessage), skip_locked=True)
          .execution_options(populate_existing=True).limit(limit))).tuples().all()
        for old_reply, _ in legacy:
            old_reply.mode = ResponseMode.SEMI_AUTO.value
            await self.audit.write(action="reply.legacy_review_routed", entity_type="reply",
                                   entity_id=str(old_reply.id), organization_id=old_reply.organization_id,
                                   metadata={"previous_mode": ResponseMode.AUTO.value})
        rows = (await self.session.execute(select(Reply, CustomerMessage).join(
            CustomerMessage, (CustomerMessage.id == Reply.message_id)
            & (CustomerMessage.organization_id == Reply.organization_id),
        ).join(
            OrganizationUser, (OrganizationUser.organization_id == Reply.organization_id)
            & (OrganizationUser.user_id == Reply.created_by),
        ).join(User, User.id == Reply.created_by).join(Organization, Organization.id == Reply.organization_id).where(
            Reply.status == ReplyStatus.FAILED.value, Reply.error_code == "rate_limited",
            Reply.attempt_count >= Reply.max_attempts,
            CustomerMessage.status.in_((MessageStatus.FAILED.value, MessageStatus.NEEDS_MANUAL_CHECK.value)),
            Reply.metadata_json["provider_write_ambiguity"].as_string().is_(None),
            OrganizationUser.status == "active", OrganizationUser.role.in_(_WRITE_ROLES),
            User.status == "active", Organization.status == "active",
        ).order_by(Reply.created_at).with_for_update(of=(Reply, CustomerMessage), skip_locked=True)
          .execution_options(populate_existing=True).limit(limit))).tuples().all()
        for reply, message in rows:
            if (reply.metadata_json or {}).get("provider_write_ambiguity"):
                continue
            actor = await self.session.get(User, reply.created_by)
            draft = await self.session.get(AIDraft, reply.ai_draft_id) if reply.ai_draft_id else None
            can_queue = False
            if (actor is not None and draft is not None and message.type == MessageType.REVIEW.value
                    and message.status == MessageStatus.FAILED.value):
                _, product = await self.message_service.get_message(actor=actor, message_id=message.id)
                confidence = draft.confidence_score or 0.0
                safety = self.safety_gate.evaluate(SafetyInput(
                    draft_text=reply.reply_text, confidence_score=confidence, message_type=message.type,
                    rating=message.rating, has_product_context=product is not None,
                    model_flags=draft.safety_flags_json or [],
                ))
                if reply.mode == ResponseMode.AUTO.value:
                    automation = await self.automation_service.evaluate_message(
                        actor=actor, message_id=message.id, confidence_score=confidence,
                    )
                    can_queue = (safety.decision is SafetyDecision.ALLOW
                                 and automation.mode == ResponseMode.AUTO.value and not automation.requires_manual_review)
                    if can_queue:
                        reply.automation_rule_id = automation.matched_rule_id
                else:
                    can_queue = safety.decision is SafetyDecision.ALLOW and reply.approved_by is not None
            previous_max = reply.max_attempts
            previous_mode = reply.mode
            reply.max_attempts = reply.attempt_count + get_settings().auto_reply_max_attempts
            self._transition_reply(reply, ReplyStatus.QUEUED.value if can_queue else ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
            target = (MessageStatus.AUTO_REPLY_PENDING.value if reply.mode == ResponseMode.AUTO.value else MessageStatus.APPROVED.value)
            self._transition_message(message, target if can_queue else MessageStatus.NEEDS_MANUAL_CHECK.value)
            reply.next_retry_at = None
            reply.worker_message_id = None
            reply.last_dispatched_at = None
            reply.dispatch_owner = None
            reply.dispatch_lease_expires_at = None
            reply.error_code = None if can_queue else "legacy_draft_review_required"
            reply.failed_reason = None if can_queue else "Review the old draft before publication"
            if not can_queue:
                reply.mode = ResponseMode.SEMI_AUTO.value
            await self.audit.write(
                action="reply.throttle_recovered", entity_type="reply", entity_id=str(reply.id),
                organization_id=reply.organization_id,
                metadata={"attempt_count": reply.attempt_count, "previous_max_attempts": previous_max,
                          "previous_error_code": "rate_limited", "previous_mode": previous_mode, "status": reply.status},
            )
        await self.session.commit()
        return len(rows) + len(legacy)

    async def execute_reply(self, *, reply_id: UUID) -> ExecuteReplyResult:
        reply = await self._get_reply_for_update(reply_id)
        reply.dispatch_owner = None
        reply.dispatch_lease_expires_at = None
        reply.last_dispatch_error_code = None
        if reply.status == ReplyStatus.SENT.value:
            await self.session.commit()
            return ExecuteReplyResult(reply.id, reply.status, False)
        settings = get_settings()
        if (
            reply.status == ReplyStatus.SENDING.value
            and reply.last_attempt_at is not None
            and reply.last_attempt_at >= datetime.now(UTC) - timedelta(seconds=settings.auto_reply_execution_lease_seconds)
        ):
            await self.session.commit()
            return ExecuteReplyResult(reply.id, reply.status, False, "execution_in_progress")
        if reply.status == ReplyStatus.SENDING.value:
            message = await self._get_message(reply.message_id, organization_id=reply.organization_id)
            await self._mark_ambiguous_write(
                reply=reply,
                message=message,
                result=AdapterResult[ProviderWriteReceipt](
                    False,
                    error_code="network_error",
                    error_message_safe="Previous marketplace write outcome is unknown",
                ),
            )
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        if reply.attempt_count >= reply.max_attempts:
            await self._mark_final_failure(reply, "retry_limit_exhausted", "Retry limit exhausted")
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        if reply.status not in {
            ReplyStatus.QUEUED.value,
            ReplyStatus.RETRY_PENDING.value,
            ReplyStatus.FAILED.value,
            ReplyStatus.SENDING.value,
        }:
            await self.session.commit()
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)

        message = await self._get_message(reply.message_id, organization_id=reply.organization_id)
        account = await self._get_account(
            message.marketplace_account_id,
            organization_id=reply.organization_id,
        )
        try:
            message_type = MessageType(message.type)
            marketplace = Marketplace(message.marketplace)
        except ValueError:
            await self._mark_terminal_marketplace_failure(
                reply=reply,
                message=message,
                result=AdapterResult(
                    False,
                    error_code="unsupported_capability",
                    error_message_safe="Message type cannot be replied to through the marketplace adapter",
                ),
            )
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        if message_type not in {
            MessageType.REVIEW,
            MessageType.QUESTION,
            MessageType.CHAT,
        }:
            await self._mark_terminal_marketplace_failure(
                reply=reply,
                message=message,
                result=AdapterResult(
                    False,
                    error_code="unsupported_capability",
                    error_message_safe="Message type cannot be replied to through the marketplace adapter",
                ),
            )
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        required_scope = write_scope_for_message(message_type)
        scopes = validated_scope_names(account.scopes_json or {})
        if account.status != "active" or account.credentials_status != "valid" or required_scope not in scopes:
            await self._mark_terminal_marketplace_failure(
                reply=reply,
                message=message,
                result=AdapterResult(
                    False,
                    error_code="insufficient_scope",
                    error_message_safe="Marketplace account is inactive or lacks reply permission",
                ),
            )
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        try:
            review_adapter: ReviewQuestionAdapter | None = None
            conversation_adapter: ConversationAdapter | None = None
            if message_type is MessageType.CHAT:
                conversation_adapter = self._adapter_registry().conversations(marketplace)
            else:
                stream = MarketplaceStream.REVIEWS if message_type is MessageType.REVIEW else MarketplaceStream.QUESTIONS
                review_adapter = self._adapter_registry().review_questions(marketplace, stream)
        except UnsupportedCapabilityError:
            await self._mark_terminal_marketplace_failure(
                reply=reply,
                message=message,
                result=AdapterResult(
                    False,
                    error_code="unsupported_capability",
                    error_message_safe="Marketplace reply capability is not supported",
                ),
            )
            return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
        if reply.mode == ResponseMode.AUTO.value:
            rule = await self._get_rule(
                reply.automation_rule_id,
                organization_id=message.organization_id,
            )
            quota = await self._check_quota(message=message, rule=rule)
            if not quota.allowed:
                await self._mark_quota_blocked(reply=reply, message=message, quota=quota)
                return ExecuteReplyResult(reply.id, reply.status, False, quota.reason)

        self._transition_reply(reply, ReplyStatus.SENDING.value)
        self._transition_message(message, MessageStatus.SENDING.value)
        reply.attempt_count += 1
        if reply.idempotency_key is None:
            reply.idempotency_key = self.build_idempotency_key(message)
        attempt_count = reply.attempt_count
        idempotency_key = reply.idempotency_key
        reply.last_attempt_at = datetime.now(UTC)
        reply.next_retry_at = None
        reply.error_code = None
        reply.failed_reason = None
        await self.session.commit()

        try:
            credential = self.credentials.decrypt(account.credentials_encrypted)
        except CredentialEncryptionError:
            owned = await self._get_owned_attempt_for_update(
                reply_id,
                attempt_count=attempt_count,
                idempotency_key=idempotency_key,
            )
            if owned is None:
                await self.session.commit()
                current = await self._get_reply(reply_id)
                return ExecuteReplyResult(current.id, current.status, False, "execution_superseded")
            message = await self._get_message(owned.message_id, organization_id=owned.organization_id)
            await self._mark_terminal_marketplace_failure(
                reply=owned,
                message=message,
                result=AdapterResult(
                    False,
                    error_code="invalid_credentials",
                    error_message_safe="Stored marketplace credential is invalid",
                ),
            )
            return ExecuteReplyResult(owned.id, owned.status, False, "invalid_credentials")
        context = ProviderMessageContext(
            message_type=message_type,
            external_id=message.external_id,
            marketplace_created_at=message.marketplace_created_at,
            metadata=dict(message.metadata_json or {}),
        )
        preflight: AdapterResult[ExistingReplyResult]
        if conversation_adapter is not None:
            if account.seller_id is None:
                preflight = AdapterResult(
                    False,
                    error_code="marketplace_validation_error",
                    error_message_safe="Marketplace conversation account ID is missing",
                )
            else:
                preflight = await conversation_adapter.find_existing_chat_reply(
                    credential,
                    account.seller_id,
                    context,
                )
        elif review_adapter is not None:
            preflight = await review_adapter.find_existing_reply(
                credential,
                account.seller_id,
                context,
            )
        else:
            preflight = AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Marketplace reply capability is not supported",
            )
        if not preflight.ok or preflight.data is None:
            failed_result: AdapterResult = preflight
            if preflight.ok:
                failed_result = AdapterResult(
                    False,
                    error_code="malformed_payload",
                    error_message_safe="Marketplace preflight returned an invalid result",
                )
            owned = await self._get_owned_attempt_for_update(
                reply_id,
                attempt_count=attempt_count,
                idempotency_key=idempotency_key,
            )
            if owned is None:
                await self.session.commit()
                current = await self._get_reply(reply_id)
                return ExecuteReplyResult(current.id, current.status, False, "execution_superseded")
            message = await self._get_message(owned.message_id, organization_id=owned.organization_id)
            error_code = failed_result.error_code or "malformed_payload"
            if error_code in {"rate_limited", "coordination_unavailable"}:
                # No write was attempted. Waiting for a shared/provider read
                # cooldown must not consume the bounded write retry budget.
                owned.attempt_count -= 1
            retryable = error_code in _RETRYABLE_ERRORS and owned.attempt_count < owned.max_attempts
            if retryable:
                await self._mark_retry_pending(reply=owned, message=message, result=failed_result, execution_stage="preflight")
            else:
                await self._mark_terminal_marketplace_failure(
                    reply=owned,
                    message=message,
                    result=failed_result,
                )
            return ExecuteReplyResult(owned.id, owned.status, retryable, error_code)

        if preflight.data.exists:
            reply = await self._get_owned_attempt_for_update(
                reply_id,
                attempt_count=attempt_count,
                idempotency_key=idempotency_key,
            )
            if reply is None:
                await self.session.commit()
                current = await self._get_reply(reply_id)
                return ExecuteReplyResult(current.id, current.status, False, "execution_superseded")
            message = await self._get_message(reply.message_id, organization_id=reply.organization_id)
            if preflight.data.provider_state in _NON_PUBLISHABLE_PROVIDER_STATES:
                await self._mark_provider_state_manual_review(
                    reply=reply,
                    message=message,
                    provider_reply_id=preflight.data.provider_reply_id,
                    provider_state=preflight.data.provider_state,
                )
                return ExecuteReplyResult(
                    reply.id,
                    reply.status,
                    False,
                    reply.error_code,
                )
            await self._mark_sent(
                reply=reply,
                message=message,
                marketplace_reply_id=preflight.data.provider_reply_id,
                externally_already_answered=True,
                provider_state=preflight.data.provider_state,
            )
            return ExecuteReplyResult(reply.id, reply.status, False, externally_already_answered=True)

        if conversation_adapter is not None:
            if account.seller_id is None:
                result = AdapterResult[ProviderWriteReceipt](
                    False,
                    error_code="marketplace_validation_error",
                    error_message_safe="Marketplace conversation account ID is missing",
                )
            else:
                result = await conversation_adapter.send_chat_message(
                    credential,
                    account.seller_id,
                    context,
                    reply.reply_text,
                )
        elif review_adapter is not None:
            result = await review_adapter.send_reply(
                credential,
                account.seller_id,
                context,
                reply.reply_text,
            )
        else:
            result = AdapterResult[ProviderWriteReceipt](
                False,
                error_code="unsupported_capability",
                error_message_safe="Marketplace reply capability is not supported",
            )
        reply = await self._get_owned_attempt_for_update(
            reply_id,
            attempt_count=attempt_count,
            idempotency_key=idempotency_key,
        )
        if reply is None:
            await self.session.commit()
            current = await self._get_reply(reply_id)
            return ExecuteReplyResult(current.id, current.status, False, "execution_superseded")
        message = await self._get_message(reply.message_id, organization_id=reply.organization_id)
        if result.ok and result.data is not None:
            if result.data.provider_state in _NON_PUBLISHABLE_PROVIDER_STATES:
                await self._mark_provider_state_manual_review(
                    reply=reply,
                    message=message,
                    provider_reply_id=result.data.provider_reply_id,
                    provider_state=result.data.provider_state,
                )
                return ExecuteReplyResult(reply.id, reply.status, False, reply.error_code)
            await self._mark_sent(
                reply=reply,
                message=message,
                marketplace_reply_id=result.data.provider_reply_id,
                externally_already_answered=False,
                provider_state=result.data.provider_state,
            )
            return ExecuteReplyResult(reply.id, reply.status, False)

        if result.ok:
            result = AdapterResult[ProviderWriteReceipt](
                False,
                error_code="malformed_payload",
                error_message_safe="Marketplace write success could not be proven",
            )
        error_code = result.error_code or "malformed_payload"
        if error_code in _AMBIGUOUS_WRITE_ERRORS:
            await self._mark_ambiguous_write(reply=reply, message=message, result=result)
            return ExecuteReplyResult(reply.id, reply.status, False, error_code)
        if error_code in {"rate_limited", "coordination_unavailable"}:
            # A provider 429 explicitly rejected the write. It is a deferred
            # request, not a failed/ambiguous publication attempt.
            reply.attempt_count -= 1
        retryable = error_code in _RETRYABLE_ERRORS and reply.attempt_count < reply.max_attempts
        if retryable:
            await self._mark_retry_pending(reply=reply, message=message, result=result, execution_stage="write")
        else:
            await self._mark_terminal_marketplace_failure(reply=reply, message=message, result=result)
        return ExecuteReplyResult(reply.id, reply.status, retryable, error_code)

    async def _get_draft(self, *, message: CustomerMessage, ai_draft_id: UUID | None) -> AIDraft:
        stmt = select(AIDraft).where(
            AIDraft.organization_id == message.organization_id,
            AIDraft.message_id == message.id,
        )
        stmt = stmt.where(AIDraft.id == ai_draft_id) if ai_draft_id is not None else stmt.order_by(AIDraft.created_at.desc()).limit(1)
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

    async def _get_owned_attempt_for_update(
        self,
        reply_id: UUID,
        *,
        attempt_count: int,
        idempotency_key: str,
    ) -> Reply | None:
        result = await self.session.execute(
            select(Reply)
            .where(
                Reply.id == reply_id,
                Reply.status == ReplyStatus.SENDING.value,
                Reply.attempt_count == attempt_count,
                Reply.idempotency_key == idempotency_key,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def _get_reply_by_idempotency_key(
        self,
        idempotency_key: str,
        *,
        organization_id: UUID,
    ) -> Reply | None:
        result = await self.session.execute(
            select(Reply).where(
                Reply.idempotency_key == idempotency_key,
                Reply.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_message(
        self,
        message_id: UUID,
        *,
        organization_id: UUID,
    ) -> CustomerMessage:
        result = await self.session.execute(
            select(CustomerMessage).where(
                CustomerMessage.id == message_id,
                CustomerMessage.organization_id == organization_id,
            )
        )
        message = result.scalar_one_or_none()
        if message is None:
            raise not_found("Customer message not found")
        return message

    async def _get_account(
        self,
        account_id: UUID,
        *,
        organization_id: UUID,
    ) -> MarketplaceAccount:
        result = await self.session.execute(
            select(MarketplaceAccount).where(
                MarketplaceAccount.id == account_id,
                MarketplaceAccount.organization_id == organization_id,
            )
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise not_found("Marketplace account not found")
        return account

    async def _get_rule(
        self,
        rule_id: UUID | None,
        *,
        organization_id: UUID,
    ) -> AutomationRule | None:
        if rule_id is None:
            return None
        result = await self.session.execute(
            select(AutomationRule).where(
                AutomationRule.id == rule_id,
                AutomationRule.organization_id == organization_id,
            )
        )
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

    def _adapter_registry(self) -> MarketplaceAdapterRegistry:
        if self.registry is None:
            raise RuntimeError("marketplace adapter registry is required for reply execution")
        return self.registry

    async def _mark_sent(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        marketplace_reply_id: str | None,
        externally_already_answered: bool,
        provider_state: str | None = None,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.SENT.value)
        message_target = MessageStatus.AUTO_REPLY_SENT.value if reply.mode == ResponseMode.AUTO.value else MessageStatus.ANSWERED.value
        self._transition_message(message, message_target)
        reply.sent_at = datetime.now(UTC)
        reply.marketplace_reply_id = marketplace_reply_id
        if message.marketplace == Marketplace.WILDBERRIES.value and message.type in {
            MessageType.REVIEW.value,
            MessageType.QUESTION.value,
        }:
            metadata = dict(message.metadata_json or {})
            metadata["provider_publication"] = "unverified"
            message.metadata_json = metadata
        elif message.marketplace == Marketplace.AVITO.value and message.type == MessageType.REVIEW.value:
            metadata = dict(message.metadata_json or {})
            if provider_state == "accepted_unverified" and not externally_already_answered:
                metadata["provider_publication"] = "unverified"
            elif provider_state == "published" and externally_already_answered:
                metadata.pop("provider_publication", None)
            message.metadata_json = metadata
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

    async def _mark_retry_pending(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        result: AdapterResult,
        execution_stage: Literal["preflight", "write"],
    ) -> None:
        self._transition_reply(reply, ReplyStatus.RETRY_PENDING.value)
        message_target = MessageStatus.AUTO_REPLY_PENDING.value if reply.mode == ResponseMode.AUTO.value else MessageStatus.APPROVED.value
        self._transition_message(message, message_target)
        reply.error_code = result.error_code
        reply.failed_reason = result.error_message_safe
        reply.worker_message_id = None
        delay_seconds = max(result.retry_after_seconds or 0, min(60, 2 ** max(reply.attempt_count - 1, 0)))
        reply.next_retry_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="retry_pending",
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
            execution_stage=execution_stage,
            retry_after_seconds=result.retry_after_seconds,
            retry_delay_seconds=delay_seconds,
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

    async def _mark_ambiguous_write(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        result: AdapterResult[ProviderWriteReceipt],
    ) -> None:
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        error_code = result.error_code or "malformed_payload"
        reply.error_code = error_code
        reply.failed_reason = result.error_message_safe
        reply.next_retry_at = None
        reply.metadata_json = {
            **(reply.metadata_json or {}),
            "provider_write_ambiguity": {
                "active": True,
                "attempt_count": reply.attempt_count,
                "error_code": error_code,
            },
        }
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="manual_review_required",
            error_code=error_code,
            error_message_safe=result.error_message_safe,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.write_ambiguity",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata={
                "attempt_count": reply.attempt_count,
                "error_code": error_code,
            },
        )
        await self.session.commit()

    async def _mark_provider_state_manual_review(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        provider_reply_id: str | None,
        provider_state: str,
    ) -> None:
        self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.marketplace_reply_id = provider_reply_id
        reply.error_code = "marketplace_validation_error"
        reply.failed_reason = "Marketplace reply is not in a publishable state"
        reply.next_retry_at = None
        reply.metadata_json = {
            **(reply.metadata_json or {}),
            "provider_reply_state": provider_state,
        }
        await self._write_integration_event(
            reply=reply,
            message=message,
            status="manual_review_required",
            error_code=reply.error_code,
            error_message_safe=reply.failed_reason,
        )
        action_prefix = "auto_reply" if reply.mode == ResponseMode.AUTO.value else "manual_reply"
        await self.audit.write(
            action=f"{action_prefix}.provider_state_requires_review",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=reply.created_by,
            entity_id=str(reply.id),
            metadata={
                "attempt_count": reply.attempt_count,
                "provider_state": provider_state,
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
        error_code = result.error_code or "malformed_payload"
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
        message = await self._get_message(
            reply.message_id,
            organization_id=reply.organization_id,
        )
        if reply.status != ReplyStatus.FAILED.value:
            self._transition_reply(reply, ReplyStatus.FAILED.value)
        self._transition_message(message, MessageStatus.FAILED.value)
        reply.error_code = error_code
        reply.failed_reason = reason
        reply.next_retry_at = None
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
        execution_stage: Literal["preflight", "write"] | None = None,
        retry_after_seconds: int | None = None,
        retry_delay_seconds: int | None = None,
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
                    **({"execution_stage": execution_stage} if execution_stage is not None else {}),
                    **({"retry_after_seconds": retry_after_seconds} if retry_after_seconds is not None else {}),
                    **({"retry_delay_seconds": retry_delay_seconds} if retry_delay_seconds is not None else {}),
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
    def _transition_message(message: CustomerMessage, target: str) -> None:
        try:
            ensure_message_transition(message.status, target)
        except ValueError as exc:
            raise conflict(str(exc)) from exc
        message.status = target

    @staticmethod
    def _transition_reply(reply: Reply, target: str) -> None:
        try:
            ensure_reply_transition(reply.status, target)
        except ValueError as exc:
            raise conflict(str(exc)) from exc
        reply.status = target
