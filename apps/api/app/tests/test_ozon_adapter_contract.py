from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.ozon import OzonAdapter

REVIEW_METHODS = [
    "/v2/review/list",
    "/v1/review/comment/list",
    "/v1/review/comment/create",
]
QUESTION_METHODS = [
    "/v1/question/list",
    "/v1/question/answer/list",
    "/v1/question/answer/create",
]


class _RequestRecorder:
    def __init__(self, responses: Sequence[httpx.Response]) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._responses.pop(0)


def _roles_response(*, methods: list[str]) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "expires_at": "2026-12-01T00:00:00Z",
            "roles": [{"methods": methods}],
        },
    )


@pytest.mark.asyncio
async def test_validation_posts_official_roles_request_and_normalizes_review_scope() -> None:
    recorder = _RequestRecorder([_roles_response(methods=REVIEW_METHODS)])
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is True
    assert result.data == {
        "scopes": ["fetch_reviews", "send_review_reply"],
        "expires_at": "2026-12-01T00:00:00Z",
    }
    request = recorder.requests[0]
    assert request.method == "POST"
    assert request.url == "https://api-seller.ozon.ru/v1/roles"
    assert request.headers["Client-Id"] == "client-123"
    assert request.headers["Api-Key"] == "synthetic-api-key"
    assert json.loads(request.content) == {}
    assert "synthetic-api-key" not in str(request.url)
    assert "synthetic-api-key" not in request.content.decode("utf-8")


@pytest.mark.asyncio
async def test_validation_normalizes_question_only_scope() -> None:
    adapter = OzonAdapter(transport=httpx.MockTransport(_RequestRecorder([_roles_response(methods=QUESTION_METHODS)])))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is True
    assert result.data == {
        "scopes": ["fetch_questions", "send_question_reply"],
        "expires_at": "2026-12-01T00:00:00Z",
    }


@pytest.mark.asyncio
async def test_validation_normalizes_both_complete_streams_even_when_methods_are_split_across_roles() -> None:
    adapter = OzonAdapter(
        transport=httpx.MockTransport(
            _RequestRecorder(
                [
                    httpx.Response(
                        200,
                        json={
                            "expires_at": "2026-12-01T00:00:00Z",
                            "roles": [
                                {"methods": REVIEW_METHODS[:2]},
                                {"methods": REVIEW_METHODS[2:] + QUESTION_METHODS},
                            ],
                        },
                    )
                ]
            )
        )
    )

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is True
    assert result.data == {
        "scopes": [
            "fetch_reviews",
            "send_review_reply",
            "fetch_questions",
            "send_question_reply",
        ],
        "expires_at": "2026-12-01T00:00:00Z",
    }


@pytest.mark.asyncio
async def test_validation_rejects_missing_client_id_without_network_call() -> None:
    recorder = _RequestRecorder([])
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id=" ")

    assert result.ok is False
    assert result.error_code == "invalid_account_identifier"
    assert recorder.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "expected_error"),
    [
        ({"expires_at": "2026-12-01T00:00:00Z", "roles": []}, "insufficient_scope"),
        ({"expires_at": "2026-12-01T00:00:00Z", "roles": [{"methods": [REVIEW_METHODS[0]]}]}, "insufficient_scope"),
        ({"expires_at": "2026-12-01T00:00:00Z", "roles": [{"methods": [method.upper() for method in REVIEW_METHODS]}]}, "insufficient_scope"),
        ({"expires_at": "2026-12-01T00:00:00Z", "roles": "not-a-list"}, "malformed_payload"),
        ({"roles": [{"methods": REVIEW_METHODS}]}, "malformed_payload"),
        ({"expires_at": "not-a-timestamp", "roles": [{"methods": REVIEW_METHODS}]}, "malformed_payload"),
        ({"expires_at": "2026-12-01T00:00:00Z", "roles": [{"methods": [1]}]}, "malformed_payload"),
    ],
)
async def test_validation_distinguishes_unsupported_from_malformed_roles(
    payload: dict[str, object],
    expected_error: str,
) -> None:
    adapter = OzonAdapter(transport=httpx.MockTransport(_RequestRecorder([httpx.Response(200, json=payload)])))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is False
    assert result.error_code == expected_error


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status_code", "headers", "expected_error", "retry_after"),
    [
        (401, {}, "invalid_credentials", None),
        (403, {}, "insufficient_scope", None),
        (429, {"Retry-After": "7"}, "rate_limited", 7),
        (429, {"Retry-After": "-9"}, "rate_limited", 0),
        (429, {"Retry-After": "9000"}, "rate_limited", 3600),
        (429, {"Retry-After": "not-an-int"}, "rate_limited", None),
        (429, {}, "rate_limited", None),
        (503, {}, "marketplace_unavailable", None),
        (400, {}, "marketplace_error", None),
    ],
)
async def test_validation_normalizes_official_http_errors(
    status_code: int,
    headers: dict[str, str],
    expected_error: str,
    retry_after: int | None,
) -> None:
    adapter = OzonAdapter(
        transport=httpx.MockTransport(
            _RequestRecorder([httpx.Response(status_code, headers=headers, json={"message": "synthetic"})])
        )
    )

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is False
    assert result.error_code == expected_error
    assert result.retry_after_seconds == retry_after


