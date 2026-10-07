from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import cast
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.customer_message import CustomerMessage
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.user import User
from app.providers.groq import GroqProvider, GroqProviderError, LLMCompletion, LLMUsage, ProductResearch, public_source_url
from app.services.ai_service import AIService
from app.services.automatic_draft_service import AutomaticDraftService
from app.services.demo_workspace_service import ensure_demo_workspace
from app.services.product_research_service import ProductResearchService, product_identity, source_matches_product
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_ai_credit_generation import VALID_COMPLETION
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits import credit_session_factory

__all__ = ["synthetic_encryption_key"]


@pytest.mark.parametrize("confirmed", [False, True])
async def test_compatibility_draft_uses_confirmed_fit_or_requests_marking_without_inventing_inventory(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, confirmed: bool,
) -> None:
    monkeypatch.setattr(GroqProvider, "research_product", AsyncMock(return_value=ProductResearch(
        [{"url": "https://parts.example/tp123", "title": "Test product TP123",
          "excerpt": "Test product TP123 fits HCE63" if confirmed else "Test product TP123"}],
        "search-test", LLMUsage(1, 1, 2, None), 1,
    )))
    writer_answer = "Деталь TP123 подходит для HCE63." if confirmed else "Нет датчика. Обратитесь в сервисный центр."
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=LLMCompletion(
        json.dumps({"answer": writer_answer, "confidence_score": 0.99, "safety_flags": []}),
        "writer-test", LLMUsage(1, 1, 2, None), 1,
    )))
    async with research_db() as session:
        message = await seed(session)
        message.customer_text = "Подойдёт к HCE63?"
        actor = await session.scalar(select(User).join(OrganizationUser, OrganizationUser.user_id == User.id)
                                     .where(OrganizationUser.organization_id == message.organization_id))
        assert actor is not None
        await session.commit()
        draft = await AIService(session).generate_draft(actor=actor, message_id=message.id, operation_key=uuid4())
        assert "HCE63" in draft.draft_text
        assert "нет датчика" not in draft.draft_text and "сервисный центр" not in draft.draft_text
        if confirmed:
            assert draft.draft_text == writer_answer and not draft.safety_flags_json
            assert message.status == "ai_draft_ready"
        else:
            assert "маркировки" in draft.draft_text
            assert {"missing_product_context", "needs_manual_review"}.issubset(draft.safety_flags_json)
            assert message.status == "needs_manual_check"
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert balance.consumed == 1 and balance.reserved == 0


def search_response(request: httpx.Request, *, evidence: bool = True) -> httpx.Response:
    return httpx.Response(200, request=request, json={
        "model": "openai/gpt-oss-20b",
        "choices": [{"message": {
            "content": "Haier 0530023778, diameter 180 mm. https://invented.example/fake",
            "executed_tools": [{"type": "browser_search", "browser_results": [{
                "title": "Haier 0530023778", "url": "https://parts.example/0530023778",
                "content": "Haier 0530023778 electric hotplate, diameter 180 mm.",
            }]}] if evidence else [],
        }}],
        "usage": {"prompt_tokens": 50, "completion_tokens": 30, "total_tokens": 80},
    })


@pytest.mark.asyncio
async def test_research_forces_browser_search_without_structured_output_and_uses_tool_sources() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["model"] == "openai/gpt-oss-20b"
        assert payload["tools"] == [{"type": "browser_search"}]
        assert payload["tool_choice"] == "required"
        assert "response_format" not in payload
        assert "customer_text" not in request.content.decode()
        return search_response(request)

    result = await GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler)).research_product(
        name="Haier electric hotplate 0530023778", sku="0530023778", brand="Haier",
    )
    assert len(result.sources) == 1
    assert result.sources[0]["url"] == "https://parts.example/0530023778"
    assert "invented.example" not in json.dumps(result.sources)


@pytest.mark.asyncio
async def test_research_does_not_treat_model_written_links_as_search_evidence() -> None:
    result = await GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(
        lambda request: search_response(request, evidence=False),
    )).research_product(name="Haier 0530023778", sku="0530023778", brand="Haier")
    assert result.sources == []


