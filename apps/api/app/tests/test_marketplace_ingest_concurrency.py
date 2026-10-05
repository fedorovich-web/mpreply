from __future__ import annotations

import asyncio
from contextlib import AbstractAsyncContextManager
from datetime import UTC, datetime
from types import TracebackType
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import MarketplacePage, NormalizedMessage, NormalizedProduct
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.services.marketplace_ingest_service import (
    InvalidNormalizedRecord,
    MarketplaceIngestService,
)

NOW = datetime(2026, 9, 12, 14, 0, tzinfo=UTC)


class _Diagnostic:
    def __init__(self, constraint_name: str) -> None:
        self.constraint_name = constraint_name


class _UniqueViolation(Exception):
    def __init__(self, constraint_name: str) -> None:
        super().__init__(constraint_name)
        self.diag = _Diagnostic(constraint_name)


class _Savepoint(AbstractAsyncContextManager[None]):
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool:
        return False


class _SharedRecords:
    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.message: CustomerMessage | None = None
        self.product: Product | None = None


class _ConcurrentSession:
    def get_bind(self) -> Engine:
        return create_engine("sqlite://")

    def __init__(self, shared: _SharedRecords, *, constraint_name: str | None = None) -> None:
        self.shared = shared
        self.constraint_name = constraint_name
        self.pending: CustomerMessage | Product | None = None
        self.conflicted_model: type[CustomerMessage] | type[Product] | None = None

    def begin_nested(self) -> _Savepoint:
        return _Savepoint()

    def add(self, value: object) -> None:
        if not isinstance(value, CustomerMessage | Product):
            raise AssertionError("ingestion added an unexpected ORM model")
        value.id = uuid4()
        self.pending = value

    async def flush(self) -> None:
        if self.pending is None:
            raise AssertionError("flush called without a pending record")
        async with self.shared.lock:
            if isinstance(self.pending, Product) and self.shared.product is None:
                self.shared.product = self.pending
                self.pending = None
                return
            if isinstance(self.pending, CustomerMessage) and self.shared.message is None:
                self.shared.message = self.pending
                self.pending = None
                return
            self.conflicted_model = type(self.pending)
            expected_constraint = "uq_products_external" if isinstance(self.pending, Product) else "uq_customer_messages_external"
        raise IntegrityError(
            "INSERT marketplace record",
            {},
            _UniqueViolation(self.constraint_name or expected_constraint),
        )

    async def scalar(self, _: object) -> CustomerMessage | Product | None:
        if self.conflicted_model is Product:
            return self.shared.product
        if self.conflicted_model is CustomerMessage:
            return self.shared.message
        raise AssertionError("winner lookup occurred without a unique conflict")


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        display_name="Synthetic Avito",
        seller_id="42",
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        credentials_status="valid",
        scopes_json={},
    )


def _chat_page() -> MarketplacePage[NormalizedMessage]:
    return MarketplacePage(
        items=(
            NormalizedMessage(
                external_id="synthetic-message-1",
                message_type=MessageType.CHAT,
                rating=None,
                customer_display_name="Synthetic User",
                customer_text="Synthetic inbound message",
                customer_photos=(),
                marketplace_created_at=NOW,
                product=None,
                metadata={"source": "avito.chats", "chat_id": "synthetic-chat-1"},
            ),
        ),
        next_cursor=None,
    )


@pytest.mark.asyncio
async def test_concurrent_duplicate_message_has_a_single_insert_winner() -> None:
    shared = _SharedRecords()
    account = _account()

    async def ingest_once() -> tuple[int, int]:
        session = _ConcurrentSession(shared)
        result = await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(
            account,
            _chat_page(),
            NOW,
        )
        return result.created_messages, result.updated_messages

    results = await asyncio.gather(ingest_once(), ingest_once())

    assert sum(created for created, _ in results) == 1
    assert sum(updated for _, updated in results) == 1
    assert shared.message is not None
    assert shared.message.external_id == "synthetic-message-1"
    assert shared.message.product_id is None
    assert shared.product is None


@pytest.mark.asyncio
async def test_yandex_rating_only_review_is_ingested_without_fabricated_text() -> None:
    shared = _SharedRecords()
    account = _account()
    account.marketplace = Marketplace.YANDEX_MARKET.value
    product = NormalizedProduct(
        external_id="synthetic-sku",
        sku="synthetic-sku",
        name=None,
        brand=None,
        category=None,
        image_url=None,
        product_url=None,
    )
    review = NormalizedMessage(
        external_id="124",
        message_type=MessageType.REVIEW,
        rating=5,
        customer_display_name="Synthetic customer",
        customer_text="",
        customer_photos=(),
        marketplace_created_at=NOW,
        product=product,
    )

    result = await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(
        account, MarketplacePage(items=(review,), next_cursor=None), NOW
    )

    assert result.created_messages == 1
    assert shared.message is not None and shared.message.customer_text == ""
    assert shared.product is not None


