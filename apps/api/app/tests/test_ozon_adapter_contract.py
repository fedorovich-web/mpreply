from __future__ import annotations

import json
from collections.abc import Sequence

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
