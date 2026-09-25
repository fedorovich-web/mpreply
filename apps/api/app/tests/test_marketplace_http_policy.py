from __future__ import annotations

import base64
import json
from collections.abc import Callable
from datetime import UTC, datetime

import httpx
import pytest
from fastapi import FastAPI

from app.adapters.http import (
    InvalidProviderPath,
    MarketplaceHttpClients,
    ReadRetryPolicy,
    ensure_relative_provider_path,
    parse_retry_after,
    request_read_with_retry,
)
from app.adapters.registry import MarketplaceAdapterRegistry, create_marketplace_registry
from app.core.lifecycle import application_lifespan
from app.models.enums import Marketplace
from app.tests.marketplace_fixtures import SequenceTransport, response


async def _no_wait(_: float) -> None:
    return None


def _wildberries_token(*, scope: int) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"s": scope}).encode()).decode().rstrip("=")
    return f"synthetic.{payload}.signature"


@pytest.mark.asyncio
async def test_read_retry_honors_bounded_retry_after() -> None:
    transport = SequenceTransport(
        [
            response(429, headers={"Retry-After": "2"}),
            response(200, json={"ok": True}),
        ]
    )
    delays: list[float] = []

    async def record_delay(delay: float) -> None:
        delays.append(delay)

    async with httpx.AsyncClient(
        base_url="https://provider.invalid",
        transport=transport.mock(),
        follow_redirects=False,
    ) as client:
        result = await request_read_with_retry(
            client,
            "GET",
            "/resource",
            policy=ReadRetryPolicy(max_attempts=2, max_retry_after_seconds=5),
            sleep=record_delay,
        )

    assert result.status_code == 200
    assert delays == [2.0]
    assert len(transport.requests) == 2
    transport.assert_exhausted()


@pytest.mark.asyncio
async def test_permanent_client_error_is_not_retried() -> None:
    transport = SequenceTransport([response(401)])

    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=transport.mock()) as client:
        result = await request_read_with_retry(client, "POST", "/read-operation", sleep=_no_wait)

    assert result.status_code == 401
    assert len(transport.requests) == 1
    transport.assert_exhausted()


@pytest.mark.asyncio
async def test_network_timeout_stops_at_the_attempt_limit() -> None:
    request = httpx.Request("GET", "https://provider.invalid/resource")
    transport = SequenceTransport(
        [
            httpx.ReadTimeout("first timeout", request=request),
            httpx.ReadTimeout("second timeout", request=request),
        ]
    )

    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=transport.mock()) as client:
        with pytest.raises(httpx.ReadTimeout, match="second timeout"):
            await request_read_with_retry(
                client,
                "GET",
                "/resource",
                policy=ReadRetryPolicy(max_attempts=2),
                sleep=_no_wait,
            )

    assert len(transport.requests) == 2
    transport.assert_exhausted()


@pytest.mark.parametrize(
    "path",
    [
        "https://attacker.invalid/steal",
        "//attacker.invalid/steal",
        "/safe?redirect=https://attacker.invalid",
        "/safe#fragment",
        "/safe\\..\\steal",
        "relative/without-leading-slash",
    ],
)
def test_provider_path_rejects_authority_query_fragment_and_backslash(path: str) -> None:
    with pytest.raises(InvalidProviderPath):
        ensure_relative_provider_path(path)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0", 0),
        ("5", 5),
        ("6", None),
        ("-1", None),
        ("not-a-delay", None),
        ("Thu, 01 Jan 2026 00:00:05 GMT", 5),
        ("Thu, 01 Jan 2026 00:00:06 GMT", None),
    ],
)
def test_retry_after_parser_accepts_only_bounded_seconds_or_http_date(
    value: str,
    expected: int | None,
) -> None:
    assert (
        parse_retry_after(
            value,
            now=datetime(2026, 1, 1, tzinfo=UTC),
            maximum_seconds=5,
        )
        == expected
    )


@pytest.mark.parametrize(
    "factory",
    [
        lambda: ReadRetryPolicy(max_attempts=0),
        lambda: ReadRetryPolicy(max_attempts=6),
        lambda: ReadRetryPolicy(base_delay_seconds=-0.1),
        lambda: ReadRetryPolicy(base_delay_seconds=2.0, max_delay_seconds=1.0),
        lambda: ReadRetryPolicy(max_delay_seconds=31.0),
        lambda: ReadRetryPolicy(max_retry_after_seconds=-1),
        lambda: ReadRetryPolicy(max_retry_after_seconds=301),
    ],
)
def test_retry_policy_rejects_unbounded_or_negative_configuration(
    factory: Callable[[], ReadRetryPolicy],
) -> None:
    with pytest.raises(ValueError):
        factory()


@pytest.mark.asyncio
async def test_marketplace_http_clients_close_every_owned_client() -> None:
    clients = MarketplaceHttpClients.create(transport=httpx.MockTransport(lambda _: response(200)))

    assert clients.wildberries.base_url == httpx.URL("https://feedbacks-api.wildberries.ru")
    assert clients.ozon.base_url == httpx.URL("https://api-seller.ozon.ru")
    assert clients.yandex_market.base_url == httpx.URL("https://api.partner.market.yandex.ru")
    assert clients.avito.base_url == httpx.URL("https://api.avito.ru")
    assert all(not client.follow_redirects for client in clients.all())
    assert all(client.headers["User-Agent"] == "MPReply marketplace integration" for client in clients.all())

    await clients.aclose()

    assert all(client.is_closed for client in clients.all())


@pytest.mark.asyncio
async def test_registry_wildberries_validation_uses_injected_client() -> None:
    transport = SequenceTransport([response(200, json={"data": {"questions": []}})])
    clients = MarketplaceHttpClients.create(transport=transport.mock())
    registry = create_marketplace_registry(clients)

    result = await registry.credentials(Marketplace.WILDBERRIES).validate_credentials(
        _wildberries_token(scope=1 << 7),
        None,
    )

    assert result.ok is True
    assert len(transport.requests) == 1
    assert transport.requests[0].url.host == "feedbacks-api.wildberries.ru"
    assert transport.requests[0].headers["Authorization"] == _wildberries_token(scope=1 << 7)
    transport.assert_exhausted()
    await clients.aclose()


@pytest.mark.asyncio
async def test_application_lifespan_owns_registry_and_closes_clients() -> None:
    app = FastAPI()

    async with application_lifespan(app):
        clients = app.state.marketplace_http_clients
        registry = app.state.marketplace_registry
        assert isinstance(clients, MarketplaceHttpClients)
        assert isinstance(registry, MarketplaceAdapterRegistry)
        assert registry.credentials(Marketplace.WILDBERRIES) is registry.credentials(Marketplace.WILDBERRIES)
        assert all(not client.is_closed for client in clients.all())

    assert all(client.is_closed for client in clients.all())