@pytest.mark.asyncio
async def test_validation_normalizes_timeout_without_provider_call() -> None:
    async def timeout_handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("synthetic timeout")

    adapter = OzonAdapter(transport=httpx.MockTransport(timeout_handler))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is False
    assert result.error_code == "network_timeout"


@pytest.mark.asyncio
async def test_validation_normalizes_generic_transport_error() -> None:
    async def transport_handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("synthetic connection error")

    adapter = OzonAdapter(transport=httpx.MockTransport(transport_handler))

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is False
    assert result.error_code == "network_error"


@pytest.mark.asyncio
async def test_validation_rejects_invalid_json_roles_response() -> None:
    adapter = OzonAdapter(
        transport=httpx.MockTransport(_RequestRecorder([httpx.Response(200, text="not json")]))
    )

    result = await adapter.validate_credentials("synthetic-api-key", seller_id="client-123")

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_review_list_uses_official_cursor_contract_and_normalizes_unprocessed_records() -> None:
    review = {
        "id": "review-123",
        "status": "UNPROCESSED",
        "text": "Synthetic review",
        "rating": 2,
        "published_at": "2026-08-12T10:30:00Z",
        "sku": 123456,
    }
    recorder = _RequestRecorder(
        [httpx.Response(200, json={"reviews": [review], "has_next": True, "last_id": "next-review"})]
    )
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_reviews("synthetic-api-key", seller_id="client-123")

    assert result.ok is True
    assert result.next_cursor == "next-review"
    assert json.loads(recorder.requests[0].content) == {"limit": 100, "sort_dir": "ASC"}
    extracted = adapter.extract_reviews(result.data)
    assert extracted == [review]
    assert adapter.normalize_review(extracted[0]) == {
        "external_id": "review-123",
        "type": "review",
        "status": "needs_reply",
        "rating": 2,
        "customer_display_name": None,
        "customer_text": "Synthetic review",
        "customer_photos_json": [],
        "marketplace_created_at": datetime(2026, 8, 12, 10, 30, tzinfo=UTC),
        "product": {
            "external_id": "123456",
            "sku": "123456",
            "name": None,
            "brand": None,
            "category": None,
            "image_url": None,
            "product_url": None,
            "metadata_json": {"ozon_sku": 123456},
        },
        "metadata_json": {"source": "ozon.reviews", "ozon_sku": 123456, "ozon_status": "UNPROCESSED"},
    }