@pytest.fixture
async def research_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.mark.asyncio
@pytest.mark.parametrize("evidence", [True, False])
async def test_manual_research_cached_per_product_one_credit_per_draft_and_uncertainty_requires_review(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, evidence: bool,
) -> None:
    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(
        lambda request: search_response(request, evidence=evidence),
    ))
    search = AsyncMock(side_effect=provider.research_product)
    monkeypatch.setattr(GroqProvider, "research_product", search)
    writer = AsyncMock(return_value=VALID_COMPLETION)
    monkeypatch.setattr(GroqProvider, "complete", writer)
    async with research_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        product = Product(organization_id=message.organization_id, marketplace_account_id=message.marketplace_account_id,
                          marketplace=message.marketplace, external_id="research-test", name="Haier electric hotplate 0530023778",
                          sku="0530023778", brand="Haier", metadata_json={})
        session.add(product)
        await session.flush()
        message.product_id = product.id
        await ReplyCreditService(session).grant(organization_id=message.organization_id, source_key="trial-research",
                                               kind="trial", quantity=3, expires_at=datetime.now(UTC) + timedelta(days=14))
        await session.commit()
        service = AIService(session)
        key = uuid4()
        first = await service.generate_draft(actor=actor, message_id=message.id, operation_key=key)
        replay = await service.generate_draft(actor=actor, message_id=message.id, operation_key=key)
        second = await service.generate_draft(actor=actor, message_id=message.id, operation_key=uuid4())
        assert first.id == replay.id and second.id != first.id
        assert search.await_count == 1 and writer.await_count == 2
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert balance.consumed == 2 and balance.reserved == 0
        assert ("missing_product_context" in first.safety_flags_json) is not evidence
        if evidence:
            assert "180 mm" in writer.call_args_list[0].kwargs["messages"][1]["content"]
            assert first.tokens_input == 60 and first.tokens_output == 40
            assert second.tokens_input == 10 and second.tokens_output == 10
        assert cast(dict[str, object], product.metadata_json["web_research"])["status"] == ("verified" if evidence else "not_found")


@pytest.mark.parametrize("url", ["http://product.example", "https://localhost/", "https://127.0.0.1/",
                                  "https://169.254.169.254/", "https://u:p@product.example/", "javascript:alert(1)"])
def test_research_rejects_non_public_sources(url: str) -> None:
    assert not public_source_url(url)


def test_similar_product_model_is_not_accepted_as_exact_evidence() -> None:
    product = Product(name="Haier D180 electric hotplate 0530023778", sku="supplier-sku-1", brand="Haier")
    assert not source_matches_product({"title": "Haier 0530023779", "excerpt": "D180 electric hotplate"}, product)
    assert source_matches_product({"title": "Haier 0530023778", "excerpt": "180 mm electric hotplate"}, product)


def test_exact_oem_product_name_does_not_require_reseller_brand_in_manufacturer_source() -> None:
    product = Product(name="Haier electric hotplate 0530023778", sku="supplier-sku-1", brand="ZIP-R")
    assert source_matches_product({"title": "Haier electric hotplate 0530023778", "excerpt": "180 mm hotplate"}, product)
    assert not source_matches_product({"title": "Haier electric hotplate 0530023779", "excerpt": "180 mm hotplate"}, product)
    assert not source_matches_product({"title": "Other hotplate 0530023778", "excerpt": "180 mm hotplate"}, product)


@pytest.mark.asyncio
async def test_search_keeps_product_facts_after_long_page_navigation() -> None:
    content = ("Navigation and menus. " * 300) + "Haier 0530023778 compatible with HCE63. Diameter 180 mm."
    payload: dict[str, object] = {"choices": [{"message": {"executed_tools": [{"browser_results": [{
        "title": "Haier 0530023778", "url": "https://parts.example/0530023778", "content": content,
    }]}]}}]}
    sources = GroqProvider.extract_research_sources(payload)
    assert "compatible with HCE63" in sources[0]["excerpt"]


