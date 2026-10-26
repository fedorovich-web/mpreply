from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import SecretStr, ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.services.ai_service as ai_service
from app.models.ai_draft import AIDraft
from app.models.audit_log import AuditLog
from app.models.customer_message import CustomerMessage
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.usage_event import UsageEvent
from app.providers.groq import GroqProvider, ProductResearch
from app.providers.llm import LLMCompletion, LLMUsage
from app.providers.openrouter import OpenRouterProvider, OpenRouterProviderError
from app.schemas.ai import AIDraftGenerateRequest
from app.services.ai_service import AIService
from app.services.demo_workspace_service import ensure_demo_workspace
from app.services.llm_route_resolver import select_reply_model
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_reply_credits import credit_session_factory


@pytest.fixture
async def credit_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


def configure_provider(monkeypatch: pytest.MonkeyPatch, provider: str) -> None:
    monkeypatch.setattr(ai_service, "get_settings", lambda: SimpleNamespace(
        ai_reply_provider=provider, groq_api_key=SecretStr("synthetic-groq-key"),
        groq_base_url="https://api.groq.com/openai/v1", groq_timeout_seconds=45.0,
        groq_default_model="groq-configured-model", openrouter_api_key=SecretStr("synthetic-openrouter-key"),
        openrouter_timeout_seconds=45.0,
    ))


def completion(model: str) -> LLMCompletion:
    return LLMCompletion(
        text='{"answer":"Thank you for your feedback.","confidence_score":0.9,"safety_flags":[]}',
        model=model, usage=LLMUsage(10, 20, 30, Decimal("0.001")), latency_ms=7,
    )


@pytest.mark.parametrize(("rating", "expected"), [
    (1, "anthropic/claude-sonnet-5.5"), (2, "anthropic/claude-sonnet-5.5"),
    (3, "deepseek/deepseek-v4.1-flash"), (5, "deepseek/deepseek-v4.1-flash"),
    (None, "deepseek/deepseek-v4.1-flash"),
])
def test_review_routing_uses_low_rating_boundary(rating: int | None, expected: str) -> None:
    assert select_reply_model("review", rating) == expected


def test_request_token_cap_can_be_omitted_or_explicitly_bounded() -> None:
    request = AIDraftGenerateRequest(message_id=uuid4(), operation_key=uuid4())
    assert request.max_tokens is None
    assert request.model_copy(update={"max_tokens": 600}).max_tokens == 600
    for cap in (120, 600, 2048, 4096):
        assert AIDraftGenerateRequest(message_id=uuid4(), operation_key=uuid4(), max_tokens=cap).max_tokens == cap
    for cap in (119, 4097):
        with pytest.raises(ValidationError):
            AIDraftGenerateRequest(message_id=uuid4(), operation_key=uuid4(), max_tokens=cap)


