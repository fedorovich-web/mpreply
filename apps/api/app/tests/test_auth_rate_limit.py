from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import cast

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.rate_limit import get_auth_rate_limiter
from app.main import create_app
from app.services.auth_rate_limit_service import (
    AuthRateLimiter,
    AuthRateLimitPolicy,
    RateLimitDecision,
    RateLimitStoreError,
    RedisFixedWindowStore,
)
from app.services.auth_service import AuthService


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
        self.calls: list[tuple[str, str, str | None]] = []

    async def enforce_login(self, *, email: str, client_ip: str | None) -> None:
        self.calls.append(("login", email, client_ip))
        self._raise()

    async def enforce_registration(self, *, email: str, client_ip: str | None) -> None:
        self.calls.append(("registration", email, client_ip))
        self._raise()

    async def enforce_refresh(self, *, refresh_token: str, client_ip: str | None) -> None:
        self.calls.append(("refresh", refresh_token, client_ip))
        self._raise()

    @staticmethod
    def _raise() -> None:
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts",
            headers={"Retry-After": "120"},
        )


class _DuplicateSession:
    def __init__(self) -> None:
        self.rollback_calls = 0

    def add(self, instance: object) -> None:
        del instance

    async def flush(self) -> None:
        raise IntegrityError("INSERT", {}, RuntimeError("duplicate"))

    async def rollback(self) -> None:
        self.rollback_calls += 1


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
        login_policy=AuthRateLimitPolicy(subject_limit=20, ip_limit=100, window_seconds=900),
        registration_policy=AuthRateLimitPolicy(subject_limit=5, ip_limit=20, window_seconds=3600),
        refresh_policy=AuthRateLimitPolicy(subject_limit=120, ip_limit=600, window_seconds=900),
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
        login_policy=AuthRateLimitPolicy(subject_limit=20, ip_limit=100, window_seconds=900),
        registration_policy=AuthRateLimitPolicy(subject_limit=5, ip_limit=20, window_seconds=3600),
        refresh_policy=AuthRateLimitPolicy(subject_limit=120, ip_limit=600, window_seconds=900),
    )

    with pytest.raises(HTTPException) as exc_info:
        await limiter.enforce_login(email="target@example.com", client_ip="203.0.113.7")

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Authentication temporarily unavailable"


@pytest.mark.asyncio
async def test_registration_limiter_uses_action_specific_hashed_buckets() -> None:
    store = _Store(
        [
            RateLimitDecision(allowed=True, retry_after_seconds=0),
            RateLimitDecision(allowed=True, retry_after_seconds=0),
        ]
    )
    limiter = AuthRateLimiter(
        store=store,
        enabled=True,
        login_policy=AuthRateLimitPolicy(subject_limit=20, ip_limit=100, window_seconds=900),
        registration_policy=AuthRateLimitPolicy(subject_limit=5, ip_limit=20, window_seconds=3600),
        refresh_policy=AuthRateLimitPolicy(subject_limit=120, ip_limit=600, window_seconds=900),
    )

    await limiter.enforce_registration(email="Target@Example.com", client_ip="203.0.113.7")

    assert [call[1:] for call in store.calls] == [(5, 3600), (20, 3600)]
    keys = [call[0] for call in store.calls]
    assert keys[0].startswith("mpreply:rate-limit:auth-register:account:")
    assert keys[1].startswith("mpreply:rate-limit:auth-register:ip:")
    assert all("target@example.com" not in key and "203.0.113.7" not in key for key in keys)


@pytest.mark.asyncio
async def test_refresh_limiter_never_exposes_refresh_token_in_bucket_keys() -> None:
    store = _Store(
        [
            RateLimitDecision(allowed=True, retry_after_seconds=0),
            RateLimitDecision(allowed=False, retry_after_seconds=77),
        ]
    )
    limiter = AuthRateLimiter(
        store=store,
        enabled=True,
        login_policy=AuthRateLimitPolicy(subject_limit=20, ip_limit=100, window_seconds=900),
        registration_policy=AuthRateLimitPolicy(subject_limit=5, ip_limit=20, window_seconds=3600),
        refresh_policy=AuthRateLimitPolicy(subject_limit=120, ip_limit=600, window_seconds=900),
    )

    with pytest.raises(HTTPException) as exc_info:
        await limiter.enforce_refresh(refresh_token="raw-refresh-secret", client_ip="203.0.113.7")

    assert exc_info.value.status_code == 429
    assert exc_info.value.headers == {"Retry-After": "77"}
    assert [call[1:] for call in store.calls] == [(120, 900), (600, 900)]
    keys = [call[0] for call in store.calls]
    assert keys[0].startswith("mpreply:rate-limit:auth-refresh:token:")
    assert keys[1].startswith("mpreply:rate-limit:auth-refresh:ip:")
    assert all("raw-refresh-secret" not in key and "203.0.113.7" not in key for key in keys)


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

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "target@example.com", "password": "wrong-password"},
            headers={"X-CSRF-Token": "1"},
        )

    assert response.status_code == 429
    assert response.headers["retry-after"] == "120"
    assert response.json() == {"detail": "Too many authentication attempts"}
    assert len(limiter.calls) == 1


def test_registration_route_stops_before_password_hashing_when_rate_limited() -> None:
    app = create_app()
    limiter = _DenyLimiter()

    async def _session() -> AsyncGenerator[AsyncSession]:
        yield cast(AsyncSession, object())

    app.dependency_overrides[get_auth_rate_limiter] = lambda: cast(AuthRateLimiter, limiter)
    app.dependency_overrides[get_db_session] = _session

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/auth/register",
            json={"email": "target@example.com", "password": "long-enough-password"},
            headers={"X-CSRF-Token": "1"},
        )

    assert response.status_code == 429
    assert limiter.calls == [("registration", "target@example.com", "testclient")]


def test_refresh_route_stops_before_token_rotation_when_rate_limited() -> None:
    app = create_app()
    limiter = _DenyLimiter()

    async def _session() -> AsyncGenerator[AsyncSession]:
        yield cast(AsyncSession, object())

    app.dependency_overrides[get_auth_rate_limiter] = lambda: cast(AuthRateLimiter, limiter)
    app.dependency_overrides[get_db_session] = _session

    with TestClient(app, raise_server_exceptions=False) as client:
        client.cookies.set("mpreply_refresh", "raw-refresh-secret")
        response = client.post(
            "/api/auth/refresh",
            headers={"X-CSRF-Token": "1"},
        )

    assert response.status_code == 429
    assert limiter.calls == [("refresh", "raw-refresh-secret", "testclient")]


@pytest.mark.asyncio
async def test_duplicate_registration_does_not_disclose_account_existence(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _DuplicateSession()

    def _hash_password(password: str) -> str:
        return f"hash:{password}"

    monkeypatch.setattr("app.services.auth_service.hash_password", _hash_password)

    with pytest.raises(HTTPException) as exc_info:
        await AuthService(cast(AsyncSession, session)).register_user(
            email="target@example.com",
            password="long-enough-password",
            name=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Unable to register with provided credentials"
    assert "target@example.com" not in str(exc_info.value.detail)
    assert "exists" not in str(exc_info.value.detail).lower()
    assert session.rollback_calls == 1
