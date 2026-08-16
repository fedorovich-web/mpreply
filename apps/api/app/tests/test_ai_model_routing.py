from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.customer_message import CustomerMessage
from app.models.product import Product
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.providers.openrouter import LLMCompletion, LLMUsage, OpenRouterProviderError
from app.schemas.ai import AIDraftGenerateRequest
from app.services.ai_service import AIService
from app.services.llm_route_resolver import LLMModelRoutes, LLMRuntimeConfiguration
from app.services.seller_settings_service import SellerPromptSettings


class _Session:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.flush_count = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


class _MessageService:
    def __init__(self, message: CustomerMessage, product: Product | None) -> None:
        self.message = message
        self.product = product

    async def get_message(self, *, actor: User, message_id: UUID) -> tuple[CustomerMessage, Product | None]:
        assert message_id == self.message.id
        return self.message, self.product


class _OrganizationService:
    async def require_membership_role(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        allowed_roles: set[str],
    ) -> object:
        return object()


class _PlanLimits:
    async def enforce_ai_draft_limit(self, *, organization_id: UUID) -> None:
        return None


class _InstructionSets:
    async def resolve_for_account(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
    ) -> SellerPromptSettings:
        return SellerPromptSettings()


class _KnowledgeEntries:
    async def context_for_message(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
        product_id: UUID | None,
    ) -> str | None:
        return None


class _ConfigurationService:
    def __init__(self) -> None:
        self.runtime = LLMRuntimeConfiguration(
            api_key="sk-or-v1-runtime-key",
            source="database",
            routes=LLMModelRoutes(
                review_model="approved/review",
                negative_review_model="approved/negative",
                question_model="approved/question",
                chat_model="approved/chat",
                safety_retry_model="approved/safety",
                fallback_model="approved/fallback",
            ),
        )

    async def resolve_runtime(self) -> LLMRuntimeConfiguration:
        return self.runtime


class _Provider:
    def __init__(self, results: list[LLMCompletion | OpenRouterProviderError]) -> None:
        self.results = results
        self.models: list[str] = []

    async def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 600,
        provider_order: list[str] | None = None,
        allow_fallbacks: bool = True,
    ) -> LLMCompletion:
        self.models.append(model)
        if not self.results:
            raise AssertionError("Unexpected provider call")
        result = self.results.pop(0)
        if isinstance(result, OpenRouterProviderError):
            raise result
        return result


class _ProviderFactory:
    def __init__(self, provider: _Provider) -> None:
        self.provider = provider
        self.keys: list[str] = []

    def __call__(self, api_key: str) -> _Provider:
        self.keys.append(api_key)
        return self.provider


def _actor() -> User:
    return User(
        id=uuid4(),
        email="manager@example.com",
        name="Manager",
        password_hash="hashed",
        status="active",
    )


def _message(*, message_type: str = "review", rating: int | None = 5) -> CustomerMessage:
    now = datetime(2026, 8, 16, 12, 0, tzinfo=UTC)
    return CustomerMessage(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        product_id=uuid4(),
        marketplace="wildberries",
        external_id="message-1",
        type=message_type,
        status="needs_reply",
        rating=rating,
        customer_text="Подскажите по товару",
        customer_photos_json=[],
        marketplace_created_at=now,
        imported_at=now,
        last_synced_at=now,
        priority="normal",
        metadata_json={},
    )


def _product(message: CustomerMessage) -> Product:
    return Product(
        id=cast(UUID, message.product_id),
        organization_id=message.organization_id,
        marketplace_account_id=message.marketplace_account_id,
        marketplace=message.marketplace,
        external_id="product-1",
        sku="SKU-1",
        name="Товар",
        metadata_json={},
    )


def _completion(
    *,
    model: str,
    answer: str = "Спасибо за обращение.",
    confidence: float = 0.95,
    flags: list[str] | None = None,
    prompt_tokens: int = 10,
    completion_tokens: int = 5,
    cost: str = "0.10",
    latency_ms: int = 100,
) -> LLMCompletion:
    return LLMCompletion(
        text=json.dumps(
            {"answer": answer, "confidence_score": confidence, "safety_flags": flags or []},
            ensure_ascii=False,
        ),
        model=model,
        usage=LLMUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost=Decimal(cost),
        ),
        latency_ms=latency_ms,
        raw_response={},
    )


