from __future__ import annotations

import pytest
from fastapi import HTTPException, Request
from pydantic import SecretStr
from starlette.types import Scope

from app.core import rate_limit as rate_limit_module
from app.core.config import Settings
from app.core.rate_limit import enforce_auth_rate_limit


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.expirations: dict[str, int] = {}
        self.close_calls = 0

    async def eval(self, script: str, numkeys: int, *values: object) -> list[int]:
        assert script.strip()
        keys = values[:numkeys]
        seconds = values[numkeys]
        assert isinstance(seconds, int)
        result: list[int] = []
        for key in keys:
            assert isinstance(key, str)
            self.counts[key] = self.counts.get(key, 0) + 1
            if self.counts[key] == 1:
                self.expirations[key] = seconds
            result.append(self.counts[key])
        return result

    async def ttl(self, key: str) -> int:
        return self.expirations.get(key, -1)

    async def aclose(self) -> None:
        self.close_calls += 1


def _request(client_host: str) -> Request:
    scope: Scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/api/auth/login",
        "raw_path": b"/api/auth/login",
        "query_string": b"",
        "headers": [],
        "client": (client_host, 54321),
        "server": ("api.respio.example", 443),
    }
    return Request(scope)


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    redis = FakeRedis()
    settings = Settings(rate_limit_enabled=True, redis_url=SecretStr("redis://localhost:6379/0"))

    def redis_from_url(_: str) -> FakeRedis:
        return redis

    monkeypatch.setattr(rate_limit_module, "get_settings", lambda: settings)
    monkeypatch.setattr(rate_limit_module, "redis_from_url", redis_from_url)
    return redis


@pytest.mark.asyncio
async def test_account_limit_cannot_be_bypassed_by_changing_ip(fake_redis: FakeRedis) -> None:
    for host in ("198.51.100.10", "198.51.100.11"):
        await enforce_auth_rate_limit(
            _request(host),
            scope="login",
            identifier="roman@example.com",
            limit=2,
            window_seconds=300,
        )

    with pytest.raises(HTTPException) as exc_info:
        await enforce_auth_rate_limit(
            _request("198.51.100.12"),
            scope="login",
            identifier="roman@example.com",
            limit=2,
            window_seconds=300,
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers == {"Retry-After": "300"}


@pytest.mark.asyncio
async def test_ip_limit_cannot_be_bypassed_by_changing_account(fake_redis: FakeRedis) -> None:
    for identifier in ("first@example.com", "second@example.com"):
        await enforce_auth_rate_limit(
            _request("198.51.100.20"),
            scope="login",
            identifier=identifier,
            limit=2,
            window_seconds=300,
        )

    with pytest.raises(HTTPException) as exc_info:
        await enforce_auth_rate_limit(
            _request("198.51.100.20"),
            scope="login",
            identifier="third@example.com",
            limit=2,
            window_seconds=300,
        )

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_limiter_keys_do_not_store_raw_identifiers(fake_redis: FakeRedis) -> None:
    await enforce_auth_rate_limit(
        _request("198.51.100.30"),
        scope="forgot-password",
        identifier="roman@example.com",
        limit=2,
        window_seconds=300,
    )

    assert len(fake_redis.counts) == 2
    for key in fake_redis.counts:
        assert "roman@example.com" not in key
        assert "198.51.100.30" not in key
