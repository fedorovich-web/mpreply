from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Protocol, cast
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompt_strategy import ResponseTone, build_marketplace_reply_prompt
from app.core.config import Settings, get_settings
from app.core.errors import bad_request, not_found
from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.product import Product
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.providers.openrouter import LLMCompletion, OpenRouterProvider, OpenRouterProviderError
from app.safety.safety_gate import SafetyDecision, SafetyGate, SafetyInput, SafetyResult
from app.services.ai_instruction_set_service import AIInstructionSetService
from app.services.audit_service import AuditService
from app.services.knowledge_entry_service import KnowledgeEntryService
from app.services.llm_configuration_service import LLMConfigurationService
from app.services.llm_route_resolver import LLMConfigurationError, LLMRouteResolver, LLMRuntimeConfiguration
from app.services.message_service import MessageService
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService
from app.services.seller_settings_service import SellerPromptSettings

_ALLOWED_ROLES = {"owner", "admin", "manager"}
_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_TRANSIENT_PROVIDER_ERRORS = {
    "openrouter_rate_limited",
    "openrouter_unavailable",
    "openrouter_timeout",
    "openrouter_network_error",
}
_QUALITY_RETRY_FLAGS = {
    "low_confidence",
    "risky_promise",
    "medical_or_legal_claim",
    "unclear_customer_issue",
    "needs_manual_review",
    "sensitive_topic",
    "seller_prohibited_phrase",
    "unsafe_instruction",
    "personal_data_exposure",
    "policy_violation",
}


@dataclass(frozen=True)
class ParsedModelOutput:
    answer: str
    confidence_score: float
    safety_flags: list[str]


@dataclass(frozen=True)
class GenerationCandidate:
    completion: LLMCompletion
    parsed: ParsedModelOutput
    safety: SafetyResult


class _RuntimeConfiguration(Protocol):
    async def resolve_runtime(self) -> LLMRuntimeConfiguration: ...


class _CompletionClient(Protocol):
    async def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 600,
        provider_order: list[str] | None = None,
        allow_fallbacks: bool = True,
    ) -> LLMCompletion: ...


class _MessageReader(Protocol):
    async def get_message(self, *, actor: User, message_id: UUID) -> tuple[CustomerMessage, Product | None]: ...


class _OrganizationAuthorizer(Protocol):
    async def require_membership_role(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        allowed_roles: set[str],
    ) -> object: ...


class _PlanLimits(Protocol):
    async def enforce_ai_draft_limit(self, *, organization_id: UUID) -> None: ...


class _InstructionResolver(Protocol):
    async def resolve_for_account(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
    ) -> SellerPromptSettings: ...


class _KnowledgeResolver(Protocol):
    async def context_for_message(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
        product_id: UUID | None,
    ) -> str | None: ...


