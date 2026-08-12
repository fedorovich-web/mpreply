from __future__ import annotations

import json
from collections.abc import Callable
from datetime import date

import httpx
import pytest

from app.adapters.yandex_market import YandexMarketAdapter
from app.models.enums import MessageType


class RequestRecorder:
    def __init__(self, responses: list[httpx.Response | Callable[[httpx.Request], httpx.Response]]) -> None:
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if not self.responses:
            raise AssertionError(f"Unexpected request: {request.method} {request.url}")
        response = self.responses.pop(0)
        return response(request) if callable(response) else response


def response(status_code: int, payload: object, *, headers: dict[str, str] | None = None) -> httpx.Response:
    return httpx.Response(status_code, json=payload, headers=headers)


def request_json(request: httpx.Request) -> object:
    return json.loads(request.content.decode("utf-8")) if request.content else None


@pytest.mark.asyncio
async def test_validate_credentials_checks_scope_and_business_access() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {"apiKey": {"name": "MP Reply", "authScopes": ["COMMUNICATION"]}},
                },
            ),
            response(200, {"status": "OK", "result": {"feedbacks": [], "paging": {}}}),
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("secret-api-key", seller_id="12345")

    assert result.ok is True
    assert result.data == {"scopes": ["COMMUNICATION"], "business_id": 12345}
    assert len(recorder.requests) == 2
    token_request, access_request = recorder.requests
    assert token_request.method == "POST"
    assert token_request.url.path == "/v2/auth/token"
    assert token_request.headers["Api-Key"] == "secret-api-key"
    assert token_request.headers["X-Market-Integration"] == "MPReply/0.1.104-dev"
    assert access_request.url.path == "/v2/businesses/12345/goods-feedback"
    assert access_request.url.params["limit"] == "1"
    assert request_json(access_request) == {"reactionStatus": "NEED_REACTION"}


@pytest.mark.asyncio
async def test_validate_credentials_rejects_read_only_scope_before_business_probe() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {"apiKey": {"name": "Read only", "authScopes": ["ALL_METHODS_READ_ONLY"]}},
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("secret-api-key", seller_id="12345")

    assert result.ok is False
    assert result.error_code == "insufficient_scope"
    assert len(recorder.requests) == 1


@pytest.mark.asyncio
async def test_fetch_reviews_uses_page_token_and_returns_next_cursor() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "feedbacks": [{"feedbackId": 101}],
                        "paging": {"nextPageToken": "next-review-page"},
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_reviews("key", cursor="current-page", seller_id="77")

    assert result.ok is True
    assert result.next_cursor == "next-review-page"
    assert adapter.extract_reviews(result.data) == [{"feedbackId": 101}]
    request = recorder.requests[0]
    assert request.url.path == "/v2/businesses/77/goods-feedback"
    assert request.url.params["limit"] == "50"
    assert request.url.params["pageToken"] == "current-page"
    assert request_json(request) == {"reactionStatus": "NEED_REACTION"}


