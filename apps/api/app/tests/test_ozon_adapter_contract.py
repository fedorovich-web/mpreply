from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.adapters.ozon import OzonAdapter
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api-seller.ozon.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _review() -> dict[str, object]:
    return {
        "id": "review-123",
        "status": "NEW",
        "text": "Synthetic review",
        "rating": 2,
        "published_at": "2026-09-14T06:00:00Z",
        "sku": "148591503",
        "comments_amount": 0,
        "photos_amount": 0,
        "videos_amount": 0,
        "order_status": "DELIVERED",
        "is_rating_participant": True,
    }


def _question() -> dict[str, object]:
    return {
        "id": "question-123",
        "status": "UNPROCESSED",
        "answers_count": 0,
        "text": "Synthetic question",
        "author_name": "Synthetic buyer",
        "published_at": "2026-09-14T06:10:00Z",
        "product_url": "https://www.ozon.ru/product/synthetic-123/",
        "sku": 654321,
    }


@pytest.mark.asyncio
async def test_ozon_review_page_uses_exact_cursor_contract_without_fabricating_product_name() -> None:
    transport = SequenceTransport(
        [
            response(
                200,
                json={"reviews": [_review()], "has_next": True, "last_id": "next-review"},
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-api-key",
            "100200",
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.next_cursor == "next-review"
    message = result.data.items[0]
    assert message.message_type is MessageType.REVIEW
    assert message.rating == 2
    assert message.marketplace_created_at == datetime(2026, 9, 14, 6, tzinfo=UTC)
    assert message.product is not None
    assert message.product.name is None
    assert message.metadata["sku"] == 148591503
    assert message.product.external_id == "148591503"
    assert transport.requests[0].read() == b'{"limit":100,"sort_dir":"ASC"}'


@pytest.mark.asyncio
async def test_ozon_question_page_uses_exact_body_and_nullable_product_fields() -> None:
    transport = SequenceTransport([response(200, json={"questions": [_question()], "has_next": False, "last_id": ""})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-api-key",
            "100200",
            MarketplaceStream.QUESTIONS,
            "current-question",
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.next_cursor is None
    assert result.data.items[0].customer_display_name == "Synthetic buyer"
    assert transport.requests[0].read() == (b'{"filter":{"status":"ALL"},"limit":100,"last_id":"current-question","sort_dir":"ASC"}')


@pytest.mark.asyncio
async def test_ozon_review_page_imports_new_and_viewed_but_not_processed() -> None:
    reviews = [
        {**_review(), "id": "new-review", "status": "NEW"},
        {**_review(), "id": "viewed-review", "status": "VIEWED"},
        {**_review(), "id": "processed-review", "status": "PROCESSED"},
    ]
    transport = SequenceTransport([response(200, json={"reviews": reviews, "has_next": False, "last_id": ""})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-api-key", "100200", MarketplaceStream.REVIEWS, None)

    assert result.ok is True
    assert result.data is not None
    assert [item.external_id for item in result.data.items] == ["new-review", "viewed-review"]


@pytest.mark.asyncio
async def test_ozon_question_page_imports_unanswered_new_and_viewed_questions() -> None:
    questions = [
        {**_question(), "id": "new-question", "status": "NEW"},
        {**_question(), "id": "viewed-question", "status": "VIEWED"},
        {**_question(), "id": "unprocessed-question", "status": "UNPROCESSED"},
        {**_question(), "id": "answered-question", "status": "VIEWED", "answers_count": 1},
        {**_question(), "id": "processed-question", "status": "PROCESSED"},
    ]
    transport = SequenceTransport([response(200, json={"questions": questions, "has_next": False, "last_id": ""})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-api-key", "100200", MarketplaceStream.QUESTIONS, None)

    assert result.ok is True
    assert result.data is not None
    assert [item.external_id for item in result.data.items] == ["new-question", "viewed-question", "unprocessed-question"]


@pytest.mark.asyncio
async def test_ozon_review_page_keeps_media_only_review_and_skips_rating_only_review() -> None:
    reviews = [
        {**_review(), "id": "photo-review", "status": "NEW", "text": "", "photos_amount": 1, "videos_amount": 0},
        {**_review(), "id": "rating-only", "status": "NEW", "text": "", "photos_amount": 0, "videos_amount": 0},
    ]
    transport = SequenceTransport([response(200, json={"reviews": reviews, "has_next": False, "last_id": ""})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-api-key", "100200", MarketplaceStream.REVIEWS, None)

    assert result.ok is True
    assert result.data is not None
    assert [item.external_id for item in result.data.items] == ["photo-review"]
    assert result.data.items[0].customer_text == ""


@pytest.mark.parametrize(
    "payload",
    [
        {"reviews": {}, "has_next": False, "last_id": ""},
        {"reviews": [_review()], "has_next": "false", "last_id": ""},
        {"reviews": [{**_review(), "sku": True}], "has_next": False, "last_id": ""},
        {"reviews": [{**_review(), "sku": "0"}], "has_next": False, "last_id": ""},
        {"reviews": [{**_review(), "sku": "123.5"}], "has_next": False, "last_id": ""},
        {"reviews": [_review()], "has_next": True, "last_id": "same"},
    ],
)
@pytest.mark.asyncio
async def test_ozon_review_page_rejects_malformed_success(payload: dict[str, object]) -> None:
    transport = SequenceTransport([response(200, json=payload)])
    cursor = "same" if payload.get("last_id") == "same" else None
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-api-key",
            "100200",
            MarketplaceStream.REVIEWS,
            cursor,
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
