from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.base import ProviderMessageContext
from app.adapters.http import ReadRetryPolicy
from app.adapters.ozon import OzonAdapter
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api-seller.ozon.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _context(message_type: MessageType) -> ProviderMessageContext:
    return ProviderMessageContext(
        message_type=message_type,
        external_id="message-123",
        marketplace_created_at=datetime(2026, 9, 14, 6, tzinfo=UTC),
        metadata={"sku": 646399170},
    )


@pytest.mark.asyncio
async def test_ozon_question_preflight_and_send_use_exact_contracts() -> None:
    transport = SequenceTransport(
        [
            response(200, json={"answers": [], "last_id": ""}),
            response(200, json={"answer_id": "answer-123"}),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = OzonAdapter(client, read_retry_policy=NO_RETRY)
        preflight = await adapter.find_existing_reply(
            "synthetic-api-key",
            "100200",
            _context(MessageType.QUESTION),
        )
        sent = await adapter.send_reply(
            "synthetic-api-key",
            "100200",
            _context(MessageType.QUESTION),
            "Synthetic answer",
        )

    assert preflight.ok is True
    assert preflight.data is not None and preflight.data.exists is False
    assert sent.ok is True
    assert sent.data is not None and sent.data.provider_reply_id == "answer-123"
    assert [request.url.path for request in transport.requests] == [
        "/v1/question/answer/list",
        "/v1/question/answer/create",
    ]
    assert transport.requests[0].read() == (b'{"question_id":"message-123","sku":646399170,"last_id":""}')
    assert transport.requests[1].read() == (b'{"question_id":"message-123","sku":646399170,"text":"Synthetic answer"}')


@pytest.mark.asyncio
async def test_ozon_write_timeout_is_single_attempt_and_has_no_synthetic_receipt() -> None:
    request = httpx.Request("POST", f"{BASE_URL}/v1/review/comment/create")
    transport = SequenceTransport([httpx.WriteTimeout("synthetic timeout", request=request)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-api-key",
            "100200",
            _context(MessageType.REVIEW),
            "Synthetic answer",
        )

    assert result.ok is False
    assert result.error_code == "network_timeout"
    assert result.data is None
    assert len(transport.requests) == 1


@pytest.mark.asyncio
async def test_ozon_malformed_write_success_fails_closed() -> None:
    transport = SequenceTransport([response(200, json={"unexpected": True})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-api-key",
            "100200",
            _context(MessageType.REVIEW),
            "Synthetic answer",
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
