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
async def test_wildberries_validation_uses_one_category_ping_without_consuming_question_list() -> None:
    transport = SequenceTransport([response(200, json={"TS": "2026-10-05T15:00:00Z", "Status": "OK"})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client).validate_credentials(_token(scope=1 << 7))
    assert result.ok
    assert result.data is not None and "questions:read" in result.data.scopes
    assert len(transport.requests) == 1
    assert transport.requests[0].url.path == "/ping"
    assert not transport.requests[0].url.params


@pytest.mark.parametrize("payload", [{}, {"Status": "ERROR"}, {"data": {"questions": []}}])
@pytest.mark.asyncio
async def test_wildberries_ping_does_not_accept_an_unproven_success(payload: dict[str, object]) -> None:
    transport = SequenceTransport([response(200, json=payload)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client).validate_credentials(_token(scope=1 << 7))
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_wildberries_validation_requires_writable_feedback_scope() -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(
            _token(scope=(1 << 7) | (1 << 30)),
            None,
        )

    assert result.ok is False
    assert result.error_code == "insufficient_scope"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_wildberries_validation_rejects_other_category_bit() -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(_token(scope=1 << 6), None)

    assert result.ok is False
    assert result.error_code == "insufficient_scope"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_wildberries_review_page_uses_exact_request_and_offset_contract() -> None:
    transport = SequenceTransport([response(200, json={"data": {"feedbacks": [_record(index) for index in range(50)]}})])
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
async def test_wildberries_photo_only_feedback_does_not_fail_the_page() -> None:
    photo_only = {**_record(), "text": "", "photoLinks": [{"fullSize": "https://feedback.example.test/photo.webp"}]}
    transport = SequenceTransport([response(200, json={"data": {"feedbacks": [photo_only]}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-token", None, MarketplaceStream.REVIEWS, None)

    assert result.ok is True
    assert result.data is not None
    assert len(result.data.items) == 1
    assert result.data.items[0].customer_text == ""
    assert result.data.items[0].customer_photos == ("https://feedback.example.test/photo.webp",)


@pytest.mark.asyncio
async def test_wildberries_rating_only_feedback_keeps_the_page_loadable_without_inventing_text() -> None:
    record = {**_record(), "text": "", "photoLinks": None, "video": None}
    transport = SequenceTransport([response(200, json={"data": {"feedbacks": [record]}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client).fetch_page("synthetic-token", None, MarketplaceStream.REVIEWS, None)
    assert result.ok and result.data is not None
    assert result.data.items[0].customer_text == ""
    assert result.data.items[0].rating == 5


@pytest.mark.parametrize(
    ("content", "expected_metadata"),
    [
        (
            {"video": {"link": "https://videofeedback01.wbbasket.ru/review/index.m3u8"}},
            {"review_video_url": "https://videofeedback01.wbbasket.ru/review/index.m3u8"},
        ),
        ({"bables": ["цена", "размер"]}, {"review_deficiencies": ["цена", "размер"]}),
    ],
)
@pytest.mark.asyncio
async def test_wildberries_content_only_feedback_keeps_original_review_context(content: dict[str, object], expected_metadata: dict[str, object]) -> None:
    record = {**_record(), "text": "", **content}
    transport = SequenceTransport([response(200, json={"data": {"feedbacks": [record]}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-token", None, MarketplaceStream.REVIEWS, None)

    assert result.ok is True
    assert result.data is not None
    assert result.data.items[0].customer_text == ""
    assert result.data.items[0].metadata.items() >= expected_metadata.items()


@pytest.mark.parametrize(
    "content",
    [
        {"video": {"link": "javascript:alert(1)"}},
        {"bables": ["цена", 123]},
        {"bables": [" "]},
    ],
)
@pytest.mark.asyncio
async def test_wildberries_malformed_content_only_feedback_fails_closed(content: dict[str, object]) -> None:
    record = {**_record(), "text": "", **content}
    transport = SequenceTransport([response(200, json={"data": {"feedbacks": [record]}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-token", None, MarketplaceStream.REVIEWS, None)

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_wildberries_question_page_ends_when_provider_returns_less_than_page_size() -> None:
    question = _record()
    question["id"] = "question-1"
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
    ("stream", "cursor"),
    [(MarketplaceStream.QUESTIONS, "10000"), (MarketplaceStream.REVIEWS, "200000")],
)
@pytest.mark.asyncio
async def test_wildberries_rejects_cursor_beyond_documented_stream_limit(stream: MarketplaceStream, cursor: str) -> None:
    transport = SequenceTransport([response(200, json={"data": {"questions": [], "feedbacks": []}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-token", None, stream, cursor)

    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_wildberries_full_last_question_page_does_not_return_invalid_cursor() -> None:
    questions = [{**_record(index), "id": f"question-{index}"} for index in range(50)]
    transport = SequenceTransport([response(200, json={"data": {"questions": questions}})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).fetch_page("synthetic-token", None, MarketplaceStream.QUESTIONS, "9950")

    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert len(transport.requests) == 1


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
    transport = SequenceTransport([response(200, json={"data": {"id": "feedback-1", "state": "wbRu", "answer": {"text": "Already answered"}}})])
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
    assert result.data.provider_state == "accepted_unverified"
    assert transport.requests[0].url.path == "/api/v1/feedback"
    assert dict(transport.requests[0].url.params) == {"id": "feedback-1"}


@pytest.mark.asyncio
async def test_wildberries_hidden_question_answer_is_not_public() -> None:
    transport = SequenceTransport([response(200, json={"data": {"id": "question-1", "state": "none", "answer": {"text": "Private answer"}}})])
    context = ProviderMessageContext(
        message_type=MessageType.QUESTION,
        external_id="question-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).find_existing_reply("synthetic-token", None, context)

    assert result.ok is True
    assert result.data is not None
    assert result.data.exists is True
    assert result.data.provider_state == "not_public"


@pytest.mark.asyncio
async def test_wildberries_question_reply_uses_documented_body_and_strict_success() -> None:
    transport = SequenceTransport([response(200, json={"data": None, "error": False, "errorText": "", "additionalErrors": None})])
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
    assert result.data.provider_state == "accepted_unverified"
    request = transport.requests[0]
    assert request.method == "PATCH"
    assert request.url.path == "/api/v1/questions"
    assert request.read().decode("utf-8") == ('{"id":"question-1","text":"Synthetic answer","state":"wbRu"}')


@pytest.mark.asyncio
async def test_wildberries_review_receipt_does_not_claim_publication() -> None:
    transport = SequenceTransport([response(204)])
    context = ProviderMessageContext(
        message_type=MessageType.REVIEW,
        external_id="feedback-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).send_reply("synthetic-token", None, context, "Synthetic answer")

    assert result.ok is True
    assert result.data is not None
    assert result.data.provider_state == "accepted_unverified"
    assert transport.requests[0].url.path == "/api/v1/feedbacks/answer"


@pytest.mark.parametrize(
    "payload",
    [
        {"data": None, "error": True, "errorText": "Rejected", "additionalErrors": None},
        {"data": None, "error": False, "errorText": "Rejected", "additionalErrors": None},
        {"data": None, "error": False, "errorText": "", "additionalErrors": ["Rejected"]},
        {"unexpected": True},
    ],
)
@pytest.mark.asyncio
async def test_wildberries_question_reply_rejects_unproven_200(payload: dict[str, object]) -> None:
    transport = SequenceTransport([response(200, json=payload)])
    context = ProviderMessageContext(
        message_type=MessageType.QUESTION,
        external_id="question-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).send_reply("synthetic-token", None, context, "Synthetic answer")

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_wildberries_review_rejects_one_character_reply_before_transport() -> None:
    transport = SequenceTransport([response(204)])
    context = ProviderMessageContext(
        message_type=MessageType.REVIEW,
        external_id="feedback-1",
        marketplace_created_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await WildberriesAdapter(client, read_retry_policy=NO_RETRY).send_reply("synthetic-token", None, context, "x")

    assert result.ok is False
    assert result.error_code == "marketplace_validation_error"
    assert transport.requests == []


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
