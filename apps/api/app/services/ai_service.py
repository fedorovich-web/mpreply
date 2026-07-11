from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import ResponseTone, build_marketplace_reply_prompt
from app.core.config import get_settings
from app.core.errors import bad_request, not_found
from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.product import Product
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.providers.openrouter import OpenRouterProvider, OpenRouterProviderError
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput
from app.services.audit_service import AuditService
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService

_ALLOWED_ROLES = {"owner", "admin", "manager"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}


@dataclass(frozen=True)
class ParsedModelOutput:
    answer: str
    confidence_score: float
    safety_flags: list[str]


class AIService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.message_service = MessageService(session)
        self.organization_service = OrganizationService(session)
        self.plan_limits = PlanLimitService(session)
        self.safety_gate = SafetyGate()

    async def generate_draft(
        self,
        *,
        actor: User,
        message_id: UUID,
        tone: ResponseTone = "neutral",
        model: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 600,
        brand_rules: str | None = None,
        knowledge_base: str | None = None,
    ) -> AIDraft:
        message, product = await self.message_service.get_message(actor=actor, message_id=message_id)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_ROLES,
        )
        if not message.customer_text.strip():
            raise bad_request("Message has no customer text")

        await self.plan_limits.enforce_ai_draft_limit(organization_id=message.organization_id)

        settings = get_settings()
        prompt = build_marketplace_reply_prompt(
            marketplace=message.marketplace,
            message_type=message.type,
            customer_text=message.customer_text,
            rating=message.rating,
            product=self._product_context(product),
            tone=tone,
            brand_rules=brand_rules,
            knowledge_base=knowledge_base,
        )
        provider = OpenRouterProvider(
            api_key=settings.openrouter_api_key.get_secret_value(),
            base_url=settings.openrouter_base_url,
            site_url=settings.public_site_url,
            app_title=settings.app_name,
            timeout_seconds=settings.openrouter_timeout_seconds,
        )
        selected_model = model or settings.openrouter_default_model
        try:
            completion = await provider.complete(
                model=selected_model,
                messages=prompt.messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except OpenRouterProviderError as exc:
            if selected_model != settings.openrouter_fallback_model and exc.error_code in {
                "openrouter_rate_limited",
                "openrouter_unavailable",
                "openrouter_timeout",
                "openrouter_network_error",
            }:
                completion = await provider.complete(
                    model=settings.openrouter_fallback_model,
                    messages=prompt.messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:
                await self._write_failure_audit(actor=actor, message=message, error_code=exc.error_code)
                raise bad_request(str(exc)) from exc

        parsed = self._parse_model_output(completion.text)
        safety = self.safety_gate.evaluate(
            SafetyInput(
                draft_text=parsed.answer,
                confidence_score=parsed.confidence_score,
                message_type=message.type,
                rating=message.rating,
                has_product_context=product is not None,
                model_flags=parsed.safety_flags,
            )
        )
        flags = safety.flags
        draft = AIDraft(
            organization_id=message.organization_id,
            message_id=message.id,
            provider="openrouter",
            model=completion.model,
            prompt_version=prompt.version,
            prompt_input_hash=prompt.input_hash,
            draft_text=parsed.answer,
            tokens_input=completion.usage.prompt_tokens,
            tokens_output=completion.usage.completion_tokens,
            latency_ms=completion.latency_ms,
            cost_estimate=completion.usage.cost,
            confidence_score=parsed.confidence_score,
            safety_flags_json=flags,
            created_by=actor.id,
        )
        self.session.add(draft)
        status_by_decision = {
            SafetyDecision.ALLOW: "ai_draft_ready",
            SafetyDecision.MANUAL_REVIEW: "needs_manual_check",
            SafetyDecision.BLOCK: "safety_blocked",
        }
        message.status = status_by_decision[safety.decision]
        await self._write_usage(actor=actor, message=message, draft=draft, total_tokens=completion.usage.total_tokens)
        await self.audit.write(
            action="ai_draft.generated",
            entity_type="ai_draft",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata={
                "provider": "openrouter",
                "model": completion.model,
                "prompt_version": prompt.version,
                "latency_ms": completion.latency_ms,
                "safety_decision": safety.decision.value,
                "safety_flags": flags,
                "safety_reasons": safety.reasons,
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
        result = await self.session.execute(select(AIDraft).where(AIDraft.id == draft_id))
        draft = result.scalar_one_or_none()
        if draft is None:
            raise not_found("AI draft not found")
        await self.organization_service.require_membership_role(
            organization_id=draft.organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
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

    async def _write_failure_audit(self, *, actor: User, message: CustomerMessage, error_code: str) -> None:
        await self.audit.write(
            action="ai_draft.failed",
            entity_type="customer_message",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata={"provider": "openrouter", "error_code": error_code},
        )

    @staticmethod
    def _product_context(product: Product | None) -> dict[str, Any] | None:
        if product is None:
            return None
        return {
            "name": product.name,
            "sku": product.sku,
            "brand": product.brand,
            "category": product.category,
            "external_id": product.external_id,
            "metadata": product.metadata_json or {},
        }

    @staticmethod
    def _parse_model_output(raw_text: str) -> ParsedModelOutput:
        try:
            parsed: object = json.loads(raw_text)
        except json.JSONDecodeError:
            parsed = {"answer": raw_text, "confidence_score": 0.72, "safety_flags": ["needs_manual_review"]}
        data = cast(dict[str, object], parsed) if isinstance(parsed, dict) else {}
        answer = str(data.get("answer") or "").strip()
        if not answer:
            raise bad_request("AI provider returned an empty answer")
        confidence_score = _float_between_zero_and_one(data.get("confidence_score"))
        raw_flags_value = data.get("safety_flags")
        raw_flags = cast(list[object], raw_flags_value) if isinstance(raw_flags_value, list) else []
        flags = [str(flag).strip() for flag in raw_flags if str(flag).strip()]
        return ParsedModelOutput(answer=answer, confidence_score=confidence_score, safety_flags=flags)


def _float_between_zero_and_one(value: object) -> float:
    if isinstance(value, bool):
        parsed = float(value)
    elif isinstance(value, int | float | str):
        try:
            parsed = float(value)
        except ValueError:
            return 0.75
    else:
        return 0.75
    return min(max(parsed, 0.0), 1.0)


def decimal_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)