@pytest.mark.asyncio
@pytest.mark.parametrize(("provider_name", "message_type", "rating", "selected_model", "actual_model"), [
    ("groq", "review", 1, "groq-configured-model", "groq-actual-model"),
    ("openrouter", "review", 5, "deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash"),
    ("openrouter", "review", None, "deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash"),
    ("openrouter", "review", 2, "anthropic/claude-sonnet-5.5", "anthropic/claude-sonnet-5.5"),
    ("openrouter", "question", None, "openai/gpt-6-luna", "openai/gpt-6-luna"),
    ("openrouter", "chat", None, "google/gemini-3.8-flash", "google/gemini-3.8-flash"),
])
async def test_generation_routes_reply_and_persists_actual_provenance_without_replaying_provider(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
    provider_name: str, message_type: str, rating: int | None, selected_model: str, actual_model: str,
) -> None:
    configure_provider(monkeypatch, provider_name)
    groq_complete = AsyncMock(return_value=completion(actual_model))
    routed_complete = AsyncMock(return_value=completion(actual_model))
    monkeypatch.setattr(GroqProvider, "complete", groq_complete)
    monkeypatch.setattr(OpenRouterProvider, "complete", routed_complete)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        message.type, message.rating = message_type, rating
        await ReplyCreditService(session).grant(
            organization_id=message.organization_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        operation_key = uuid4()
        service = AIService(session)
        draft = await service.generate_draft(actor=actor, message_id=message.id, operation_key=operation_key)
        resolved_cap = 600 if provider_name == "groq" else 2048
        replay = await service.generate_draft(actor=actor, message_id=message.id, operation_key=operation_key, max_tokens=resolved_cap)
        assert draft.id == replay.id
        assert (draft.provider, draft.model) == (provider_name, actual_model)
        assert (draft.tokens_input, draft.tokens_output, draft.latency_ms) == (10, 20, 7)
        chosen, other = (groq_complete, routed_complete) if provider_name == "groq" else (routed_complete, groq_complete)
        assert chosen.await_count == 1
        assert chosen.call_args is not None and chosen.call_args.kwargs["model"] == selected_model
        assert chosen.call_args.kwargs["max_tokens"] == resolved_cap
        other.assert_not_awaited()
        generated = await session.scalar(select(AuditLog).where(AuditLog.action == "ai_draft.generated"))
        usage = await session.scalar(select(UsageEvent).where(UsageEvent.event_type == "ai_draft.generated"))
        assert generated is not None and usage is not None
        assert generated.metadata_json["provider"] == provider_name
        assert generated.metadata_json["model"] == actual_model
        assert generated.metadata_json["selected_model"] == selected_model
        assert cast(dict[str, object], generated.metadata_json["product_research"])["provider"] == "groq"
        if provider_name == "openrouter":
            assert draft.cost_estimate is None
            assert generated.metadata_json["completion_usage"] == {
                "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30, "cost": "0.001",
            }
            research_metadata = cast(dict[str, object], generated.metadata_json["product_research"])
            assert research_metadata["cached"] is False and research_metadata["error_code"] == "product_identity_missing"
            assert research_metadata["usage"] == {
                "prompt_tokens": None, "completion_tokens": None, "total_tokens": None, "cost": None,
            }
        assert usage.metadata_json["provider"] == provider_name and usage.metadata_json["model"] == actual_model
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.reserved, balance.consumed) == (0, 1)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("message_type", ["unsupported", "", "Review"])
async def test_unknown_message_type_never_calls_a_reply_provider_or_consumes_credit(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, message_type: str,
) -> None:
    configure_provider(monkeypatch, "openrouter")
    groq_complete, routed_complete = AsyncMock(return_value=completion("unexpected")), AsyncMock(return_value=completion("unexpected"))
    monkeypatch.setattr(GroqProvider, "complete", groq_complete)
    monkeypatch.setattr(OpenRouterProvider, "complete", routed_complete)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role, message.type = "manager", message_type
        organization_id, message_id = message.organization_id, message.id
        await ReplyCreditService(session).grant(
            organization_id=organization_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        with pytest.raises(HTTPException) as failed:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4())
        assert failed.value.status_code == 400
        groq_complete.assert_not_awaited()
        routed_complete.assert_not_awaited()
        balance = await ReplyCreditService(session).balance(organization_id=organization_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["provider", "malformed"])
