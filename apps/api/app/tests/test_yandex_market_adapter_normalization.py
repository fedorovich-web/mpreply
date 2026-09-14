from __future__ import annotations

from datetime import datetime

import httpx
import pytest

from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api.partner.market.yandex.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _review() -> dict[str, object]:
    return {
        "feedbackId": 991,
        "createdAt": "2026-09-14T10:15:00+03:00",
        "needReaction": True,
        "author": "Synthetic buyer",
        "identifiers": {"offerId": "SKU-42"},
        "description": {
            "advantages": "Compact",
            "disadvantages": "None",
            "comment": "Useful product",
        },
        "media": {"photos": [{"url": "https://example.test/photo.jpg"}]},
        "statistics": {"rating": 5},
    }


@pytest.mark.asyncio
async def test_yandex_review_normalization_preserves_data_without_fake_product_copy() -> None:
    transport = SequenceTransport(
        [
            response(
                200,
                json={"status": "OK", "result": {"feedbacks": [_review()], "paging": {}}},
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-key",
            "42",
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.ok is True
    assert result.data is not None
    message = result.data.items[0]
    assert message.message_type is MessageType.REVIEW
    assert message.customer_text == "Useful product\nAdvantages: Compact\nDisadvantages: None"
    assert message.marketplace_created_at == datetime.fromisoformat("2026-09-14T10:15:00+03:00")
    assert message.product is not None
    assert message.product.external_id == "SKU-42"
    assert message.product.name is None
    assert message.customer_photos == ("https://example.test/photo.jpg",)


@pytest.mark.parametrize(
    "record",
    [
        {**_review(), "feedbackId": 0},
        {**_review(), "createdAt": "not-a-date"},
        {**_review(), "needReaction": False},
        {**_review(), "identifiers": {}},
        {**_review(), "description": {"comment": ""}},
        {**_review(), "statistics": {"rating": 6}},
    ],
)
@pytest.mark.asyncio
async def test_yandex_review_page_fails_closed_on_invalid_record(record: dict[str, object]) -> None:
    transport = SequenceTransport(
        [
            response(
                200,
                json={"status": "OK", "result": {"feedbacks": [record], "paging": {}}},
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-key",
            "42",
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_yandex_question_requires_real_offer_identity() -> None:
    question = {
        "questionIdentifiers": {"id": 77},
        "businessId": 42,
        "text": "Synthetic question",
        "createdAt": "2026-09-14T07:00:00Z",
        "author": {"name": "Synthetic buyer", "type": "USER"},
    }
    transport = SequenceTransport(
        [
            response(
                200,
                json={"status": "OK", "result": {"questions": [question], "paging": {}}},
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-key",
            "42",
            MarketplaceStream.QUESTIONS,
            None,
        )

    assert result.error_code == "malformed_payload"
