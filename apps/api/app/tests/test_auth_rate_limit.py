from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import cast

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.rate_limit import get_auth_rate_limiter
from app.main import create_app
from app.services.auth_rate_limit_service import (
    AuthRateLimiter,
    RateLimitDecision,
    RateLimitStoreError,
    RedisFixedWindowStore,
)


class _Store:
    def __init__(self, decisions: list[RateLimitDecision]) -> None:
        self.decisions = list(decisions)
        self.calls: list[tuple[str, int, int]] = []

    async def consume(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        self.calls.append((key, limit, window_seconds))
        return self.decisions.pop(0)


class _BrokenStore:
    async def consume(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        raise RateLimitStoreError("synthetic failure")


class _RedisClient:
    def __init__(self, response: object) -> None:
        self.response = response
        self.calls: list[tuple[str, int, tuple[str | int, ...]]] = []

    async def eval(self, script: str, numkeys: int, *values: str | int) -> object:
        self.calls.append((script, numkeys, values))
        return self.response


class _DenyLimiter:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None]] = []

    async def enforce_login(self, *, email: str, client_ip: str | None) -> None:
        self.calls.append((email, client_ip))
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts",
            headers={"Retry-After": "120"},
        )


@pytest.mark.asyncio
async def test_login_limiter_uses_hashed_account_and_ip_buckets() -> None:
    store = _Store(
        [
            RateLimitDecision(allowed=False, retry_after_seconds=91),
            RateLimitDecision(allowed=True, retry_after_seconds=0),
        ]
    )
    limiter = AuthRateLimiter(
        store=store,
        enabled=True,
        account_limit=20,
        ip_limit=100,
        window_seconds=900,
    )

    with pytest.raises(HTTPException) as exc_info:
        await limiter.enforce_login(email="Target@Example.com", client_ip="203.0.113.7")

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers == {"Retry-After": "91"}
    assert len(store.calls) == 2
    assert store.calls[0][1:] == (20, 900)
    assert store.calls[1][1:] == (100, 900)
    keys = [call[0] for call in store.calls]
    assert keys[0].startswith("mpreply:rate-limit:auth-login:account:")
    assert keys[1].startswith("mpreply:rate-limit:auth-login:ip:")
    assert all("target@example.com" not in key and "203.0.113.7" not in key for key in keys)


@pytest.mark.asyncio
async def test_login_limiter_fails_closed_when_store_is_unavailable() -> None:
    limiter = AuthRateLimiter(
        store=_BrokenStore(),
        enabled=True,
        account_limit=20,
        ip_limit=100,
        window_seconds=900,
    )

    with pytest.raises(HTTPException) as exc_info:
        await limiter.enforce_login(email="target@example.com", client_ip="203.0.113.7")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Authentication temporarily unavailable"


@pytest.mark.asyncio
async def test_redis_store_uses_atomic_counter_and_expiry_script() -> None:
    client = _RedisClient([21, 412])
    store = RedisFixedWindowStore(client)

    decision = await store.consume(key="bucket", limit=20, window_seconds=900)

    assert decision == RateLimitDecision(allowed=False, retry_after_seconds=412)
    script, numkeys, values = client.calls[0]
    assert "redis.call('INCR', KEYS[1])" in script
    assert "redis.call('EXPIRE', KEYS[1], ARGV[1])" in script
    assert numkeys == 1
    assert values == ("bucket", 900)


def test_login_route_stops_before_authentication_when_rate_limited() -> None:
    app = create_app()
    limiter = _DenyLimiter()

    async def _session() -> AsyncGenerator[AsyncSession]:
        yield cast(AsyncSession, object())

    app.dependency_overrides[get_auth_rate_limiter] = lambda: cast(AuthRateLimiter, limiter)
    app.dependency_overrides[get_db_session] = _session

    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "target@example.com", "password": "wrong-password"},
        )

    assert response.status_code == 429
    assert response.headers["retry-after"] == "120"
    assert response.json() == {"detail": "Too many authentication attempts"}
    assert len(limiter.calls) == 1