async def test_openrouter_failure_releases_credit_without_fallback_or_reusing_failed_operation(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, failure: str,
) -> None:
    configure_provider(monkeypatch, "openrouter")
    routed_complete = AsyncMock(
        return_value=LLMCompletion("invalid", "deepseek/deepseek-v4.1-flash", LLMUsage(1, 1, 2, Decimal("0.001")), 1),
        side_effect=OpenRouterProviderError("Synthetic failure", error_code="openrouter_timeout") if failure == "provider" else None,
    )
    groq_complete = AsyncMock(return_value=completion("unexpected-fallback"))
    monkeypatch.setattr(GroqProvider, "complete", groq_complete)
    monkeypatch.setattr(OpenRouterProvider, "complete", routed_complete)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        organization_id, message_id = message.organization_id, message.id
        await ReplyCreditService(session).grant(
            organization_id=organization_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        operation_key = uuid4()
        service = AIService(session)
        with pytest.raises(HTTPException) as failed:
            await service.generate_draft(actor=actor, message_id=message_id, operation_key=operation_key)
        assert failed.value.status_code == 502
        await session.refresh(actor)
        with pytest.raises(HTTPException) as replay:
            await service.generate_draft(actor=actor, message_id=message_id, operation_key=operation_key)
        assert replay.value.status_code == 410
        assert routed_complete.await_count == 1
        groq_complete.assert_not_awaited()
        balance = await ReplyCreditService(session).balance(organization_id=organization_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0
        failure_audit = await session.scalar(select(AuditLog).where(AuditLog.action == "ai_draft.failed"))
        assert failure_audit is not None
        assert failure_audit.metadata_json == {
            "provider": "openrouter", "error_code": "openrouter_timeout" if failure == "provider" else "openrouter_malformed_response",
        }


@pytest.mark.asyncio
async def test_openrouter_reply_keeps_product_research_on_groq_and_combines_usage(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_provider(monkeypatch, "openrouter")
    research = AsyncMock(return_value=ProductResearch(
        sources=[{"url": "https://example.com/product", "title": "Bosch ABC123", "excerpt": "Bosch ABC123 specifications"}],
        model="groq-research-model", usage=LLMUsage(30, 40, 70, Decimal("0.002")), latency_ms=5,
    ))
    groq_complete = AsyncMock(return_value=completion("unexpected-fallback"))
    routed_complete = AsyncMock(return_value=completion("openai/gpt-6-luna"))
    monkeypatch.setattr(GroqProvider, "research_product", research)
    monkeypatch.setattr(GroqProvider, "complete", groq_complete)
    monkeypatch.setattr(OpenRouterProvider, "complete", routed_complete)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role, message.type = "manager", "question"
        product = Product(
            organization_id=message.organization_id, marketplace_account_id=message.marketplace_account_id,
            marketplace=message.marketplace, external_id="routed-research-product", name="Bosch ABC123", brand="Bosch",
        )
        session.add(product)
        await session.flush()
        message.product_id = product.id
        await ReplyCreditService(session).grant(
            organization_id=message.organization_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        draft = await AIService(session).generate_draft(actor=actor, message_id=message.id, operation_key=uuid4())
        assert draft.provider == "openrouter" and draft.model == "openai/gpt-6-luna"
        assert (draft.tokens_input, draft.tokens_output, draft.latency_ms) == (40, 60, 12)
        assert draft.cost_estimate == Decimal("0.003")
        research.assert_awaited_once()
        groq_complete.assert_not_awaited()
        assert routed_complete.await_count == 1
        generated = await session.scalar(select(AuditLog).where(AuditLog.action == "ai_draft.generated"))
        assert generated is not None
        research_metadata = cast(dict[str, object], generated.metadata_json["product_research"])
        assert research_metadata["provider"] == "groq" and research_metadata["verified"] is True
        assert research_metadata["usage"] == {
            "prompt_tokens": 30, "completion_tokens": 40, "total_tokens": 70, "cost": "0.002",
        }


@pytest.mark.asyncio
@pytest.mark.parametrize(("rating", "cap", "allowed"), [(5, 600, True), (1, 600, False), (2, 1024, False), (2, 1025, True)])
async def test_explicit_token_cap_is_preserved_or_rejected_before_research(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, rating: int, cap: int, allowed: bool,
) -> None:
    configure_provider(monkeypatch, "openrouter")
    model = "deepseek/deepseek-v4.1-flash" if rating == 5 else "anthropic/claude-sonnet-5.5"
    routed_complete = AsyncMock(return_value=completion(model))
    groq_complete = AsyncMock(return_value=completion("unexpected-fallback"))
    research = AsyncMock(return_value=ProductResearch([], "groq-research", LLMUsage(1, 1, 2, Decimal("0.001")), 1))
    monkeypatch.setattr(GroqProvider, "complete", groq_complete)
    monkeypatch.setattr(GroqProvider, "research_product", research)
    monkeypatch.setattr(OpenRouterProvider, "complete", routed_complete)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role, message.type, message.rating = "manager", "review", rating
        organization_id, message_id = message.organization_id, message.id
        if not allowed:
            product = Product(
                organization_id=organization_id, marketplace_account_id=message.marketplace_account_id,
                marketplace=message.marketplace, external_id="rejected-token-product", name="Bosch ABC123", brand="Bosch",
            )
            session.add(product)
            await session.flush()
            message.product_id = product.id
        await ReplyCreditService(session).grant(
            organization_id=organization_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        if allowed:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4(), max_tokens=cap)
            assert routed_complete.call_args is not None and routed_complete.call_args.kwargs["max_tokens"] == cap
        else:
            with pytest.raises(HTTPException) as rejected:
                await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4(), max_tokens=cap)
            assert rejected.value.status_code == 400
            routed_complete.assert_not_awaited()
            balance = await ReplyCreditService(session).balance(organization_id=organization_id)
            assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        research.assert_not_awaited()
        groq_complete.assert_not_awaited()
