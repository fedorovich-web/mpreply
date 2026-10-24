from __future__ import annotations

import asyncio
import json
import math
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from typing import cast
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import ResponseTone, build_marketplace_reply_prompt, compatibility_clarification
from app.core.config import get_settings
from app.core.errors import bad_gateway, bad_request, conflict, not_found
from app.models.ai_draft import AIDraft
from app.models.automatic_draft_job import AutomaticDraftJob
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.product import Product
from app.models.reply import Reply
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.providers.groq import GroqProvider, GroqProviderError
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput
from app.services.audit_service import AuditService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.product_research_service import ProductResearchService, compatibility_models, research_context
from app.services.reply_credit_service import ReplyCreditService

_ALLOWED_ROLES = {"owner", "admin", "manager"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_GENERATION_BLOCKED_STATUSES = frozenset({
    "auto_reply_pending", "approved", "sending", "answered", "auto_reply_sent",
    "blocked_by_marketplace", "duplicate", "skipped", "archived",
})


@dataclass(frozen=True)
class ParsedModelOutput:
    answer: str
    confidence_score: float
    safety_flags: list[str]


class ModelOutputError(ValueError):
    pass


_MODEL_SAFETY_FLAGS = frozenset(
    {
        "missing_product_context",
        "risky_promise",
        "medical_or_legal_claim",
        "unclear_customer_issue",
        "needs_manual_review",
        "unsafe_instruction",
        "personal_data_exposure",
        "policy_violation",
        "sensitive_topic",
    }
)
_MAX_MODEL_OUTPUT_CHARS = 16_384


def _sum_usage(first: int | None, second: int | None) -> int | None:
    return None if first is None and second is None else (first or 0) + (second or 0)


class AIService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.message_service = MessageService(session)
        self.organization_service = OrganizationService(session)
        self.credits = ReplyCreditService(session)
        self.safety_gate = SafetyGate()

    async def generate_draft(
        self,
        *,
        actor: User,
        message_id: UUID,
        operation_key: UUID,
        tone: ResponseTone = "neutral",
        temperature: float = 0.3,
        max_tokens: int = 600,
        brand_rules: str | None = None,
        knowledge_base: str | None = None,
        automatic_job: tuple[UUID, UUID] | None = None,
    ) -> AIDraft:
        message, _ = await self.message_service.get_message(actor=actor, message_id=message_id)
        org_id, actor_id = message.organization_id, actor.id
        await self.organization_service.require_membership_role(
            organization_id=org_id, user_id=actor_id, allowed_roles=_ALLOWED_ROLES,
        )
        if not message.customer_text.strip():
            raise bad_request("Message has no customer text")
        request_hash = sha256(json.dumps({
            "actor_id": str(actor_id), "message_id": str(message_id), "tone": tone,
            "temperature": temperature, "max_tokens": max_tokens,
            "brand_rules": brand_rules, "knowledge_base": knowledge_base,
        }, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        attempt_id = uuid4()
        operation = await self.credits.reserve(
            organization_id=org_id, operation_key=operation_key, request_hash=request_hash, operation_id=attempt_id,
        )
        operation_id, state, existing_draft_id = operation.id, operation.state, operation.draft_id
        await self.session.commit()
        if state == "completed" and existing_draft_id is not None:
            return await self.get_draft(actor=actor, draft_id=existing_draft_id)
        if state == "released":
            raise HTTPException(status_code=410, detail="This generation attempt has ended; start a new generation")
        if operation_id != attempt_id:
            raise conflict("Reply generation is already in progress")

        try:
            async with asyncio.timeout(240):
                draft = await self._generate_reserved_draft(
                    actor=actor, message_id=message_id, tone=tone, temperature=temperature,
                    max_tokens=max_tokens, brand_rules=brand_rules, knowledge_base=knowledge_base,
                    automatic_job=automatic_job,
                )
                await self.credits.consume(organization_id=org_id, operation_id=operation_id, draft_id=draft.id)
                await self.session.commit()
                return draft
        except (Exception, asyncio.CancelledError) as exc:
            error_code = "generation_failed"
            if isinstance(exc, asyncio.CancelledError):
                error_code = "generation_cancelled"
            elif isinstance(exc, TimeoutError):
                error_code = "generation_timeout"
            elif isinstance(exc.__cause__, GroqProviderError):
                error_code = exc.__cause__.error_code
            elif isinstance(exc.__cause__, ModelOutputError):
                error_code = "groq_malformed_response"
            elif isinstance(exc, HTTPException) and exc.status_code == 409:
                error_code = "generation_conflict"
            await self.session.rollback()
            await self.credits.release(organization_id=org_id, operation_id=operation_id, reason=error_code)
            await self.audit.write(
                action="ai_draft.failed", entity_type="customer_message", organization_id=org_id,
                actor_user_id=actor_id, entity_id=str(message_id), metadata={"provider": "groq", "error_code": error_code},
            )
            await self.session.commit()
            if isinstance(exc, TimeoutError):
                raise bad_gateway("AI generation timed out") from exc
            raise

    async def _generate_reserved_draft(
        self,
        *,
        actor: User,
        message_id: UUID,
        tone: ResponseTone = "neutral",
        temperature: float = 0.3,
        max_tokens: int = 600,
        brand_rules: str | None = None,
        knowledge_base: str | None = None,
        automatic_job: tuple[UUID, UUID] | None = None,
    ) -> AIDraft:
        message, product = await self.message_service.get_message(actor=actor, message_id=message_id)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_ROLES,
        )
        if not message.customer_text.strip():
            raise bad_request("Message has no customer text")
        self._require_generation_available(message)
        if automatic_job is not None:
            await self._require_automatic_generation(automatic_job, message, actor)
        original_status = message.status
        organization_id = message.organization_id

        settings = get_settings()
        provider = GroqProvider(
            api_key=settings.groq_api_key.get_secret_value(), base_url=settings.groq_base_url,
            timeout_seconds=settings.groq_timeout_seconds,
        )
        target_models = compatibility_models(message.customer_text)
        research = await ProductResearchService(self.session).ensure(product=product, provider=provider, models=target_models)
        if automatic_job is not None:
            await self._require_automatic_generation(automatic_job, message, actor)
        prompt = build_marketplace_reply_prompt(
            marketplace=message.marketplace,
            message_type=message.type,
            customer_text=message.customer_text,
            rating=message.rating,
            product=self.product_context(product, customer_text=message.customer_text),
            tone=tone,
            brand_rules=brand_rules,
            knowledge_base=knowledge_base,
        )
        await self.session.commit()
        try:
            completion = await provider.complete(
                model=settings.groq_default_model,
                messages=prompt.messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except GroqProviderError as exc:
            raise bad_gateway("AI provider request failed") from exc

        try:
            parsed = self._parse_model_output(completion.text)
        except ModelOutputError as exc:
            raise bad_gateway("AI provider returned an invalid response") from exc
        if not research.verified:
            answer = (compatibility_clarification(target_models)
                      if message.type == "question" and target_models else parsed.answer)
            parsed = ParsedModelOutput(answer, min(parsed.confidence_score, 0.74),
                                       list(set(parsed.safety_flags) | {"missing_product_context", "needs_manual_review"}))
        safety = self.safety_gate.evaluate(
            SafetyInput(
                draft_text=parsed.answer,
                confidence_score=parsed.confidence_score,
                message_type=message.type,
                rating=message.rating,
                has_product_context=research.verified,
                model_flags=parsed.safety_flags,
            )
        )
        if automatic_job is not None:
            await self._require_automatic_generation(automatic_job, message, actor)
        current_message = await self.session.scalar(
            select(CustomerMessage)
            .where(CustomerMessage.id == message_id, CustomerMessage.organization_id == organization_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if current_message is None:
            raise conflict("Message changed during AI generation; start a new generation")
        message = current_message
        if automatic_job is not None:
            await self._require_automatic_generation(automatic_job, message, actor)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id, user_id=actor.id, allowed_roles=_ALLOWED_ROLES,
        )
        self._require_generation_available(message)
        product = None if message.product_id is None else await self.session.scalar(
            select(Product).where(
                Product.id == message.product_id,
                Product.organization_id == organization_id,
                Product.marketplace_account_id == message.marketplace_account_id,
            ).execution_options(populate_existing=True)
        )
        current_prompt = build_marketplace_reply_prompt(
            marketplace=message.marketplace, message_type=message.type, customer_text=message.customer_text,
            rating=message.rating, product=self.product_context(product, customer_text=message.customer_text), tone=tone,
            brand_rules=brand_rules, knowledge_base=knowledge_base,
        )
        if message.status != original_status or current_prompt.input_hash != prompt.input_hash:
            raise conflict("Message changed during AI generation; start a new generation")
        flags = safety.flags
        draft = AIDraft(
            organization_id=message.organization_id,
            message_id=message.id,
            provider="groq",
            model=completion.model,
            prompt_version=prompt.version,
            prompt_input_hash=prompt.input_hash,
            draft_text=parsed.answer,
            tokens_input=_sum_usage(completion.usage.prompt_tokens, research.usage.prompt_tokens),
            tokens_output=_sum_usage(completion.usage.completion_tokens, research.usage.completion_tokens),
            latency_ms=completion.latency_ms + research.latency_ms,
            cost_estimate=(completion.usage.cost + research.usage.cost
                           if completion.usage.cost is not None and research.usage.cost is not None
                           else completion.usage.cost if research.cached else None),
            confidence_score=parsed.confidence_score,
            safety_flags_json=flags,
            created_by=actor.id,
        )
        self.session.add(draft)
        await self.session.flush()
        status_by_decision = {
            SafetyDecision.ALLOW: "ai_draft_ready",
            SafetyDecision.MANUAL_REVIEW: "needs_manual_check",
            SafetyDecision.BLOCK: "safety_blocked",
        }
        message.status = status_by_decision[safety.decision]
        await self._write_usage(actor=actor, message=message, draft=draft,
                                total_tokens=_sum_usage(completion.usage.total_tokens, research.usage.total_tokens))
        await self.audit.write(
            action="ai_draft.generated",
            entity_type="ai_draft",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata={
                "provider": "groq",
                "model": completion.model,
                "prompt_version": prompt.version,
                "latency_ms": completion.latency_ms,
                "safety_decision": safety.decision.value,
                "safety_flags": flags,
                "safety_reasons": safety.reasons,
                "product_research": {"verified": research.verified, "cached": research.cached,
                                     "error_code": research.error_code, "latency_ms": research.latency_ms},
            },
        )
        await self.session.flush()
        return draft

    async def list_drafts(
        self,
        *,
        actor: User,
        organization_id: UUID,
        message_id: UUID | None = None,
    ) -> tuple[list[AIDraft], int]:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        stmt = select(AIDraft).where(AIDraft.organization_id == organization_id)
        count_stmt = select(func.count()).select_from(AIDraft).where(AIDraft.organization_id == organization_id)
        if message_id is not None:
            stmt = stmt.where(AIDraft.message_id == message_id)
            count_stmt = count_stmt.where(AIDraft.message_id == message_id)
        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())
        result = await self.session.execute(stmt.order_by(AIDraft.created_at.desc()).limit(100))
        return list(result.scalars().all()), total

    async def get_draft(self, *, actor: User, draft_id: UUID) -> AIDraft:
        result = await self.session.execute(
            select(AIDraft)
            .join(
                OrganizationUser,
                OrganizationUser.organization_id == AIDraft.organization_id,
            )
            .where(
                AIDraft.id == draft_id,
                OrganizationUser.user_id == actor.id,
                OrganizationUser.status == "active",
                OrganizationUser.role.in_(_READ_ROLES),
            )
        )
        draft = result.scalar_one_or_none()
        if draft is None:
            raise not_found("AI draft not found")
        return draft

    async def _write_usage(
        self,
        *,
        actor: User,
        message: CustomerMessage,
        draft: AIDraft,
        total_tokens: int | None,
    ) -> None:
        usage_event = UsageEvent(
            organization_id=message.organization_id,
            user_id=actor.id,
            event_type="ai_draft.generated",
            quantity=total_tokens or 1,
            metadata_json={
                "provider": draft.provider,
                "model": draft.model,
                "prompt_version": draft.prompt_version,
                "message_id": str(message.id),
                "draft_id": str(draft.id),
                "tokens_input": draft.tokens_input,
                "tokens_output": draft.tokens_output,
                "cost_estimate": str(draft.cost_estimate) if draft.cost_estimate is not None else None,
            },
        )
        self.session.add(usage_event)
        await self.session.flush()

    @staticmethod
    def _require_generation_available(message: CustomerMessage) -> None:
        if message.status in _GENERATION_BLOCKED_STATUSES:
            raise conflict("Message is already handled or is being sent")

    async def _require_automatic_generation(self, job_identity: tuple[UUID, UUID], message: CustomerMessage, actor: User) -> None:
        job_id, token = job_identity
        job = await self.session.scalar(select(AutomaticDraftJob)
            .join(Organization, Organization.id == AutomaticDraftJob.organization_id)
            .join(MarketplaceAccount, MarketplaceAccount.id == message.marketplace_account_id)
            .join(User, User.id == Organization.owner_user_id)
            .join(OrganizationUser, (OrganizationUser.organization_id == Organization.id) & (OrganizationUser.user_id == User.id))
            .where(
                AutomaticDraftJob.id == job_id, AutomaticDraftJob.lease_token == token,
                AutomaticDraftJob.state == "processing", AutomaticDraftJob.lease_expires_at > datetime.now(UTC),
                AutomaticDraftJob.message_id == message.id, AutomaticDraftJob.organization_id == message.organization_id,
                Organization.status == "active", User.id == actor.id, User.status == "active",
                OrganizationUser.status == "active", OrganizationUser.role.in_(("owner", "admin")),
                MarketplaceAccount.organization_id == message.organization_id,
                MarketplaceAccount.status == "active", MarketplaceAccount.credentials_status == "valid",
                ~exists().where(Reply.message_id == message.id, Reply.organization_id == message.organization_id),
            ).with_for_update(of=AutomaticDraftJob).execution_options(populate_existing=True))
        if job is None or message.status not in {"new", "imported", "needs_reply"}:
            raise conflict("Automatic generation lease or eligibility changed")

    @staticmethod
    def product_context(product: Product | None, *, customer_text: str = "") -> dict[str, object] | None:
        if product is None:
            return None
        return {
            "name": product.name,
            "sku": product.sku,
            "brand": product.brand,
            "category": product.category,
            "external_id": product.external_id,
            "metadata": research_context(product.metadata_json or {}, compatibility_models(customer_text)),
        }

    @staticmethod
    def _parse_model_output(raw_text: str) -> ParsedModelOutput:
        if len(raw_text) > _MAX_MODEL_OUTPUT_CHARS:
            raise ModelOutputError("model output exceeds the size limit")
        try:
            parsed: object = json.loads(raw_text, object_pairs_hook=_unique_object)
        except (json.JSONDecodeError, UnicodeError, ModelOutputError) as exc:
            raise ModelOutputError("model output is not valid JSON") from exc
        if not isinstance(parsed, dict):
            raise ModelOutputError("model output must be an object")
        data = cast(dict[str, object], parsed)
        if set(data) != {"answer", "confidence_score", "safety_flags"}:
            raise ModelOutputError("model output does not match the response contract")

        answer_value = data["answer"]
        if not isinstance(answer_value, str):
            raise ModelOutputError("model answer must be a string")
        answer = answer_value.strip()
        if not answer or len(answer) > 12_000:
            raise ModelOutputError("model answer length is invalid")

        confidence_score = _strict_confidence_score(data["confidence_score"])
        raw_flags_value = data.get("safety_flags")
        if not isinstance(raw_flags_value, list):
            raise ModelOutputError("model safety flags are invalid")
        raw_flags = cast(list[object], raw_flags_value)
        if len(raw_flags) > 32:
            raise ModelOutputError("model safety flags are invalid")
        flags: list[str] = []
        for value in raw_flags:
            if not isinstance(value, str):
                raise ModelOutputError("model safety flag must be a string")
            flag = value.strip()
            if flag not in _MODEL_SAFETY_FLAGS:
                raise ModelOutputError("model safety flag is unsupported")
            if flag not in flags:
                flags.append(flag)
        return ParsedModelOutput(answer=answer, confidence_score=confidence_score, safety_flags=flags)


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ModelOutputError("model output contains duplicate keys")
        result[key] = value
    return result


def _strict_confidence_score(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise ModelOutputError("model confidence score must be numeric")
    parsed = float(value)
    if not math.isfinite(parsed) or not 0.0 <= parsed <= 1.0:
        raise ModelOutputError("model confidence score is out of range")
    return parsed


def decimal_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)
