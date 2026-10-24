from __future__ import annotations

from datetime import UTC, datetime, tzinfo

import httpx
import pytest

from app.adapters.avito_auth import AvitoCredentialResolver
from app.adapters.avito_http import AvitoApiClient
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy, request_read_with_retry
from app.adapters.ozon import OzonAdapter
from app.adapters.yandex_market import YandexMarketAdapter
from app.tests.marketplace_fixtures import SequenceTransport, response


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz: tzinfo | None = None) -> datetime:
        return datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    for module in ("http", "ozon", "yandex_market", "avito_http"):
        monkeypatch.setattr(f"app.adapters.{module}.datetime", _FixedDatetime)


@pytest.mark.parametrize("retry_after", ["120", "Thu, 01 Jan 2026 00:02:00 GMT", "86400"])
@pytest.mark.parametrize("status", [429, 503])
@pytest.mark.asyncio
async def test_read_defers_long_retry_after_without_sleeping_or_retrying(
    fixed_clock: None, retry_after: str, status: int,
) -> None:
    transport = SequenceTransport([response(status, headers={"Retry-After": retry_after}), response(200)])
    delays: list[float] = []

    async def record_delay(delay: float) -> None:
        delays.append(delay)

    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=transport.mock()) as client:
        result = await request_read_with_retry(client, "GET", "/resource", sleep=record_delay)

    assert result.status_code == status
    assert delays == []
    assert len(transport.requests) == 1


@pytest.mark.parametrize("retry_after,expected_delay", [("120", 120), ("Thu, 01 Jan 2026 00:02:00 GMT", 120), ("86400", 86400), ("86401", None)])
@pytest.mark.parametrize("status", [429, 503])
@pytest.mark.parametrize("marketplace", ["ozon", "yandex_market", "avito"])
@pytest.mark.asyncio
async def test_marketplace_failure_preserves_long_rate_limit_cooldown(
    fixed_clock: None, retry_after: str, expected_delay: int | None, status: int, marketplace: str,
) -> None:
    outcomes = [response(status, headers={"Retry-After": retry_after})]
    if marketplace == "avito":
        outcomes.insert(0, response(200, json={"access_token": "synthetic-token", "token_type": "Bearer", "expires_in": 3600}))
    transport = SequenceTransport(outcomes)
    policy = ReadRetryPolicy(max_attempts=1)
    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=transport.mock()) as client:
        if marketplace == "avito":
            api = AvitoApiClient(client, AvitoCredentialResolver(client), read_retry_policy=policy)
            result = await api.read(
                '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}',
                "/messenger/v2/accounts/42/chats",
                params={},
            )
        else:
            adapter_type = OzonAdapter if marketplace == "ozon" else YandexMarketAdapter
            result = await adapter_type(client, read_retry_policy=policy).fetch_page(
                "synthetic-token", "42", MarketplaceStream.REVIEWS, None,
            )

    assert result.ok is False
    assert result.error_code == ("rate_limited" if status == 429 else "marketplace_unavailable")
    assert result.retry_after_seconds == expected_delay
    transport.assert_exhausted()


@pytest.mark.parametrize("retry_after,inline_limit,expected_delay", [("2", 2, 2.0), ("0", 0, 0.0), ("invalid", 0, 0.25), ("86401", 0, 0.25)])
@pytest.mark.asyncio
async def test_read_retries_short_cooldowns_and_invalid_headers_with_bounded_backoff(
    retry_after: str, inline_limit: int, expected_delay: float,
) -> None:
    transport = SequenceTransport([response(429, headers={"Retry-After": retry_after}), response(200)])
    delays: list[float] = []

    async def record_delay(delay: float) -> None:
        delays.append(delay)

    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=transport.mock()) as client:
        result = await request_read_with_retry(
            client, "GET", "/resource", policy=ReadRetryPolicy(max_retry_after_seconds=inline_limit), sleep=record_delay,
        )

    assert result.status_code == 200
    assert delays == [expected_delay]
    transport.assert_exhausted()
