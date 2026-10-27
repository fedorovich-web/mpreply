from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import build_marketplace_reply_prompt
from app.core.config import get_settings
from app.core.errors import conflict
from app.models.ai_draft import AIDraft
from app.models.automatic_draft_job import AutomaticDraftJob
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.product import Product
from app.models.reply import Reply
from app.models.reply_credit import ReplyCreditOperation
from app.models.user import User
from app.providers.groq import GroqProviderError
from app.services.ai_service import AIService, ModelOutputError
from app.services.audit_service import AuditService
from app.services.manual_reply_service import ManualReplyService
from app.services.reply_execution_service import ReplyExecutionService

_PENDING_MESSAGE_STATUSES = ("new", "imported", "needs_reply")
_LEASE = timedelta(seconds=300)
_TERMINAL_GENERATION_ERRORS = frozenset({
    "groq_incomplete_response", "groq_refused_response", "groq_response_error",
    "groq_malformed_response", "groq_empty_response", "openrouter_malformed_response",
})


class AutomaticDraftService:

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def discover(self, *, limit: int = 25) -> int:
        self._validate_limit(limit)
        messages = list((await self.session.scalars(
            select(CustomerMessage)
            .join(Organization, Organization.id == CustomerMessage.organization_id)
            .join(MarketplaceAccount, and_(
                MarketplaceAccount.id == CustomerMessage.marketplace_account_id,
                MarketplaceAccount.organization_id == CustomerMessage.organization_id,
            ))
            .join(User, User.id == Organization.owner_user_id)
            .join(OrganizationUser, and_(
                OrganizationUser.organization_id == Organization.id, OrganizationUser.user_id == User.id,
            ))
            .where(
                Organization.status == "active", User.status == "active",
                OrganizationUser.status == "active", OrganizationUser.role.in_(("owner", "admin")),
                MarketplaceAccount.status == "active", MarketplaceAccount.credentials_status == "valid",
                CustomerMessage.status.in_(_PENDING_MESSAGE_STATUSES),
                func.length(func.trim(CustomerMessage.customer_text)) > 0,
                ~exists().where(AutomaticDraftJob.message_id == CustomerMessage.id),
                ~exists().where(AIDraft.message_id == CustomerMessage.id),
                ~exists().where(Reply.message_id == CustomerMessage.id),
            )
            .order_by(CustomerMessage.imported_at, CustomerMessage.id)
            .with_for_update(of=CustomerMessage, skip_locked=True).limit(limit)
        )).all())
        now = datetime.now(UTC)
        for message in messages:
            self.session.add(AutomaticDraftJob(
                organization_id=message.organization_id, message_id=message.id,
                operation_key=uuid4(), next_attempt_at=now,
            ))
        await self.session.commit()
        return len(messages)

    async def claim_due(self, *, now: datetime, limit: int = 25) -> tuple[tuple[UUID, UUID], ...]:
        self._validate_limit(limit)
        jobs = list((await self.session.scalars(
            select(AutomaticDraftJob).where(or_(
                and_(AutomaticDraftJob.state == "pending", AutomaticDraftJob.next_attempt_at <= now),
                and_(AutomaticDraftJob.state.in_(("dispatched", "processing")), AutomaticDraftJob.lease_expires_at <= now),
            )).order_by(AutomaticDraftJob.next_attempt_at, AutomaticDraftJob.id)
            .with_for_update(skip_locked=True).limit(limit)
        )).all())
        claims: list[tuple[UUID, UUID]] = []
        for job in jobs:
            if job.attempt_count >= 4 and not await self._has_completed_generation(job):
                await self._finish(job, "failed", "retry_limit_exhausted")
                continue
            token = uuid4()
            job.state, job.lease_token, job.lease_expires_at = "dispatched", token, now + _LEASE
            claims.append((job.id, token))
        await self.session.commit()
        return tuple(claims)

    async def dispatch_failed(self, *, job_id: UUID, token: UUID) -> None:
        job = await self._owned(job_id, token, "dispatched")
        if job is not None:
            job.state = "pending"
            job.outcome = "broker_unavailable"
            job.next_attempt_at = datetime.now(UTC) + timedelta(seconds=30)
            job.lease_token = job.lease_expires_at = None
        await self.session.commit()

    async def process(self, *, job_id: UUID, token: UUID) -> None:
        job = await self._owned(job_id, token, "dispatched")
        if job is None:
            await self.session.rollback()
            return
        job.state = "processing"
        if job.attempt_count < 4:
            job.attempt_count += 1
        elif not await self._has_completed_generation(job):
            await self._finish(job, "failed", "retry_limit_exhausted")
            await self.session.commit()
            return
        job.lease_expires_at = datetime.now(UTC) + _LEASE
        message_id, operation_key = job.message_id, job.operation_key
        await self.session.commit()
        try:
            actor = await self._actor(job)
            draft = await AIService(self.session).generate_draft(
                actor=actor, message_id=message_id, operation_key=operation_key,
                automatic_job=(job_id, token),
            )
            job = await self._owned(job_id, token, "processing")
            if job is None:
                await self.session.rollback()
                return
            actor = await self._actor(job)
            message = await self.session.scalar(select(CustomerMessage).where(
                CustomerMessage.id == message_id, CustomerMessage.organization_id == job.organization_id,
            ).with_for_update().execution_options(populate_existing=True))
            if message is None or message.status not in ("ai_draft_ready", "needs_manual_check", "safety_blocked"):
                await self._finish(job, "failed", "message_changed")
            elif await self.session.scalar(select(exists().where(
                Reply.message_id == message_id, Reply.organization_id == job.organization_id,
            ))):
                message.status = "needs_manual_check"
                await self._finish(job, "failed", "human_reply_created")
            else:
                product = await self.session.scalar(select(Product).where(
                    Product.id == message.product_id, Product.organization_id == message.organization_id,
                    Product.marketplace_account_id == message.marketplace_account_id,
                ).execution_options(populate_existing=True)) if message.product_id is not None else None
                prompt = build_marketplace_reply_prompt(
                    marketplace=message.marketplace, message_type=message.type, customer_text=message.customer_text,
                    rating=message.rating, product=AIService.product_context(product, customer_text=message.customer_text), tone="neutral",
                )
                if prompt.input_hash != draft.prompt_input_hash:
                    message.status = "needs_manual_check"
                    await self._finish(job, "failed", "input_changed_after_generation")
                else:
                    result = await ReplyExecutionService(self.session).queue_auto_reply(
                        actor=actor, message_id=message_id, ai_draft_id=draft.id,
                    )
                    if not result.queued:
                        review = ManualReplyService(self.session)
                        reply, _ = await review.create_draft(actor=actor, message_id=message_id, ai_draft_id=draft.id, reply_text=None)
                        reply.metadata_json = {
                            **(reply.metadata_json or {}), "automatic_review_reason": result.reason,
                            "automation_rule_id": str(result.matched_rule_id) if result.matched_rule_id else None,
                        }
                        await review.submit_for_review(actor=actor, reply_id=reply.id)
                    job.draft_id = draft.id
                    await self._finish(job, "completed", "queued" if result.queued else result.reason or "review_required")
            await self.session.commit()
        except HTTPException as exc:
            await self.session.rollback()
            job = await self._owned(job_id, token, "processing")
            if job is None:
                await self.session.rollback()
                return
            released_operation = await self.session.scalar(select(ReplyCreditOperation).where(
                ReplyCreditOperation.organization_id == job.organization_id,
                ReplyCreditOperation.operation_key == job.operation_key,
                ReplyCreditOperation.state == "released",
            ))
            if released_operation is not None and released_operation.release_reason in _TERMINAL_GENERATION_ERRORS:
                await self._finish(job, "failed", released_operation.release_reason)
                await self.session.commit()
                return
            if released_operation is not None:
                job.operation_key = uuid4()
            reservation_running = exc.status_code == 409 and bool(await self.session.scalar(select(exists().where(
                ReplyCreditOperation.organization_id == job.organization_id,
                ReplyCreditOperation.operation_key == job.operation_key, ReplyCreditOperation.state == "reserved",
            ))))
            provider_error = exc.__cause__
            if isinstance(provider_error, ModelOutputError):
                await self._finish(job, "failed", f"{get_settings().ai_reply_provider}_malformed_response")
            elif isinstance(provider_error, GroqProviderError) and provider_error.error_code in _TERMINAL_GENERATION_ERRORS:
                await self._finish(job, "failed", provider_error.error_code)
            elif (exc.status_code in (402, 410, 502, 503) or reservation_running) and job.attempt_count < 4:
                job.state = "pending"
                job.outcome = f"generation_http_{exc.status_code}"
                job.next_attempt_at = datetime.now(UTC) + timedelta(minutes=5 if exc.status_code == 402 else 1)
                job.lease_token = job.lease_expires_at = None
            else:
                await self._finish(job, "failed", f"generation_http_{exc.status_code}")
            await self.session.commit()

    async def _actor(self, job: AutomaticDraftJob) -> User:
        actor = await self.session.scalar(select(User)
            .join(Organization, Organization.owner_user_id == User.id)
            .join(OrganizationUser, and_(OrganizationUser.organization_id == Organization.id, OrganizationUser.user_id == User.id))
            .join(CustomerMessage, CustomerMessage.organization_id == Organization.id)
            .join(MarketplaceAccount, and_(
                MarketplaceAccount.id == CustomerMessage.marketplace_account_id, MarketplaceAccount.organization_id == Organization.id,
            ))
            .where(
                Organization.id == job.organization_id, CustomerMessage.id == job.message_id,
                Organization.status == "active", User.status == "active",
                OrganizationUser.status == "active", OrganizationUser.role.in_(("owner", "admin")),
                MarketplaceAccount.status == "active", MarketplaceAccount.credentials_status == "valid",
            ).execution_options(populate_existing=True))
        if actor is None:
            raise conflict("Automatic generation is no longer authorized")
        return actor

    async def _owned(self, job_id: UUID, token: UUID, state: str) -> AutomaticDraftJob | None:
        return await self.session.scalar(select(AutomaticDraftJob).where(
            AutomaticDraftJob.id == job_id, AutomaticDraftJob.lease_token == token,
            AutomaticDraftJob.state == state, AutomaticDraftJob.lease_expires_at > datetime.now(UTC),
        ).with_for_update().execution_options(populate_existing=True))

    async def _has_completed_generation(self, job: AutomaticDraftJob) -> bool:
        return bool(await self.session.scalar(select(exists().where(
            ReplyCreditOperation.organization_id == job.organization_id,
            ReplyCreditOperation.operation_key == job.operation_key,
            ReplyCreditOperation.state == "completed",
        ))))

    async def _finish(self, job: AutomaticDraftJob, state: str, outcome: str) -> None:
        job.state, job.outcome = state, outcome
        job.lease_token = job.lease_expires_at = None
        if state == "failed":
            message = await self.session.scalar(select(CustomerMessage).where(
                CustomerMessage.id == job.message_id, CustomerMessage.organization_id == job.organization_id,
            ).with_for_update().execution_options(populate_existing=True))
            if message is not None and message.status in _PENDING_MESSAGE_STATUSES:
                message.status = "needs_manual_check"
        await AuditService(self.session).write(
            action="automatic_draft.finished", entity_type="customer_message", organization_id=job.organization_id,
            entity_id=str(job.message_id), metadata={"state": state, "outcome": outcome, "attempt_count": job.attempt_count},
        )

    @staticmethod
    def _validate_limit(limit: int) -> None:
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Automatic draft batch must be between 1 and 100")
