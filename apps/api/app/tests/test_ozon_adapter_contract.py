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
        "status": "UNPROCESSED",
        "text": "Synthetic review",
        "rating": 2,
        "published_at": "2026-09-14T06:00:00Z",
        "sku": "148591503",
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
    transport = SequenceTransport(
        [response(200, json={"questions": [_question()], "has_next": False, "last_id": ""})]
    )
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
    assert transport.requests[0].read() == (
        b'{"filter":{"status":"ALL"},"limit":100,'
        b'"last_id":"current-question","sort_dir":"ASC"}'
    )


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
