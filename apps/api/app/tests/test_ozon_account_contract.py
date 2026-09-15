from __future__ import annotations

import httpx
import pytest

from app.adapters.http import ReadRetryPolicy
from app.adapters.ozon import QUESTION_METHODS, REVIEW_METHODS, OzonAdapter
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api-seller.ozon.ru"
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _roles(*methods: str) -> dict[str, object]:
    return {
        "expires_at": "2026-12-01T00:00:00Z",
        "roles": [{"methods": list(methods)}],
    }


@pytest.mark.asyncio
async def test_ozon_validation_keeps_credentials_in_headers_and_requires_complete_scopes() -> None:
    transport = SequenceTransport([response(200, json=_roles(*(REVIEW_METHODS | QUESTION_METHODS)))])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(
            "synthetic-api-key",
            "100200",
        )

    assert result.ok is True
    assert result.data is not None
    assert result.data.scopes == (
        "reviews:read",
        "reviews:write",
        "questions:read",
        "questions:write",
    )
    request = transport.requests[0]
    assert request.method == "POST"
    assert request.url.path == "/v1/roles"
    assert request.headers["Client-Id"] == "100200"
    assert request.headers["Api-Key"] == "synthetic-api-key"
    assert request.read() == b"{}"
    assert "synthetic-api-key" not in str(request.url)
    assert "synthetic-api-key" not in request.read().decode()


@pytest.mark.asyncio
async def test_ozon_validation_rejects_partial_or_invalid_account_contracts() -> None:
    transport = SequenceTransport([response(200, json=_roles(next(iter(REVIEW_METHODS))))])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = OzonAdapter(client, read_retry_policy=NO_RETRY)
        invalid_client = await adapter.validate_credentials("synthetic-api-key", "client-id")
        partial_scope = await adapter.validate_credentials("synthetic-api-key", "100200")

    assert invalid_client.error_code == "marketplace_validation_error"
    assert partial_scope.error_code == "insufficient_scope"
    assert len(transport.requests) == 1


@pytest.mark.parametrize(
    ("status_code", "error_code"),
    [
        (400, "marketplace_validation_error"),
        (401, "invalid_credentials"),
        (402, "insufficient_scope"),
        (403, "insufficient_scope"),
        (404, "marketplace_not_found"),
        (429, "rate_limited"),
        (503, "marketplace_unavailable"),
    ],
)
@pytest.mark.asyncio
async def test_ozon_validation_normalizes_errors_without_provider_body_leakage(
    status_code: int,
    error_code: str,
) -> None:
    transport = SequenceTransport([response(status_code, json={"message": "synthetic-secret must not escape"})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await OzonAdapter(client, read_retry_policy=NO_RETRY).validate_credentials(
            "synthetic-api-key",
            "100200",
        )

    assert result.error_code == error_code
    assert "synthetic-secret" not in repr(result)
