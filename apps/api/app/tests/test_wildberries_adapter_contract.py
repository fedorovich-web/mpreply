from __future__ import annotations

import json
from collections.abc import Sequence

import httpx
import pytest

from app.adapters.wildberries import WildberriesAdapter
from app.models.enums import MessageType


class _RequestRecorder:
    def __init__(self, responses: Sequence[httpx.Response]) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._responses.pop(0)


def _json_body(request: httpx.Request) -> object:
    return json.loads(request.content)


@pytest.mark.asyncio
async def test_validation_and_unanswered_read_calls_use_official_feedbacks_contract() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json={"data": {}}),
            httpx.Response(200, json={"data": {"feedbacks": []}}),
            httpx.Response(200, json={"data": {"questions": []}}),
            httpx.Response(200, json={"data": {"isAnswered": False}}),
            httpx.Response(200, json={"data": {"answer": None}}),
        ]
    )
    adapter = WildberriesAdapter(transport=httpx.MockTransport(recorder))

    validation = await adapter.validate_credentials("synthetic-key")
    reviews = await adapter.fetch_reviews("synthetic-key")
    questions = await adapter.fetch_questions("synthetic-key", cursor="50")
    review = await adapter.get_review("synthetic-key", "review-1")
    question = await adapter.get_question("synthetic-key", "question-1")

    assert validation.ok is True
    assert reviews.ok is True
    assert questions.ok is True
    assert review.ok is True
    assert question.ok is True
    assert [(request.method, request.url.path) for request in recorder.requests] == [
        ("GET", "/ping"),
        ("GET", "/api/v1/feedbacks"),
        ("GET", "/api/v1/questions"),
        ("GET", "/api/v1/feedback"),
        ("GET", "/api/v1/question"),
    ]
    assert all(request.headers["Authorization"] == "synthetic-key" for request in recorder.requests)
    assert dict(recorder.requests[1].url.params) == {
        "isAnswered": "false",
        "take": "50",
        "skip": "0",
    }
    assert dict(recorder.requests[2].url.params) == {
        "isAnswered": "false",
        "take": "50",
        "skip": "50",
    }
    assert dict(recorder.requests[3].url.params) == {"id": "review-1"}
    assert dict(recorder.requests[4].url.params) == {"id": "question-1"}


@pytest.mark.asyncio
async def test_reply_calls_use_official_bodies_and_accept_review_no_content_success() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(204),
            httpx.Response(200, json={"data": {}}),
        ]
    )
    adapter = WildberriesAdapter(transport=httpx.MockTransport(recorder))

    review = await adapter.send_review_reply("synthetic-key", "review-1", "Спасибо")
    question = await adapter.send_question_reply("synthetic-key", "question-1", "Да")

    assert review.ok is True
    assert question.ok is True
    assert [(request.method, request.url.path) for request in recorder.requests] == [
        ("POST", "/api/v1/feedbacks/answer"),
        ("PATCH", "/api/v1/questions"),
    ]
    assert all(request.headers["Authorization"] == "synthetic-key" for request in recorder.requests)
    assert _json_body(recorder.requests[0]) == {"id": "review-1", "text": "Спасибо"}
    assert _json_body(recorder.requests[1]) == {"id": "question-1", "answer": {"text": "Да"}}


@pytest.mark.asyncio
@pytest.mark.parametrize("reply_text", ["x", "x" * 5001])
async def test_review_reply_rejects_text_outside_official_range_before_network(reply_text: str) -> None:
    recorder = _RequestRecorder([])
    adapter = WildberriesAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.send_review_reply("synthetic-key", "review-1", reply_text)

    assert result.ok is False
    assert result.error_code == "invalid_reply_text"
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_rate_limit_preserves_retry_after_seconds() -> None:
    recorder = _RequestRecorder(
        [httpx.Response(429, headers={"Retry-After": "7"}, json={"error": "limit"})]
    )
    adapter = WildberriesAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-key")

    assert result.ok is False
    assert result.error_code == "rate_limited"
    assert result.retry_after_seconds == 7


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("message_type", "payload"),
    [
        (MessageType.REVIEW.value, []),
        (MessageType.QUESTION.value, {"data": {"id": "question-1"}}),
    ],
)
async def test_malformed_exact_message_response_never_confirms_no_existing_reply(
    message_type: str,
    payload: object,
) -> None:
    recorder = _RequestRecorder([httpx.Response(200, json=payload)])
    adapter = WildberriesAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.has_existing_reply("synthetic-key", message_type, "external-1")

    assert result.ok is False
    assert result.error_code == "marketplace_malformed_response"
