from __future__ import annotations

import json
from collections.abc import Callable
from urllib.parse import parse_qs

import httpx
import pytest

from app.adapters.avito_auth import AvitoCredentialResolver, AvitoResolvedCredential
from app.adapters.base import AdapterResult


class _Recorder:
    def __init__(self, responses: list[httpx.Response] | Callable[[httpx.Request], httpx.Response]) -> None:
        self.requests: list[httpx.Request] = []
        self.responses = responses

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if callable(self.responses):
            return self.responses(request)
        return self.responses.pop(0)


def _credential(client_id: str = "client-123", client_secret: str = "synthetic-secret") -> str:
    return json.dumps({"client_id": client_id, "client_secret": client_secret})


def _token_response(token: str = "synthetic-access-token", expires_in: int = 86400) -> httpx.Response:
    return httpx.Response(
        200,
        json={"access_token": token, "expires_in": expires_in, "token_type": "Bearer"},
    )


@pytest.mark.asyncio
async def test_client_credentials_use_exact_official_token_form() -> None:
    recorder = _Recorder([_token_response()])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))

    result = await resolver.resolve(_credential())

    assert result == AvitoResolvedCredential(
        access_token="synthetic-access-token",
        authentication="client_credentials",
    )
    assert len(recorder.requests) == 1
    request = recorder.requests[0]
    assert request.method == "POST"
    assert request.url == httpx.URL("https://api.avito.ru/token/")
    assert request.headers["content-type"].startswith("application/x-www-form-urlencoded")
    assert parse_qs(request.content.decode("ascii"), strict_parsing=True) == {
        "grant_type": ["client_credentials"],
        "client_id": ["client-123"],
        "client_secret": ["synthetic-secret"],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "credential",
    [
        "{}",
        '{"client_id":"client-123"}',
        '{"client_secret":"synthetic-secret"}',
        '{"client_id":"","client_secret":"synthetic-secret"}',
        '{"client_id":"client-123","client_secret":42}',
        '{"client_id":"client-123","client_secret":"synthetic-secret","scope":"messenger:write"}',
        "{malformed-json",
    ],
)
async def test_structured_credentials_fail_closed_before_http(credential: str) -> None:
    recorder = _Recorder([])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))

    result = await resolver.resolve(credential)

    assert isinstance(result, AdapterResult)
    assert result.ok is False
    assert result.error_code == "invalid_credentials"
    assert result.error_message_safe == "Avito credentials are invalid"
    assert recorder.requests == []
    assert "client-123" not in repr(result)
    assert "synthetic-secret" not in repr(result)


@pytest.mark.asyncio
async def test_legacy_access_token_remains_network_free_and_normalized() -> None:
    recorder = _Recorder([])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))

    result = await resolver.resolve(" Bearer synthetic-access-token ")

    assert result == AvitoResolvedCredential(
        access_token="synthetic-access-token",
        authentication="access_token",
    )
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_client_credentials_cache_until_early_expiry() -> None:
    now = [1000.0]
    recorder = _Recorder([_token_response("token-1", expires_in=120), _token_response("token-2")])
    resolver = AvitoCredentialResolver(
        transport=httpx.MockTransport(recorder),
        monotonic=lambda: now[0],
    )

    first = await resolver.resolve(_credential())
    now[0] = 1059.0
    cached = await resolver.resolve(_credential())
    now[0] = 1060.0
    refreshed = await resolver.resolve(_credential())

    assert first == cached == AvitoResolvedCredential("token-1", "client_credentials")
    assert refreshed == AvitoResolvedCredential("token-2", "client_credentials")
    assert len(recorder.requests) == 2


@pytest.mark.asyncio
async def test_token_cache_is_bounded_and_evicts_earliest_expiry() -> None:
    recorder = _Recorder(
        [
            _token_response("token-a", expires_in=120),
            _token_response("token-b", expires_in=240),
            _token_response("token-a-new", expires_in=120),
        ]
    )
    resolver = AvitoCredentialResolver(
        transport=httpx.MockTransport(recorder),
        max_cache_entries=1,
    )

    await resolver.resolve(_credential("client-a", "secret-a"))
    await resolver.resolve(_credential("client-b", "secret-b"))
    result = await resolver.resolve(_credential("client-a", "secret-a"))

    assert result == AvitoResolvedCredential("token-a-new", "client_credentials")
    assert len(recorder.requests) == 3


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("payload", "status_code"),
    [
        ({}, 200),
        ({"access_token": "", "expires_in": 86400, "token_type": "Bearer"}, 200),
        ({"access_token": "token", "expires_in": True, "token_type": "Bearer"}, 200),
        ({"access_token": "token", "expires_in": 0, "token_type": "Bearer"}, 200),
        ({"access_token": "token", "expires_in": 86400.5, "token_type": "Bearer"}, 200),
        ({"access_token": "token", "expires_in": 604801, "token_type": "Bearer"}, 200),
        ({"access_token": "token", "expires_in": 86400, "token_type": "Basic"}, 200),
    ],
)
async def test_malformed_token_success_is_rejected(payload: object, status_code: int) -> None:
    recorder = _Recorder([httpx.Response(status_code, json=payload)])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))

    result = await resolver.resolve(_credential())

    assert isinstance(result, AdapterResult)
    assert result.ok is False
    assert result.error_code == "malformed_payload"
    assert result.error_message_safe == "Avito authentication returned a malformed response"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("response", "expected_code"),
    [
        (httpx.Response(400, json={"error": "invalid_client", "client_secret": "do-not-return"}), "invalid_credentials"),
        (httpx.Response(401, json={"error": "invalid_client"}), "invalid_credentials"),
        (httpx.Response(403, json={"error": "forbidden"}), "invalid_credentials"),
        (httpx.Response(429, headers={"Retry-After": "60"}), "rate_limited"),
        (httpx.Response(500, json={"internal": "do-not-return"}), "marketplace_unavailable"),
    ],
)
async def test_token_errors_are_normalized_without_provider_body(
    response: httpx.Response,
    expected_code: str,
) -> None:
    recorder = _Recorder([response])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))

    result = await resolver.resolve(_credential())

    assert isinstance(result, AdapterResult)
    assert result.ok is False
    assert result.error_code == expected_code
    assert "do-not-return" not in repr(result)


@pytest.mark.asyncio
async def test_invalidation_forces_client_credentials_refresh() -> None:
    recorder = _Recorder([_token_response("token-1"), _token_response("token-2")])
    resolver = AvitoCredentialResolver(transport=httpx.MockTransport(recorder))
    credential = _credential()

    first = await resolver.resolve(credential)
    resolver.invalidate(credential)
    second = await resolver.resolve(credential)

    assert first == AvitoResolvedCredential("token-1", "client_credentials")
    assert second == AvitoResolvedCredential("token-2", "client_credentials")
    assert len(recorder.requests) == 2
