from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.base import MarketplacePage, NormalizedMessage, NormalizedProduct
from app.models.enums import MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.providers.groq import GroqProvider, LLMUsage, ProductResearch
from app.services import product_research_service
from app.services.marketplace_ingest_service import MarketplaceIngestService
from app.services.product_research_service import ProductResearchService
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits", "synthetic_encryption_key"]


async def test_concurrent_research_performs_one_search_with_no_database_lock_during_http(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        product_id = message.product_id
    entered, release = asyncio.Event(), asyncio.Event()

    async def search(**_: object) -> ProductResearch:
        entered.set()
        async with asyncio.timeout(5):
            # A second session can acquire the product row lock during provider I/O.
            async with postgres_credits() as concurrent:
                row = await concurrent.scalar(select(Product).where(Product.id == product_id).with_for_update())
                assert row is not None
                await concurrent.commit()
            await release.wait()
        return ProductResearch([{"url": "https://parts.example/tp123", "title": "TP123", "excerpt": "Test product TP123"}],
                               "search-test", LLMUsage(1, 2, 3, None), 1)

    mock = AsyncMock(side_effect=search)
    monkeypatch.setattr(GroqProvider, "research_product", mock)

    async def ensure() -> bool:
        async with postgres_credits() as session:
            product = await session.get(Product, product_id)
            assert product is not None
            return (await ProductResearchService(session).ensure(product=product, provider=GroqProvider(api_key="test"))).verified

    first = asyncio.create_task(ensure())
    await asyncio.wait_for(entered.wait(), timeout=5)
    second = asyncio.create_task(ensure())
    await asyncio.sleep(0.1)
    release.set()
    assert await asyncio.gather(first, second) == [True, True]
    assert mock.await_count == 1


async def test_absolute_research_timeout_cancels_slow_provider_and_coalesces_review_result(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        product_id = message.product_id
    entered, cancelled = asyncio.Event(), asyncio.Event()
    monkeypatch.setattr(product_research_service, "RESEARCH_TIMEOUT_SECONDS", 0.05)

    async def slow(**_: object) -> ProductResearch:
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()
        raise AssertionError("unreachable")

    search = AsyncMock(side_effect=slow)
    monkeypatch.setattr(GroqProvider, "research_product", search)

    async def ensure() -> bool:
        async with postgres_credits() as session:
            product = await session.get(Product, product_id)
            assert product is not None
            run = await ProductResearchService(session).ensure(product=product, provider=GroqProvider(api_key="test"))
            assert run.error_code == "groq_timeout"
            return run.verified

    async with asyncio.timeout(3):
        first = asyncio.create_task(ensure())
        await entered.wait()
        second = asyncio.create_task(ensure())
        assert await asyncio.gather(first, second) == [False, False]
    assert cancelled.is_set() and search.await_count == 1


@pytest.mark.parametrize("changed", [False, True])
async def test_marketplace_refresh_retains_only_research_for_same_product(
    postgres_credits: async_sessionmaker[AsyncSession], changed: bool,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        product = await session.get(Product, message.product_id)
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert product is not None and account is not None
        product.metadata_json = {"web_research": {"status": "verified", "sources": []}}
        await session.commit()
        normalized = NormalizedProduct(external_id=product.external_id, sku=product.sku,
                                       name="Different TP124" if changed else product.name, brand=product.brand,
                                       category=None, image_url=None, product_url=None,
                                       metadata={"web_research": {"status": "forged"}})
        now = datetime.now(UTC)
        record = NormalizedMessage(external_id=message.external_id, message_type=MessageType.QUESTION,
                                   rating=None, customer_display_name=None, customer_text="Question",
                                   customer_photos=(), marketplace_created_at=now, product=normalized)
        await MarketplaceIngestService(session).ingest_page(account, MarketplacePage(items=(record,), next_cursor=None), now)
        assert ("web_research" in product.metadata_json) is not changed
        if not changed:
            assert cast(dict[str, object], product.metadata_json["web_research"])["status"] == "verified"