@pytest.mark.asyncio
async def test_concurrent_duplicate_product_and_review_each_have_one_insert_winner() -> None:
    shared = _SharedRecords()
    account = _account()
    account.marketplace = Marketplace.WILDBERRIES.value
    product = NormalizedProduct(
        external_id="123",
        sku="SKU-1",
        name="Synthetic Product",
        brand="Synthetic Brand",
        category=None,
        image_url=None,
        product_url=None,
        metadata={"nm_id": 123},
    )
    page = MarketplacePage(
        items=(
            NormalizedMessage(
                external_id="synthetic-review-1",
                message_type=MessageType.REVIEW,
                rating=5,
                customer_display_name="Synthetic User",
                customer_text="Synthetic review",
                customer_photos=(),
                marketplace_created_at=NOW,
                product=product,
                metadata={"source": "wildberries.feedbacks"},
            ),
        ),
        next_cursor=None,
    )

    async def ingest_once() -> tuple[int, int, int, int]:
        result = await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(account, page, NOW)
        return (
            result.created_messages,
            result.updated_messages,
            result.created_products,
            result.updated_products,
        )

    results = await asyncio.gather(ingest_once(), ingest_once())

    assert sum(result[0] for result in results) == 1
    assert sum(result[1] for result in results) == 1
    assert sum(result[2] for result in results) == 1
    assert sum(result[3] for result in results) == 1
    assert shared.product is not None
    assert shared.message is not None
    assert shared.message.product_id == shared.product.id


@pytest.mark.asyncio
async def test_review_or_question_without_product_identity_is_rejected() -> None:
    session = _ConcurrentSession(_SharedRecords())
    account = _account()
    account.marketplace = Marketplace.WILDBERRIES.value
    message = _chat_page().items[0]
    invalid_review = NormalizedMessage(
        external_id=message.external_id,
        message_type=MessageType.REVIEW,
        rating=5,
        customer_display_name=message.customer_display_name,
        customer_text=message.customer_text,
        customer_photos=message.customer_photos,
        marketplace_created_at=message.marketplace_created_at,
        product=None,
        metadata=message.metadata,
    )

    with pytest.raises(InvalidNormalizedRecord, match="product identity"):
        await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(
            account,
            MarketplacePage(items=(invalid_review,), next_cursor=None),
            NOW,
        )


@pytest.mark.asyncio
async def test_unrelated_integrity_error_is_not_suppressed() -> None:
    session = _ConcurrentSession(_SharedRecords(), constraint_name="fk_unrelated")

    await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(
        _account(),
        _chat_page(),
        NOW,
    )

    with pytest.raises(IntegrityError):
        await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(
            _account(),
            _chat_page(),
            NOW,
        )


@pytest.mark.asyncio
async def test_avito_submission_verification_marker_survives_duplicate_review_sync() -> None:
    shared = _SharedRecords()
    account = _account()
    page = MarketplacePage(
        items=(
            NormalizedMessage(
                external_id="92312343",
                message_type=MessageType.REVIEW,
                rating=5,
                customer_display_name=None,
                customer_text="",
                customer_photos=(),
                marketplace_created_at=NOW,
                product=None,
                metadata={"source": "avito.reviews"},
            ),
        ),
        next_cursor=None,
    )
    await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(account, page, NOW)
    assert shared.message is not None
    shared.message.metadata_json = {**shared.message.metadata_json, "provider_publication": "unverified"}

    await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(account, page, NOW)

    assert shared.message.metadata_json["provider_publication"] == "unverified"


@pytest.mark.asyncio
async def test_wildberries_submission_verification_marker_survives_duplicate_question_sync() -> None:
    shared = _SharedRecords()
    account = _account()
    account.marketplace = Marketplace.WILDBERRIES.value
    page = MarketplacePage(
        items=(
            NormalizedMessage(
                external_id="question-1",
                message_type=MessageType.QUESTION,
                rating=None,
                customer_display_name=None,
                customer_text="Question about the product",
                customer_photos=(),
                marketplace_created_at=NOW,
                product=NormalizedProduct(
                    external_id="12345",
                    sku=None,
                    name="Synthetic product",
                    brand=None,
                    category=None,
                    image_url=None,
                    product_url=None,
                ),
                metadata={"source": "wildberries.questions", "status": "wbRu"},
            ),
        ),
        next_cursor=None,
    )
    await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(account, page, NOW)
    assert shared.message is not None
    shared.message.metadata_json = {**shared.message.metadata_json, "provider_publication": "unverified"}

    await MarketplaceIngestService(cast(AsyncSession, _ConcurrentSession(shared))).ingest_page(account, page, NOW)

    assert shared.message.metadata_json["provider_publication"] == "unverified"
