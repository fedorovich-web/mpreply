from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass
from typing import Protocol, cast

from fastapi import HTTPException, status
from redis.exceptions import RedisError

_FIXED_WINDOW_SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
""".strip()


class RateLimitStoreError(RuntimeError):
    pass


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int


@dataclass(frozen=True)
class AuthRateLimitPolicy:
    subject_limit: int
    ip_limit: int
    window_seconds: int


class RateLimitStore(Protocol):
    async def consume(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision: ...


class RateLimitRedisClient(Protocol):
    async def eval(self, script: str, numkeys: int, *values: str | int) -> object: ...


class RedisFixedWindowStore:
    def __init__(self, client: RateLimitRedisClient) -> None:
        self.client = client

    async def consume(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        response = await self.client.eval(_FIXED_WINDOW_SCRIPT, 1, key, window_seconds)
        if not isinstance(response, (list, tuple)):
            raise RateLimitStoreError("Redis returned an invalid rate-limit response")
        items = cast(list[object] | tuple[object, ...], response)
        if len(items) != 2:
            raise RateLimitStoreError("Redis returned an invalid rate-limit response")
        current, ttl = items
        if isinstance(current, bool) or not isinstance(current, int):
            raise RateLimitStoreError("Redis returned an invalid rate-limit counter")
        if isinstance(ttl, bool) or not isinstance(ttl, int):
            raise RateLimitStoreError("Redis returned an invalid rate-limit TTL")
        return RateLimitDecision(
            allowed=current <= limit,
            retry_after_seconds=max(ttl, 1) if current > limit else 0,
        )


class AuthRateLimiter:
    def __init__(
        self,
        *,
        store: RateLimitStore | None,
        enabled: bool,
        login_policy: AuthRateLimitPolicy,
        registration_policy: AuthRateLimitPolicy,
        refresh_policy: AuthRateLimitPolicy,
    ) -> None:
        self.store = store
        self.enabled = enabled
        self.login_policy = login_policy
        self.registration_policy = registration_policy
        self.refresh_policy = refresh_policy

    async def enforce_login(self, *, email: str, client_ip: str | None) -> None:
        await self._enforce(
            action="login",
            subject_dimension="account",
            subject=email.strip().lower(),
            client_ip=client_ip,
            policy=self.login_policy,
        )

    async def enforce_registration(self, *, email: str, client_ip: str | None) -> None:
        await self._enforce(
            action="register",
            subject_dimension="account",
            subject=email.strip().lower(),
            client_ip=client_ip,
            policy=self.registration_policy,
        )

    async def enforce_refresh(self, *, refresh_token: str, client_ip: str | None) -> None:
        await self._enforce(
            action="refresh",
            subject_dimension="token",
            subject=refresh_token,
            client_ip=client_ip,
            policy=self.refresh_policy,
        )

    async def _enforce(
        self,
        *,
        action: str,
        subject_dimension: str,
        subject: str,
        client_ip: str | None,
        policy: AuthRateLimitPolicy,
    ) -> None:
        if not self.enabled:
            return
        if self.store is None:
            raise self._unavailable()
        subject_key = self._bucket_key(action, subject_dimension, subject)
        ip_key = self._bucket_key(action, "ip", client_ip or "unknown")
        try:
            decisions = await asyncio.gather(
                self.store.consume(
                    key=subject_key,
                    limit=policy.subject_limit,
                    window_seconds=policy.window_seconds,
                ),
                self.store.consume(
                    key=ip_key,
                    limit=policy.ip_limit,
                    window_seconds=policy.window_seconds,
                ),
            )
        except (RateLimitStoreError, RedisError) as exc:
            raise self._unavailable() from exc
        blocked = [decision for decision in decisions if not decision.allowed]
        if blocked:
            retry_after = max(decision.retry_after_seconds for decision in blocked)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication attempts",
                headers={"Retry-After": str(retry_after)},
            )

    @staticmethod
    def _bucket_key(action: str, dimension: str, subject: str) -> str:
        digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()
        return f"mpreply:rate-limit:auth-{action}:{dimension}:{digest}"

    @staticmethod
    def _unavailable() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication temporarily unavailable",
        )