class AIService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        configuration_service: _RuntimeConfiguration | None = None,
        provider_factory: Callable[[str], _CompletionClient] | None = None,
        message_service: _MessageReader | None = None,
        organization_service: _OrganizationAuthorizer | None = None,
        plan_limits: _PlanLimits | None = None,
        instruction_sets: _InstructionResolver | None = None,
        knowledge_entries: _KnowledgeResolver | None = None,
        safety_gate: SafetyGate | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.settings = settings or get_settings()
        self.configuration_service = configuration_service or LLMConfigurationService(
            session,
            settings=self.settings,
        )
        self.provider_factory = provider_factory or self._default_provider
        self.message_service = message_service or MessageService(session)
        self.organization_service = organization_service or OrganizationService(session)
        self.plan_limits = plan_limits or PlanLimitService(session)
        self.instruction_sets = instruction_sets or AIInstructionSetService(session)
        self.knowledge_entries = knowledge_entries or KnowledgeEntryService(session)
        self.safety_gate = safety_gate or SafetyGate()

    async def generate_draft(
        self,
        *,
        actor: User,
        message_id: UUID,
        tone: ResponseTone | None = None,
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

        prompt_settings = await self.instruction_sets.resolve_for_account(
            organization_id=message.organization_id,
            marketplace_account_id=message.marketplace_account_id,
        )
        resolved_tone, resolved_brand_rules = prompt_settings.resolve_policy(
            tone_override=tone,
            brand_rules_override=brand_rules,
        )
        structured_knowledge = await self.knowledge_entries.context_for_message(
            organization_id=message.organization_id,
            marketplace_account_id=message.marketplace_account_id,
            product_id=message.product_id,
        )
        resolved_knowledge = knowledge_base.strip() if knowledge_base is not None and knowledge_base.strip() else structured_knowledge

        prompt = build_marketplace_reply_prompt(
            marketplace=message.marketplace,
            message_type=message.type,
            customer_text=message.customer_text,
            rating=message.rating,
            product=self._product_context(product),
            tone=resolved_tone,
            seller_policy=resolved_brand_rules,
            seller_knowledge=resolved_knowledge,
        )
        try:
            runtime = await self.configuration_service.resolve_runtime()
        except LLMConfigurationError as exc:
            await self._write_failure_audit(actor=actor, message=message, error_code=exc.error_code)
            raise bad_request("AI provider is not configured") from exc

        provider = self.provider_factory(runtime.api_key)
        selected_model = LLMRouteResolver.select_model(
            runtime.routes,
            message_type=message.type,
            rating=message.rating,
        )
        used_fallback = False
        attempted_models = [selected_model]
        try:
            completion = await provider.complete(
                model=selected_model,
                messages=prompt.messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except OpenRouterProviderError as exc:
            if selected_model != runtime.routes.fallback_model and exc.error_code in _TRANSIENT_PROVIDER_ERRORS:
                used_fallback = True
                attempted_models.append(runtime.routes.fallback_model)
                try:
                    completion = await provider.complete(
                        model=runtime.routes.fallback_model,
                        messages=prompt.messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                except OpenRouterProviderError as fallback_exc:
                    await self._write_failure_audit(
                        actor=actor,
                        message=message,
                        error_code=fallback_exc.error_code,
                    )
                    raise bad_request(str(fallback_exc)) from fallback_exc
            else:
                await self._write_failure_audit(actor=actor, message=message, error_code=exc.error_code)
                raise bad_request(str(exc)) from exc

        first_candidate = self._candidate(
            completion=completion,
            message=message,
            product=product,
            prompt_settings=prompt_settings,
        )
        successful_completions = [completion]
        selected_candidate = first_candidate
        if (
            not used_fallback
            and selected_model != runtime.routes.safety_retry_model
            and set(first_candidate.safety.flags).intersection(_QUALITY_RETRY_FLAGS)
        ):
            attempted_models.append(runtime.routes.safety_retry_model)
            try:
                retry_completion = await provider.complete(
                    model=runtime.routes.safety_retry_model,
                    messages=prompt.messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                successful_completions.append(retry_completion)
                retry_candidate = self._candidate(
                    completion=retry_completion,
                    message=message,
                    product=product,
                    prompt_settings=prompt_settings,
                )
                selected_candidate = self._select_candidate(first_candidate, retry_candidate)
            except (HTTPException, OpenRouterProviderError):
                selected_candidate = first_candidate

        completion = selected_candidate.completion
        parsed = selected_candidate.parsed
        safety = selected_candidate.safety
        flags = safety.flags
        tokens_input = self._sum_optional_int(
            [item.usage.prompt_tokens for item in successful_completions]
        )
        tokens_output = self._sum_optional_int(
            [item.usage.completion_tokens for item in successful_completions]
        )
        total_tokens = self._sum_optional_int(
            [item.usage.total_tokens for item in successful_completions]
        )
        cost_estimate = self._sum_optional_decimal(
            [item.usage.cost for item in successful_completions]
        )
        latency_ms = sum(item.latency_ms for item in successful_completions)
        draft = AIDraft(
            organization_id=message.organization_id,
            message_id=message.id,
            provider="openrouter",
            model=completion.model,
            prompt_version=prompt.version,
            prompt_input_hash=prompt.input_hash,
            draft_text=parsed.answer,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            latency_ms=latency_ms,
            cost_estimate=cost_estimate,
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
        await self._write_usage(actor=actor, message=message, draft=draft, total_tokens=total_tokens)
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
                "latency_ms": latency_ms,
                "attempt_count": len(attempted_models),
                "safety_decision": safety.decision.value,
                "safety_flags": flags,
                "safety_reasons": safety.reasons,
                "instruction_set_applied": prompt_settings.has_customizations,
            },
        )
        await self.session.flush()
        return draft

    def _candidate(
        self,
        *,
        completion: LLMCompletion,
        message: CustomerMessage,
        product: Product | None,
        prompt_settings: SellerPromptSettings,
    ) -> GenerationCandidate:
        parsed = self._parse_model_output(completion.text)
        safety = self.safety_gate.evaluate(
            SafetyInput(
                draft_text=parsed.answer,
                confidence_score=parsed.confidence_score,
                message_type=message.type,
                rating=message.rating,
                has_product_context=product is not None,
                model_flags=[*parsed.safety_flags, *prompt_settings.policy_flags(parsed.answer)],
            )
        )
        return GenerationCandidate(completion=completion, parsed=parsed, safety=safety)

    @staticmethod
    def _select_candidate(first: GenerationCandidate, second: GenerationCandidate) -> GenerationCandidate:
        decision_rank = {
            SafetyDecision.BLOCK: 0,
            SafetyDecision.MANUAL_REVIEW: 1,
            SafetyDecision.ALLOW: 2,
        }
        first_rank = (decision_rank[first.safety.decision], first.parsed.confidence_score)
        second_rank = (decision_rank[second.safety.decision], second.parsed.confidence_score)
        return second if second_rank > first_rank else first

    @staticmethod
    def _sum_optional_int(values: list[int | None]) -> int | None:
        present = [value for value in values if value is not None]
        return sum(present) if present else None

    @staticmethod
    def _sum_optional_decimal(values: list[Decimal | None]) -> Decimal | None:
        present = [value for value in values if value is not None]
        return sum(present, start=Decimal(0)) if present else None

    def _default_provider(self, api_key: str) -> OpenRouterProvider:
        return OpenRouterProvider(
            api_key=api_key,
            base_url=self.settings.openrouter_base_url,
            site_url=self.settings.public_site_url,
            app_title=self.settings.app_name,
            timeout_seconds=self.settings.openrouter_timeout_seconds,
        )

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