@pytest.mark.asyncio
async def test_fetch_questions_uses_need_answer_filter() -> None:
    recorder = RequestRecorder(
        [response(200, {"status": "OK", "result": {"questions": [], "paging": {}}})]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_questions("key", seller_id="88")

    assert result.ok is True
    assert result.next_cursor is None
    request = recorder.requests[0]
    assert request.url.path == "/v1/businesses/88/goods-questions"
    assert request_json(request) == {"needAnswer": True}


@pytest.mark.asyncio
async def test_fetch_question_window_sends_explicit_dates_and_scopes_page_token() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "questions": [],
                        "paging": {"nextPageToken": "next-question-page"},
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_questions_window(
        "key",
        seller_id="88",
        date_from=date(2026, 7, 16),
        date_to=date(2026, 8, 12),
        cursor="current-page",
    )

    assert result.ok is True
    assert result.next_cursor == "next-question-page"
    request = recorder.requests[0]
    assert request.url.path == "/v1/businesses/88/goods-questions"
    assert request.url.params["limit"] == "50"
    assert request.url.params["pageToken"] == "current-page"
    assert request_json(request) == {
        "needAnswer": True,
        "dateFrom": "2026-07-16",
        "dateTo": "2026-08-12",
    }


@pytest.mark.asyncio
async def test_fetch_question_window_rejects_inverted_dates_before_network() -> None:
    recorder = RequestRecorder([])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_questions_window(
        "key",
        seller_id="88",
        date_from=date(2026, 8, 13),
        date_to=date(2026, 8, 12),
    )

    assert result.ok is False
    assert result.error_code == "invalid_date_window"
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_send_review_reply_uses_official_comment_contract() -> None:
    recorder = RequestRecorder([response(200, {"status": "OK", "result": {"commentId": 12}})])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.send_review_reply("key", "456", "Спасибо за отзыв", seller_id="99")

    assert result.ok is True
    request = recorder.requests[0]
    assert request.url.path == "/v2/businesses/99/goods-feedback/comments/update"
    assert request.url.params["sourceType"] == "SELLER"
    assert request_json(request) == {"feedbackId": 456, "comment": {"text": "Спасибо за отзыв"}}


@pytest.mark.asyncio
async def test_send_question_reply_uses_typed_parent_question() -> None:
    recorder = RequestRecorder([response(200, {"status": "OK", "result": {"id": 44}})])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.send_question_reply("key", "321", "Да, подходит", seller_id="99")

    assert result.ok is True
    request = recorder.requests[0]
    assert request.url.path == "/v1/businesses/99/goods-questions/update"
    assert request_json(request) == {
        "operationType": "CREATE",
        "parentEntityId": {"id": 321, "type": "QUESTION"},
        "text": "Да, подходит",
    }


@pytest.mark.asyncio
async def test_preflight_detects_business_authored_reply() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "answers": [
                            {"id": 1, "status": "PUBLISHED", "author": {"type": "USER"}},
                            {"id": 2, "status": "PUBLISHED", "author": {"type": "BUSINESS"}},
                        ]
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.has_existing_reply(
        "key",
        MessageType.QUESTION.value,
        "123",
        seller_id="99",
    )

    assert result.ok is True
    assert result.data == {"answered": True, "state": "PUBLISHED"}
    assert recorder.requests[0].url.path == "/v1/businesses/99/goods-questions/answers"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("PUBLISHED", "PUBLISHED"),
        ("UNMODERATED", "UNMODERATED"),
        ("BANNED", "BANNED"),
        ("DELETED", "DELETED"),
    ],
)
async def test_question_reconciliation_maps_seller_owned_answer_state(
    status: str,
    expected: str,
) -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "answers": [
                            {"id": 281, "status": status, "canModify": True, "author": {}}
                        ]
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is True
    assert result.data == {"state": expected, "answer_id": "281"}


@pytest.mark.asyncio
async def test_question_reconciliation_returns_absent_for_valid_empty_answers() -> None:
    recorder = RequestRecorder([response(200, {"status": "OK", "result": {"answers": []}})])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is True
    assert result.data == {"state": "ABSENT", "answer_id": None}


@pytest.mark.asyncio
async def test_question_reconciliation_returns_unknown_for_ambiguous_ownership() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {"answers": [{"id": 7, "status": "PUBLISHED"}]},
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is True
    assert result.data == {"state": "UNKNOWN", "answer_id": None}


@pytest.mark.asyncio
async def test_question_reconciliation_returns_unknown_for_unknown_seller_status() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "answers": [{"id": 8, "status": "FUTURE_STATE", "canModify": True}]
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is True
    assert result.data == {"state": "UNKNOWN", "answer_id": "8"}


@pytest.mark.asyncio
async def test_has_existing_reply_preserves_nonfinal_question_state() -> None:
    recorder = RequestRecorder(
        [
            response(
                200,
                {
                    "status": "OK",
                    "result": {
                        "answers": [{"id": 12, "status": "UNMODERATED", "canModify": True}]
                    },
                },
            )
        ]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.has_existing_reply(
        "key",
        MessageType.QUESTION.value,
        "123",
        seller_id="99",
    )

    assert result.ok is True
    assert result.data == {"answered": True, "state": "UNMODERATED"}


@pytest.mark.asyncio
async def test_question_reconciliation_preserves_timeout_failure() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    recorder = RequestRecorder([timeout])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is False
    assert result.error_code == "network_timeout"


@pytest.mark.asyncio
async def test_resource_limit_maps_to_retryable_error_and_retry_after() -> None:
    recorder = RequestRecorder(
        [response(420, {"status": "ERROR", "errors": []}, headers={"Retry-After": "120"})]
    )
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_reviews("key", seller_id="99")

    assert result.ok is False
    assert result.error_code == "rate_limited"
    assert result.retry_after_seconds == 120


@pytest.mark.asyncio
async def test_invalid_business_and_external_identifiers_fail_before_network() -> None:
    recorder = RequestRecorder([])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    invalid_account = await adapter.fetch_reviews("key", seller_id="not-a-number")
    invalid_review = await adapter.send_review_reply("key", "bad-id", "text", seller_id="99")

    assert invalid_account.error_code == "invalid_account_identifier"
    assert invalid_review.error_code == "invalid_external_id"
    assert recorder.requests == []