@pytest.mark.parametrize("question,models", [
    ("Compatible with Indesit w 84 TX?", ("W84TX",)),
    ("Compatible with Haier CEF535ASG?", ("CEF535ASG",)),
    ("For Beko WB6108SE, old belt EL1269 J5?", ("WB6108SE", "EL1269J5")),
    ("My email is w84tx@example.com, phone +79991234567. Compatible with Haier CEF535ASG?", ("CEF535ASG",)),
    ("Good product, 5 stars!", ()),
    ("Номер заказа AB123456, подойдёт к W84TX?", ("W84TX",)),
    ("Мой Telegram ivan123, подходит к CEF535ASG?", ("CEF535ASG",)),
    ("Логин owner123 пароль secret987. Подойдёт к W84TX?", ("W84TX",)),
    ("My order number AB123456. Compatible with W84TX?", ("W84TX",)),
    ("For contact use ivan123, compatible with W84TX?", ("W84TX",)),
    ("Fits W84TX order number is AB123456", ("W84TX",)),
    ("Для связи ivan123, подойдёт к W84TX?", ("W84TX",)),
])
def test_compatibility_search_extracts_model_identifiers_without_customer_contacts(question: str, models: tuple[str, ...]) -> None:
    from app.services.product_research_service import compatibility_models
    assert compatibility_models(question) == models