@pytest.mark.asyncio
async def test_review_list_sends_nonempty_cursor_and_rejects_malformed_success_page() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json={"reviews": [], "has_next": False, "last_id": ""}),
            httpx.Response(200, json={"reviews": "not-a-list", "has_next": False, "last_id": ""}),
        ]
    )
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    no_cursor = await adapter.fetch_reviews("synthetic-api-key", cursor="current-review", seller_id="client-123")
    malformed = await adapter.fetch_reviews("synthetic-api-key", seller_id="client-123")

    assert no_cursor.ok is True
    assert no_cursor.next_cursor is None
    assert json.loads(recorder.requests[0].content) == {
        "limit": 100,
        "sort_dir": "ASC",
        "last_id": "current-review",
    }
    assert malformed.ok is False
    assert malformed.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_review_list_rejects_empty_or_repeated_provider_cursor() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json={"reviews": [], "has_next": True, "last_id": ""}),
            httpx.Response(200, json={"reviews": [], "has_next": True, "last_id": "current-review"}),
        ]
    )
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    empty_cursor = await adapter.fetch_reviews("synthetic-api-key", seller_id="client-123")
    repeated_cursor = await adapter.fetch_reviews(
        "synthetic-api-key", cursor="current-review", seller_id="client-123"
    )

    assert empty_cursor.error_code == "malformed_payload"
    assert repeated_cursor.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_question_list_uses_exact_body_and_normalizes_unanswered_records() -> None:
    question = {
        "id": "question-123",
        "status": "UNPROCESSED",
        "answers_count": 0,
        "text": "Synthetic question",
        "author_name": "Synthetic buyer",
        "published_at": "2026-08-12T11:30:00Z",
        "product_url": "https://www.ozon.ru/product/synthetic-123/",
        "sku": 654321,
    }
    recorder = _RequestRecorder(
        [httpx.Response(200, json={"questions": [question], "has_next": True, "last_id": "next-question"})]
    )
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_questions("synthetic-api-key", seller_id="client-123")

    assert result.ok is True
    assert result.next_cursor == "next-question"
    assert json.loads(recorder.requests[0].content) == {
        "filter": {"status": "ALL"},
        "limit": 100,
        "last_id": "",
        "sort_dir": "ASC",
    }
    extracted = adapter.extract_questions(result.data)
    assert extracted == [question]
    normalized = adapter.normalize_question(extracted[0])
    assert normalized["external_id"] == "question-123"
    assert normalized["type"] == "question"
    assert normalized["customer_display_name"] == "Synthetic buyer"
    assert normalized["customer_text"] == "Synthetic question"
    assert normalized["marketplace_created_at"] == datetime(2026, 8, 12, 11, 30, tzinfo=UTC)
    assert normalized["product"] == {
        "external_id": "654321",
        "sku": "654321",
        "name": None,
        "brand": None,
        "category": None,
        "image_url": None,
        "product_url": "https://www.ozon.ru/product/synthetic-123/",
        "metadata_json": {"ozon_sku": 654321},
    }
    assert normalized["metadata_json"] == {
        "source": "ozon.questions",
        "ozon_sku": 654321,
        "ozon_status": "UNPROCESSED",
    }


@pytest.mark.asyncio
async def test_question_list_sends_cursor_and_rejects_malformed_success_page() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json={"questions": [], "has_next": False, "last_id": ""}),
            httpx.Response(200, json={"questions": [], "has_next": "false", "last_id": ""}),
        ]
    )
    adapter = OzonAdapter(transport=httpx.MockTransport(recorder))

    complete = await adapter.fetch_questions("synthetic-api-key", cursor="current-question", seller_id="client-123")
    malformed = await adapter.fetch_questions("synthetic-api-key", seller_id="client-123")

    assert complete.ok is True
    assert complete.next_cursor is None
    assert json.loads(recorder.requests[0].content) == {
        "filter": {"status": "ALL"},
        "limit": 100,
        "last_id": "current-question",
        "sort_dir": "ASC",
    }
    assert malformed.ok is False
    assert malformed.error_code == "malformed_payload"


def test_ozon_extraction_skips_processed_and_malformed_records_without_synthesizing_required_values() -> None:
    adapter = OzonAdapter()
    valid_review = {
        "id": "review-123",
        "status": "UNPROCESSED",
        "text": "Synthetic review",
        "published_at": "2026-08-12T10:30:00Z",
        "sku": 123456,
    }
    valid_question = {
        "id": "question-123",
        "status": "UNPROCESSED",
        "answers_count": 0,
        "text": "Synthetic question",
        "published_at": "2026-08-12T11:30:00Z",
        "sku": 654321,
    }

    reviews = adapter.extract_reviews(
        {
            "reviews": [
                valid_review,
                {**valid_review, "status": "PROCESSED"},
                {**valid_review, "id": ""},
                {**valid_review, "text": ""},
                {**valid_review, "published_at": "not-a-date"},
                {**valid_review, "published_at": "2026-08-12T10:30:00"},
                {**valid_review, "sku": 0},
                {**valid_review, "sku": True},
                {**valid_review, "sku": 123456.0},
            ]
        }
    )
    questions = adapter.extract_questions(
        {
            "questions": [
                valid_question,
                {**valid_question, "status": "PROCESSED"},
                {**valid_question, "answers_count": 1},
                {**valid_question, "answers_count": False},
                {**valid_question, "id": ""},
                {**valid_question, "text": ""},
                {**valid_question, "published_at": "not-a-date"},
                {**valid_question, "published_at": "2026-08-12T11:30:00"},
                {**valid_question, "sku": 0},
                {**valid_question, "sku": True},
                {**valid_question, "sku": 654321.0},
            ]
        }
    )

    assert reviews == [valid_review]
    assert questions == [valid_question]
