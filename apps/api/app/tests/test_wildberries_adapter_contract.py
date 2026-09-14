from __future__ import annotations

import base64
import json
from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.base import ProviderMessageContext
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.adapters.wildberries import WildberriesAdapter
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://feedbacks-api.wildberries.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _record(index: int = 1) -> dict[str, object]:
    return {
        "id": f"feedback-{index}",
        "text": "Synthetic feedback",
        "productValuation": 5,
        "createdDate": "2026-09-12T12:00:00Z",
        "productDetails": {
            "nmId": 1000 + index,
            "productName": f"Synthetic product {index}",
        },
    }


def _token(*, scope: int) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"s": scope}).encode()).decode().rstrip("=")
    return f"synthetic.{payload}.signature"


@pytest.mark.asyncio
async def test_wildberries_validation_requires_writable_feedback_scope() -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(
            _token(scope=(1 << 6) | (1 << 29)),
            None,
        )

    assert result.ok is False
    assert result.error_code == "insufficient_scope"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_wildberries_review_page_uses_exact_request_and_offset_contract() -> None:
    transport = SequenceTransport(
        [response(200, json={"data": {"feedbacks": [_record(index) for index in range(50)]}})]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.REVIEWS,
            "50",
        )

    assert result.ok is True
    assert result.data is not None
    assert len(result.data.items) == 50
    assert result.data.next_cursor == "100"
    request = transport.requests[0]
    assert request.method == "GET"
    assert request.url.path == "/api/v1/feedbacks"
    assert dict(request.url.params) == {"isAnswered": "false", "take": "50", "skip": "50"}
    assert request.headers["Authorization"] == "synthetic-token"


@pytest.mark.asyncio
async def test_wildberries_question_page_ends_when_provider_returns_less_than_page_size() -> None:
    question = _record()
    question["id"] = "question-1"
    question["question"] = question.pop("text")
    transport = SequenceTransport([response(200, json={"data": {"questions": [question]}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.QUESTIONS,
            None,
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.next_cursor is None
    assert result.data.items[0].message_type is MessageType.QUESTION
    assert transport.requests[0].url.path == "/api/v1/questions"


@pytest.mark.parametrize("cursor", ["-1", "+1", "1.0", " 1", "1 ", "050", "１２", "0" * 500, "1000001"])  # noqa: RUF001
@pytest.mark.asyncio
async def test_wildberries_rejects_invalid_cursor_before_transport(cursor: str) -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.REVIEWS,
            cursor,
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert transport.requests == []


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"data": []},
        {"data": {"feedbacks": {}}},
        {"data": {"feedbacks": [{"id": "missing-required-fields"}]}},
    ],
)
@pytest.mark.asyncio
async def test_wildberries_rejects_malformed_success_payload(payload: object) -> None:
    transport = SequenceTransport([response(200, json=payload)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert result.data is None


@pytest.mark.asyncio
async def test_wildberries_rejects_oversized_page() -> None:
    payload = {"data": {"feedbacks": [_record(index) for index in range(51)]}}
    transport = SequenceTransport([response(200, json=payload)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert result.data is None


@pytest.mark.parametrize(
    ("status_code", "error_code"),
    [
        (401, "invalid_credentials"),
        (403, "insufficient_scope"),
        (404, "marketplace_not_found"),
        (429, "rate_limited"),
        (503, "marketplace_unavailable"),
    ],
)
@pytest.mark.asyncio
async def test_wildberries_maps_provider_errors_without_body_leakage(
    status_code: int,
    error_code: str,
) -> None:
    transport = SequenceTransport(
        [
            response(
                status_code,
                json={"errorText": "synthetic-secret must never be exposed"},
                headers={"Retry-After": "11"},
            )
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page(
            "synthetic-token",
            None,
            MarketplaceStream.REVIEWS,
            None,
        )

    assert result.error_code == error_code
    assert "synthetic-secret" not in repr(result)
    assert result.retry_after_seconds == (11 if status_code == 429 else None)


@pytest.mark.asyncio
async def test_wildberries_existing_reply_preflight_uses_message_context() -> None:
    transport = SequenceTransport(
        [response(200, json={"data": {"id": "feedback-1", "answer": {"text": "Already answered"}}})]
    )
    context = ProviderMessageContext(
        message_type=MessageType.REVIEW,
        external_id="feedback-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).find_existing_reply(
            "synthetic-token",
            None,
            context,
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.exists is True
    assert transport.requests[0].url.path == "/api/v1/feedback"
    assert dict(transport.requests[0].url.params) == {"id": "feedback-1"}


@pytest.mark.asyncio
async def test_wildberries_question_reply_uses_documented_body_and_strict_success() -> None:
    transport = SequenceTransport([response(204)])
    context = ProviderMessageContext(
        message_type=MessageType.QUESTION,
        external_id="question-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-token",
            None,
            context,
            "Synthetic answer",
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.provider_reply_id == "question-1"
    request = transport.requests[0]
    assert request.method == "PATCH"
    assert request.url.path == "/api/v1/questions"
    assert request.read().decode("utf-8") == (
        '{"id":"question-1","text":"Synthetic answer","state":"wbRu"}'
    )


@pytest.mark.asyncio
async def test_wildberries_write_rejects_unproven_2xx_response() -> None:
    transport = SequenceTransport([response(200, json={"unexpected": True})])
    context = ProviderMessageContext(
        message_type=MessageType.REVIEW,
        external_id="feedback-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).send_reply(
            "synthetic-token",
            None,
            context,
            "Synthetic answer",
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"
