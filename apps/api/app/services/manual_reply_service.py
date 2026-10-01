from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.automation.state_machine import ensure_message_transition, ensure_reply_transition
from app.core.config import get_settings
from app.core.errors import conflict, not_found
from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.enums import MessageStatus, ReplyStatus, ResponseMode
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.reply import Reply
from app.models.user import User
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput, SafetyResult
from app.services.audit_service import AuditService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.reply_execution_service import ReplyExecutionService

_WRITE_ROLES = {"owner", "admin", "manager"}
_REVIEWABLE_REPLY_STATUSES = {
    ReplyStatus.DRAFT.value,
    ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
}
_REVIEW_QUEUE_STATUSES = {
    ReplyStatus.DRAFT.value,
    ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
    ReplyStatus.WAITING_REVIEW.value,
    ReplyStatus.APPROVED.value,
}


@dataclass(frozen=True)
class ManualReplySendResult:
    reply: Reply
    duplicate: bool


class ManualReplyService:
    """Manual and semi-automatic review workflow for marketplace replies.

    The workflow intentionally keeps AI generation, human review, approval and
    marketplace execution as separate transitions. Edited text is re-evaluated
    by SafetyGate both at review submission and approval/send boundaries.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.messages = MessageService(session)
        self.organizations = OrganizationService(session)
        self.safety_gate = SafetyGate()

    async def list_review_queue(
        self,
        *,
        actor: User,
        organization_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[Reply, CustomerMessage, Product | None]], int]:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles={"owner", "admin", "manager", "viewer"},
        )
        normalized_page = max(page, 1)
        normalized_page_size = min(max(page_size, 1), 100)
        filters = (
            Reply.organization_id == organization_id,
            Reply.mode == ResponseMode.SEMI_AUTO.value,
            Reply.status.in_(_REVIEW_QUEUE_STATUSES),
        )

        count_result = await self.session.execute(select(func.count(Reply.id)).where(*filters))
        total = int(count_result.scalar_one())

        stmt = (
            select(Reply, CustomerMessage, Product)
            .join(
                CustomerMessage,
                (Reply.message_id == CustomerMessage.id) & (Reply.organization_id == CustomerMessage.organization_id),
            )
            .outerjoin(
                Product,
                (CustomerMessage.product_id == Product.id)
                & (CustomerMessage.organization_id == Product.organization_id)
                & (CustomerMessage.marketplace_account_id == Product.marketplace_account_id),
            )
            .where(*filters)
            .order_by(Reply.updated_at.desc(), Reply.created_at.desc())
            .offset((normalized_page - 1) * normalized_page_size)
            .limit(normalized_page_size)
        )
        result = await self.session.execute(stmt)
        return [(reply, message, product) for reply, message, product in result.all()], total

    @staticmethod
    def safety_summary(reply: Reply) -> tuple[str, list[str], list[str]]:
        metadata = reply.metadata_json or {}
        decision = metadata.get("safety_decision")
        flags = metadata.get("safety_flags")
        reasons = metadata.get("safety_reasons")
        flag_items = cast(list[object], flags) if isinstance(flags, list) else []
        reason_items = cast(list[object], reasons) if isinstance(reasons, list) else []
        return (
            decision if isinstance(decision, str) else "manual_review",
            [item for item in flag_items if isinstance(item, str)],
            [item for item in reason_items if isinstance(item, str)],
        )

    async def create_draft(
        self,
        *,
        actor: User,
        message_id: UUID,
        ai_draft_id: UUID | None,
        reply_text: str | None,
    ) -> tuple[Reply, SafetyResult]:
        # Serialize creation with automatic generation completion and routing.
        # Refresh status after acquiring the lock before accepting a human draft.
        message, product = await self.messages.get_message(actor=actor, message_id=message_id, for_update=True)
        await self._require_write_role(actor=actor, organization_id=message.organization_id)
        await self._ensure_message_can_receive_reply(message)
        await self._ensure_no_open_semi_auto_reply(message.id)

        ai_draft = await self._get_ai_draft(message=message, ai_draft_id=ai_draft_id) if ai_draft_id is not None else None
        text = (reply_text if reply_text is not None else ai_draft.draft_text if ai_draft is not None else "").strip()
        if not text:
            raise conflict("Reply text must not be empty")

        safety = self._evaluate_safety(message=message, has_product_context=product is not None, ai_draft=ai_draft, text=text)
        reply = Reply(
            organization_id=message.organization_id,
            message_id=message.id,
            ai_draft_id=ai_draft.id if ai_draft is not None else None,
            reply_text=text,
            status=ReplyStatus.DRAFT.value,
            mode=ResponseMode.SEMI_AUTO.value,
            revision=1,
            attempt_count=0,
            max_attempts=get_settings().auto_reply_max_attempts,
            created_by=actor.id,
            metadata_json=self._safety_metadata(safety),
        )
        self.session.add(reply)
        await self.session.flush()
        await self.audit.write(
            action="manual_reply.draft_created",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={
                "message_id": str(message.id),
                "ai_draft_id": str(ai_draft.id) if ai_draft is not None else None,
                "revision": reply.revision,
                **self._safety_metadata(safety),
            },
        )
        return reply, safety

    async def update_draft(
        self,
        *,
        actor: User,
        reply_id: UUID,
        reply_text: str,
        expected_revision: int,
    ) -> tuple[Reply, SafetyResult]:
        reply = await self._get_reply_for_update(actor=actor, reply_id=reply_id)
        await self._require_write_role(actor=actor, organization_id=reply.organization_id)
        if reply.mode != ResponseMode.SEMI_AUTO.value:
            raise conflict("Only semi-automatic replies can be edited through the manual review workflow")
        if reply.status not in _REVIEWABLE_REPLY_STATUSES:
            raise conflict("Only draft or manual-review-required replies can be edited")
        if reply.revision != expected_revision:
            raise conflict(f"Stale reply revision: expected {expected_revision}, current {reply.revision}")

        text = reply_text.strip()
        if not text:
            raise conflict("Reply text must not be empty")
        message, product = await self.messages.get_message(actor=actor, message_id=reply.message_id)
        ai_draft = await self._get_ai_draft(message=message, ai_draft_id=reply.ai_draft_id) if reply.ai_draft_id else None
        safety = self._evaluate_safety(message=message, has_product_context=product is not None, ai_draft=ai_draft, text=text)

        reply.reply_text = text
        reply.revision += 1
        reply.rejection_reason = None
        reply.rejected_at = None
        reply.metadata_json = {**(reply.metadata_json or {}), **self._safety_metadata(safety)}
        if reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value:
            self._transition_reply(reply, ReplyStatus.DRAFT.value)

        await self.audit.write(
            action="manual_reply.draft_updated",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"revision": reply.revision, **self._safety_metadata(safety)},
        )
        return reply, safety

    async def submit_for_review(self, *, actor: User, reply_id: UUID) -> tuple[Reply, SafetyResult]:
        reply = await self._get_reply_for_update(actor=actor, reply_id=reply_id)
        await self._require_write_role(actor=actor, organization_id=reply.organization_id)
        if reply.mode != ResponseMode.SEMI_AUTO.value:
            raise conflict("Only semi-automatic replies use the manual review workflow")
        if reply.status not in _REVIEWABLE_REPLY_STATUSES:
            raise conflict("Reply must be a draft before it can be submitted for review")

        message, product = await self.messages.get_message(actor=actor, message_id=reply.message_id)
        ai_draft = await self._get_ai_draft(message=message, ai_draft_id=reply.ai_draft_id) if reply.ai_draft_id else None
        safety = self._evaluate_safety(
            message=message,
            has_product_context=product is not None,
            ai_draft=ai_draft,
            text=reply.reply_text,
        )
        if safety.decision is SafetyDecision.BLOCK:
            if reply.status == ReplyStatus.DRAFT.value:
                self._transition_reply(reply, ReplyStatus.MANUAL_REVIEW_REQUIRED.value)
            self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
            reply.metadata_json = {**(reply.metadata_json or {}), **self._safety_metadata(safety)}
            await self.audit.write(
                action="manual_reply.review_blocked_by_safety",
                entity_type="reply",
                organization_id=reply.organization_id,
                actor_user_id=actor.id,
                entity_id=str(reply.id),
                metadata=self._safety_metadata(safety),
            )
            return reply, safety

        self._transition_reply(reply, ReplyStatus.WAITING_REVIEW.value)
        self._transition_message(message, MessageStatus.WAITING_REVIEW.value)
        reply.submitted_for_review_at = datetime.now(UTC)
        reply.metadata_json = {**(reply.metadata_json or {}), **self._safety_metadata(safety)}
        await self.audit.write(
            action="manual_reply.submitted_for_review",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"revision": reply.revision, **self._safety_metadata(safety)},
        )
        return reply, safety

    async def approve(self, *, actor: User, reply_id: UUID) -> tuple[Reply, SafetyResult]:
        reply = await self._get_reply_for_update(actor=actor, reply_id=reply_id)
        await self._require_write_role(actor=actor, organization_id=reply.organization_id)
        if reply.status != ReplyStatus.WAITING_REVIEW.value:
            raise conflict("Only replies waiting for review can be approved")

        message, product = await self.messages.get_message(actor=actor, message_id=reply.message_id)
        ai_draft = await self._get_ai_draft(message=message, ai_draft_id=reply.ai_draft_id) if reply.ai_draft_id else None
        safety = self._evaluate_safety(
            message=message,
            has_product_context=product is not None,
            ai_draft=ai_draft,
            text=reply.reply_text,
        )
        if safety.decision is SafetyDecision.BLOCK:
            raise conflict("SafetyGate blocked this reply. Reject it back to draft and edit the text")

        self._transition_reply(reply, ReplyStatus.APPROVED.value)
        self._transition_message(message, MessageStatus.APPROVED.value)
        reply.approved_by = actor.id
        reply.approved_at = datetime.now(UTC)
        reply.rejection_reason = None
        reply.rejected_at = None
        reply.metadata_json = {**(reply.metadata_json or {}), **self._safety_metadata(safety)}
        await self.audit.write(
            action="manual_reply.approved",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"revision": reply.revision, **self._safety_metadata(safety)},
        )
        return reply, safety

    async def reject(self, *, actor: User, reply_id: UUID, reason: str) -> Reply:
        reply = await self._get_reply_for_update(actor=actor, reply_id=reply_id)
        await self._require_write_role(actor=actor, organization_id=reply.organization_id)
        if reply.status != ReplyStatus.WAITING_REVIEW.value:
            raise conflict("Only replies waiting for review can be rejected")

        message = await self._get_message(
            reply.message_id,
            organization_id=reply.organization_id,
        )
        self._transition_reply(reply, ReplyStatus.DRAFT.value)
        self._transition_message(message, MessageStatus.NEEDS_MANUAL_CHECK.value)
        reply.rejection_reason = reason.strip()
        reply.rejected_at = datetime.now(UTC)
        reply.approved_by = None
        reply.approved_at = None
        await self.audit.write(
            action="manual_reply.rejected",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"reason": reply.rejection_reason, "revision": reply.revision},
        )
        return reply

    async def prepare_send(self, *, actor: User, reply_id: UUID) -> ManualReplySendResult:
        reply = await self._get_reply_for_update(actor=actor, reply_id=reply_id)
        await self._require_write_role(actor=actor, organization_id=reply.organization_id)
        if reply.mode != ResponseMode.SEMI_AUTO.value:
            raise conflict("Only approved semi-automatic replies can be sent through this endpoint")
        if reply.status != ReplyStatus.APPROVED.value:
            raise conflict("Reply must be approved before it can be sent")

        message, product = await self.messages.get_message(actor=actor, message_id=reply.message_id)
        ai_draft = await self._get_ai_draft(message=message, ai_draft_id=reply.ai_draft_id) if reply.ai_draft_id else None
        safety = self._evaluate_safety(
            message=message,
            has_product_context=product is not None,
            ai_draft=ai_draft,
            text=reply.reply_text,
        )
        if safety.decision is SafetyDecision.BLOCK:
            raise conflict("SafetyGate blocked this reply at send time")

        idempotency_key = ReplyExecutionService.build_idempotency_key(message)
        existing = await self._get_reply_by_idempotency_key(
            idempotency_key,
            organization_id=reply.organization_id,
        )
        if existing is not None and existing.id != reply.id:
            await self.audit.write(
                action="manual_reply.duplicate_suppressed",
                entity_type="reply",
                organization_id=reply.organization_id,
                actor_user_id=actor.id,
                entity_id=str(reply.id),
                metadata={"existing_reply_id": str(existing.id), "idempotency_key": idempotency_key},
            )
            return ManualReplySendResult(reply=existing, duplicate=True)

        reply.idempotency_key = idempotency_key
        reply.sent_by = actor.id
        reply.error_code = None
        reply.failed_reason = None
        self._transition_reply(reply, ReplyStatus.QUEUED.value)
        await self.audit.write(
            action="manual_reply.queued",
            entity_type="reply",
            organization_id=reply.organization_id,
            actor_user_id=actor.id,
            entity_id=str(reply.id),
            metadata={"message_id": str(message.id), "idempotency_key": idempotency_key},
        )
        return ManualReplySendResult(reply=reply, duplicate=False)

    async def _require_write_role(self, *, actor: User, organization_id: UUID) -> None:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_WRITE_ROLES,
        )

    async def _ensure_message_can_receive_reply(self, message: CustomerMessage) -> None:
        if message.status in {
            MessageStatus.ANSWERED.value,
            MessageStatus.AUTO_REPLY_SENT.value,
            MessageStatus.AUTO_REPLY_PENDING.value,
            MessageStatus.APPROVED.value,
            MessageStatus.SENDING.value,
            MessageStatus.BLOCKED_BY_MARKETPLACE.value,
            MessageStatus.ARCHIVED.value,
            MessageStatus.DUPLICATE.value,
            MessageStatus.SKIPPED.value,
        }:
            raise conflict(f"Message status does not allow creating a new reply: {message.status}")

    async def _ensure_no_open_semi_auto_reply(self, message_id: UUID) -> None:
        result = await self.session.execute(
            select(Reply).where(
                Reply.message_id == message_id,
                Reply.mode == ResponseMode.SEMI_AUTO.value,
                Reply.status.in_(
                    {
                        ReplyStatus.DRAFT.value,
                        ReplyStatus.MANUAL_REVIEW_REQUIRED.value,
                        ReplyStatus.WAITING_REVIEW.value,
                        ReplyStatus.APPROVED.value,
                        ReplyStatus.QUEUED.value,
                        ReplyStatus.SENDING.value,
                        ReplyStatus.RETRY_PENDING.value,
                    }
                ),
            )
        )
        if result.scalars().first() is not None:
            raise conflict("An active semi-automatic reply already exists for this message")

    async def _get_ai_draft(self, *, message: CustomerMessage, ai_draft_id: UUID) -> AIDraft:
        result = await self.session.execute(
            select(AIDraft).where(
                AIDraft.id == ai_draft_id,
                AIDraft.organization_id == message.organization_id,
                AIDraft.message_id == message.id,
            )
        )
        draft = result.scalar_one_or_none()
        if draft is None:
            raise not_found("AI draft not found for this message")
        return draft

    async def _get_reply_for_update(self, *, actor: User, reply_id: UUID) -> Reply:
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
            )
            .with_for_update(of=Reply)
        )
        reply = result.scalar_one_or_none()
        if reply is None:
            raise not_found("Reply not found")
        return reply

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

    def _evaluate_safety(
        self,
        *,
        message: CustomerMessage,
        has_product_context: bool,
        ai_draft: AIDraft | None,
        text: str,
    ) -> SafetyResult:
        confidence = ai_draft.confidence_score if ai_draft is not None and ai_draft.confidence_score is not None else 1.0
        model_flags = ai_draft.safety_flags_json if ai_draft is not None else []
        return self.safety_gate.evaluate(
            SafetyInput(
                draft_text=text,
                confidence_score=confidence,
                message_type=message.type,
                rating=message.rating,
                has_product_context=has_product_context,
                model_flags=model_flags or [],
            )
        )

    @staticmethod
    def _safety_metadata(safety: SafetyResult) -> dict[str, object]:
        return {
            "safety_decision": safety.decision.value,
            "safety_flags": list(safety.flags),
            "safety_reasons": list(safety.reasons),
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