def _service(
    *,
    message: CustomerMessage,
    provider: _Provider,
    product: Product | None,
) -> tuple[AIService, _Session, _ProviderFactory]:
    session = _Session()
    factory = _ProviderFactory(provider)
    service = AIService(
        cast(AsyncSession, session),
        configuration_service=_ConfigurationService(),
        provider_factory=factory,
        message_service=_MessageService(message, product),
        organization_service=_OrganizationService(),
        plan_limits=_PlanLimits(),
        instruction_sets=_InstructionSets(),
        knowledge_entries=_KnowledgeEntries(),
    )
    return service, session, factory


def test_public_generate_request_rejects_arbitrary_model_override() -> None:
    with pytest.raises(ValidationError):
        AIDraftGenerateRequest.model_validate({"message_id": str(uuid4()), "model": "attacker/override"})


@pytest.mark.parametrize(
    ("message_type", "rating", "expected_model"),
    [
        ("review", 1, "approved/negative"),
        ("review", 2, "approved/negative"),
        ("review", 3, "approved/review"),
        ("review", None, "approved/review"),
        ("question", None, "approved/question"),
        ("chat", None, "approved/chat"),
    ],
)
async def test_generate_draft_uses_the_admin_approved_scenario_route(
    message_type: str,
    rating: int | None,
    expected_model: str,
) -> None:
    message = _message(message_type=message_type, rating=rating)
    provider = _Provider([_completion(model=expected_model)])
    service, _, factory = _service(message=message, provider=provider, product=_product(message))

    draft = await service.generate_draft(actor=_actor(), message_id=message.id)

    assert provider.models == [expected_model]
    assert factory.keys == ["sk-or-v1-runtime-key"]
    assert draft.model == expected_model


async def test_transient_failure_uses_fallback_as_the_only_second_attempt() -> None:
    message = _message(message_type="question", rating=None)
    provider = _Provider(
        [
            OpenRouterProviderError("temporary", error_code="openrouter_timeout"),
            _completion(model="approved/fallback", confidence=0.5, flags=["needs_manual_review"]),
        ]
    )
    service, session, _ = _service(message=message, provider=provider, product=_product(message))

    draft = await service.generate_draft(actor=_actor(), message_id=message.id)

    assert provider.models == ["approved/question", "approved/fallback"]
    assert draft.model == "approved/fallback"
    audit = next(value for value in session.added if isinstance(value, AuditLog))
    assert audit.metadata_json["attempt_count"] == 2


async def test_quality_retry_selects_safer_candidate_and_aggregates_successful_usage() -> None:
    message = _message()
    provider = _Provider(
        [
            _completion(
                model="approved/review",
                answer="Напишите нам: test@example.com",
                flags=["personal_data_exposure"],
            ),
            _completion(
                model="approved/safety",
                answer="Уточните, пожалуйста, детали в обращении на маркетплейсе.",
                prompt_tokens=20,
                completion_tokens=10,
                cost="0.20",
                latency_ms=200,
            ),
        ]
    )
    service, session, _ = _service(message=message, provider=provider, product=_product(message))

    draft = await service.generate_draft(actor=_actor(), message_id=message.id)

    assert provider.models == ["approved/review", "approved/safety"]
    assert draft.model == "approved/safety"
    assert draft.tokens_input == 30
    assert draft.tokens_output == 15
    assert draft.cost_estimate == Decimal("0.30")
    assert draft.latency_ms == 300
    assert message.status == "ai_draft_ready"
    usage = next(value for value in session.added if isinstance(value, UsageEvent))
    assert usage.quantity == 45


async def test_failed_quality_retry_retains_the_first_valid_completion() -> None:
    message = _message()
    provider = _Provider(
        [
            _completion(model="approved/review", confidence=0.5),
            OpenRouterProviderError("temporary", error_code="openrouter_timeout"),
        ]
    )
    service, _, _ = _service(message=message, provider=provider, product=_product(message))

    draft = await service.generate_draft(actor=_actor(), message_id=message.id)

    assert provider.models == ["approved/review", "approved/safety"]
    assert draft.model == "approved/review"
    assert draft.tokens_input == 10
    assert draft.tokens_output == 5
    assert draft.cost_estimate == Decimal("0.10")
    assert draft.latency_ms == 100
    assert message.status == "needs_manual_check"


async def test_missing_product_context_alone_does_not_trigger_quality_retry() -> None:
    message = _message()
    provider = _Provider([_completion(model="approved/review")])
    service, _, _ = _service(message=message, provider=provider, product=None)

    draft = await service.generate_draft(actor=_actor(), message_id=message.id)

    assert provider.models == ["approved/review"]
    assert draft.safety_flags_json == ["missing_product_context"]
    assert message.status == "needs_manual_check"
