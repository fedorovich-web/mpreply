from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.base import ProviderMessageContext
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api.partner.market.yandex.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _context(message_type: MessageType) -> ProviderMessageContext:
    return ProviderMessageContext(
        message_type=message_type,
        external_id="123",
        marketplace_created_at=datetime(2026, 9, 14, 8, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_yandex_validation_requires_write_scope_and_proves_business_access() -> None:
    transport = SequenceTransport(
        [
            response(
                200,
                json={
                    "status": "OK",
                    "result": {"apiKey": {"name": "Synthetic", "authScopes": ["COMMUNICATION"]}},
                },
            ),
            response(200, json={"status": "OK", "result": {"feedbacks": [], "paging": {}}}),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(
            "synthetic-key",
            "42",
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.scopes == (
        "reviews:read",
        "reviews:write",
        "questions:read",
        "questions:write",
    )
    assert [request.url.path for request in transport.requests] == [
        "/v2/auth/token",
        "/v2/businesses/42/goods-feedback",
    ]
    assert transport.requests[0].headers["Api-Key"] == "synthetic-key"
    assert "synthetic-key" not in str(transport.requests[0].url)
    assert transport.requests[1].read() == b'{"reactionStatus":"NEED_REACTION"}'


@pytest.mark.asyncio
async def test_yandex_question_page_uses_business_scoped_cursor_contract() -> None:
    transport = SequenceTransport(
        [
            response(
                200,
                json={
                    "status": "OK",
                    "result": {
                        "questions": [],
                        "paging": {"nextPageToken": "next-page"},
                    },
                },
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-key",
            "42",
            MarketplaceStream.QUESTIONS,
            "current-page",
        )

    assert result.ok is True
    assert result.data is not None and result.data.next_cursor == "next-page"
    request = transport.requests[0]
    assert request.url.path == "/v1/businesses/42/goods-questions"
    assert dict(request.url.params) == {"limit": "50", "pageToken": "current-page"}
    assert request.read() == b'{"needAnswer":true}'


@pytest.mark.asyncio
async def test_yandex_question_send_requires_documented_answer_receipt() -> None:
    transport = SequenceTransport([response(200, json={"status": "OK", "result": {"entity": {"id": 81, "type": "ANSWER"}}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-key",
            "42",
            _context(MessageType.QUESTION),
            "Synthetic answer",
        )

    assert result.ok is True
    assert result.data is not None and result.data.provider_reply_id == "81"
    assert transport.requests[0].read() == (b'{"operationType":"CREATE","parentEntityId":{"id":123,"type":"QUESTION"},"text":"Synthetic answer"}')


@pytest.mark.asyncio
async def test_yandex_nonpublished_seller_answer_blocks_duplicate_write() -> None:
    payload: dict[str, object] = {
        "status": "OK",
        "result": {
            "answers": [
                {
                    "id": 91,
                    "status": "UNMODERATED",
                    "canModify": True,
                    "author": dict[str, object](),
                }
            ],
            "paging": {},
        },
    }
    transport = SequenceTransport(
        [
            response(
                200,
                json=payload,
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).find_existing_reply(
            "synthetic-key",
            "42",
            _context(MessageType.QUESTION),
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.exists is True
    assert result.data.provider_reply_id == "91"
    assert result.data.provider_state == "unmoderated"


@pytest.mark.asyncio
async def test_yandex_write_timeout_is_not_retried() -> None:
    request = httpx.Request("POST", f"{BASE_URL}/v2/businesses/42/goods-feedback/comments/update")
    transport = SequenceTransport([httpx.WriteTimeout("synthetic timeout", request=request)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await YandexMarketAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-key",
            "42",
            _context(MessageType.REVIEW),
            "Synthetic answer",
        )

    assert result.error_code == "network_timeout"
    assert len(transport.requests) == 1


@pytest.mark.asyncio
async def test_yandex_rejects_error_envelopes_and_repeated_page_tokens() -> None:
    transport = SequenceTransport(
        [
            response(200, json={"status": "ERROR", "errors": [{"message": "must not escape"}]}),
            response(
                200,
                json={
                    "status": "OK",
                    "result": {"feedbacks": [], "paging": {"nextPageToken": "same"}},
                },
            ),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = YandexMarketAdapter(client, read_retry_policy=NO_RETRY)
        api_error = await adapter.fetch_page("synthetic-key", "42", MarketplaceStream.REVIEWS, None)
        repeated = await adapter.fetch_page("synthetic-key", "42", MarketplaceStream.REVIEWS, "same")

    assert api_error.error_code == "marketplace_validation_error"
    assert "must not escape" not in repr(api_error)
    assert repeated.error_code == "malformed_payload"