async def test_compatibility_cache_is_specific_to_target_model_and_prompt_ignores_other_targets(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    search = AsyncMock(return_value=ProductResearch(
        [{"url": "https://parts.example/0530023778", "title": "Haier 0530023778", "excerpt": "Haier 0530023778 for HCE63"}],
        "search-test", LLMUsage(1, 1, 2, None), 1,
    ))
    monkeypatch.setattr(GroqProvider, "research_product", search)
    async with research_db() as session:
        message = await seed(session)
        product = await session.get(Product, message.product_id)
        assert product is not None
        product.name, product.sku, product.brand = "Haier 0530023778", "0530023778", "Haier"
        await session.commit()
        service = ProductResearchService(session)
        provider = GroqProvider(api_key="test")
        first = await service.ensure(product=product, provider=provider, models=("HCE63",))
        assert first.verified
        original_prompt = AIService.product_context(product, customer_text="Compatible with HCE63?")
        assert (await service.ensure(product=product, provider=provider, models=("HCE63",))).cached
        await service.ensure(product=product, provider=provider, models=("HCE64",))
        assert search.await_count == 2
        assert AIService.product_context(product, customer_text="Compatible with HCE63?") == original_prompt
        assert search.call_args_list[0].kwargs["compatibility_models"] == ("HCE63",)


@pytest.mark.parametrize("live", [False, True])
async def test_full_compatibility_cache_evicts_only_completed_or_expired_leases(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, live: bool,
) -> None:
    from fastapi import HTTPException
    search = AsyncMock(return_value=ProductResearch(
        [{"url": "https://parts.example/tp123", "title": "Test product TP123", "excerpt": "Test product TP123 for HCE63"}],
        "search-test", LLMUsage(1, 1, 2, None), 1,
    ))
    monkeypatch.setattr(GroqProvider, "research_product", search)
    async with research_db() as session:
        message = await seed(session)
        product = await session.get(Product, message.product_id)
        assert product is not None
        expiry = datetime.now(UTC) + timedelta(minutes=1) if live else datetime.now(UTC) - timedelta(minutes=1)
        product.metadata_json = {"web_compatibility_research": {str(index): {
            "status": "pending", "lease_until": expiry.isoformat(), "identity": product_identity(product),
        } for index in range(16)}}
        await session.commit()
        service = ProductResearchService(session)
        if live:
            with pytest.raises(HTTPException) as exc:
                await service.ensure(product=product, provider=GroqProvider(api_key="test"), models=("HCE63",))
            assert exc.value.status_code == 409 and search.await_count == 0
        else:
            assert (await service.ensure(product=product, provider=GroqProvider(api_key="test"), models=("HCE63",))).verified
            assert len(cast(dict[str, object], product.metadata_json["web_compatibility_research"])) == 16


@pytest.mark.parametrize("name,source", [
    ("Samsung Galaxy A55 SM-A556 5000mAh", "Samsung Galaxy A54 SM-A546 5000mAh"),
    ("Haier 0530023778", "Haier 05300237780"),
    ("Apple iPhone 13", "Apple iPhone 14"),
])
def test_capacity_or_longer_article_cannot_substitute_for_exact_model(name: str, source: str) -> None:
    assert not source_matches_product({"title": source, "excerpt": source}, Product(name=name, sku=None, brand=None))


@pytest.mark.parametrize("name,brand,source,expected", [
    ("Apple iPhone 13 Pro", "Apple", "Apple iPhone 13", False),
    ("Apple iPhone 13 Pro", "Apple", "Apple iPhone 13 Pro", True),
    ("Samsung Galaxy A55", "Samsung", "OPPO A55", False),
    ("Samsung Galaxy A55", "Samsung", "Samsung Galaxy A55", True),
])
def test_exact_number_does_not_override_brand_or_model_variant(name: str, brand: str, source: str, expected: bool) -> None:
    assert source_matches_product({"title": source, "excerpt": "Product specifications"},
                                  Product(name=name, sku=None, brand=brand)) is expected


@pytest.mark.asyncio
async def test_changed_product_identity_invalidates_research_cache(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(search_response))
    search = AsyncMock(side_effect=provider.research_product)
    monkeypatch.setattr(provider, "research_product", search)
    async with research_db() as session:
        actor = await ensure_demo_workspace(session)
        message = await session.scalar(select(CustomerMessage))
        assert actor and message
        product = Product(organization_id=message.organization_id, marketplace_account_id=message.marketplace_account_id,
                          marketplace=message.marketplace, external_id="changed-research", name="Haier 0530023778", sku="0530023778")
        session.add(product)
        await session.commit()
        service = ProductResearchService(session)
        assert (await service.ensure(product=product, provider=provider)).verified
        first_identity = product_identity(product)
        product.name, product.sku = "Haier 0530023779", "0530023779"
        await session.commit()
        assert not (await service.ensure(product=product, provider=provider)).verified
        assert product_identity(product) != first_identity and search.await_count == 2


async def test_unconfirmed_brand_keeps_found_sources_for_review_and_reuses_search(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(search_response))
    search = AsyncMock(side_effect=provider.research_product)
    monkeypatch.setattr(provider, "research_product", search)
    async with research_db() as session:
        message = await seed(session)
        product = await session.get(Product, message.product_id)
        assert product is not None
        product.name, product.sku, product.brand = "Different manufacturer 0530023778", "0530023778", "Seller brand"
        await session.commit()
        service = ProductResearchService(session)
        first = await service.ensure(product=product, provider=provider)
        second = await service.ensure(product=product, provider=provider)
        assert not first.verified and not second.verified and second.cached and search.await_count == 1
        data = cast(dict[str, object], product.metadata_json["web_research"])
        assert data["status"] == "needs_review" and data["sources"]


@pytest.mark.parametrize("mode,evidence,expected", [
    ("auto", True, "auto_reply_pending"), ("auto", False, "waiting_review"),
    ("semi_auto", True, "waiting_review"), ("semi_auto", False, "waiting_review"),
])
async def test_automatic_answers_research_product_and_never_auto_send_without_evidence(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
    mode: str, evidence: bool, expected: str,
) -> None:
    search = AsyncMock(return_value=ProductResearch(
        sources=[{"url": "https://parts.example/tp123", "title": "TP123", "excerpt": "Test product TP123"}] if evidence else [],
        model="search-test", usage=LLMUsage(2, 3, 5, None), latency_ms=1,
    ))
    monkeypatch.setattr(GroqProvider, "research_product", search)
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    async with research_db() as session:
        message = await seed(session, mode)
        service = AutomaticDraftService(session)
        assert await service.discover(limit=25) == 1
        claims = await service.claim_due(now=datetime.now(UTC), limit=25)
        assert len(claims) == 1
        await service.process(job_id=claims[0][0], token=claims[0][1])
        await session.refresh(message)
        assert message.status == expected and search.await_count == 1
        assert (await ReplyCreditService(session).balance(organization_id=message.organization_id)).consumed == 1


async def test_search_provider_failure_is_recorded_and_forces_review(
    research_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(GroqProvider, "research_product", AsyncMock(side_effect=GroqProviderError(
        "provider unavailable", error_code="groq_unavailable",
    )))
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    async with research_db() as session:
        message = await seed(session, "auto")
        service = AutomaticDraftService(session)
        await service.discover(limit=25)
        claims = await service.claim_due(now=datetime.now(UTC), limit=25)
        await service.process(job_id=claims[0][0], token=claims[0][1])
        await session.refresh(message)
        assert message.status == "waiting_review"
        product = await session.get(Product, message.product_id)
        assert product is not None
        stored = cast(dict[str, object], product.metadata_json["web_research"])
        assert stored["status"] == "error" and stored["error_code"] == "groq_unavailable"
