from __future__ import annotations

import asyncio

import httpx
import pytest

from app.adapters.avito_auth import (
    AvitoClientCredentials,
    AvitoCredentialResolver,
    InvalidAvitoCredential,
)
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api.avito.ru"
CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'


def test_avito_credentials_require_exact_versioned_shape() -> None:
    parsed = AvitoClientCredentials.parse(CREDENTIAL)
    assert parsed.client_id == "synthetic-client"

    with pytest.raises(InvalidAvitoCredential):
        AvitoClientCredentials.parse('{"version":1,"client_id":"x","client_secret":"y","token":"forbidden"}')


@pytest.mark.asyncio
async def test_concurrent_avito_resolve_coalesces_token_refresh() -> None:
    transport = SequenceTransport([response(200, json={"access_token": "synthetic-token", "token_type": "Bearer", "expires_in": 3600})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        resolver = AvitoCredentialResolver(client)
        first, second = await asyncio.gather(
            resolver.resolve(CREDENTIAL),
            resolver.resolve(CREDENTIAL),
        )

    assert first.ok is True and first.data is not None
    assert second.ok is True and second.data is not None
    assert first.data.access_token == second.data.access_token == "synthetic-token"
    assert len(transport.requests) == 1
    request = transport.requests[0]
    assert request.url.path == "/token/"
    assert request.headers["Content-Type"].startswith("application/x-www-form-urlencoded")
    assert "synthetic-secret" not in str(request.url)


@pytest.mark.parametrize(
    "raw",
    [
        "not-json",
        "{}",
        '{"version":2,"client_id":"x","client_secret":"y"}',
        '{"version":1,"client_id":"","client_secret":"y"}',
        '{"version":1,"client_id":1,"client_secret":"y"}',
    ],
)
@pytest.mark.asyncio
async def test_invalid_avito_credentials_fail_without_network_or_secret_leak(raw: str) -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoCredentialResolver(client).resolve(raw)

    assert result.error_code == "invalid_credentials"
    assert raw not in repr(result)
    assert transport.requests == []
