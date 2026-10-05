from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

import httpx
from redis.exceptions import RedisError

from app.adapters.http import parse_retry_after
from app.core.config import get_settings
from app.core.rate_limit import redis_from_url

_ACQUIRE = """
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then return ttl end
if not redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', 45) then return 1 end
return 0
"""
_RELEASE = """
if tonumber(ARGV[2]) > 0 then
    local ttl = redis.call('TTL', KEYS[1])
    if ttl < tonumber(ARGV[2]) then redis.call('SET', KEYS[1], '1', 'EX', ARGV[2]) end
end
if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
return 0
"""


class WildberriesReadLimiter:
    """Share provider cooldowns between API, workers and duplicate connections."""

    async def read(self, credential: str, path: str, request: Callable[[], Awaitable[httpx.Response]]) -> httpx.Response:
        # Keys never contain a raw API token. Limits are method-specific; ping
        # has its own budget and must not block data synchronization.
        digest = sha256(f"{credential}\x00{path}".encode()).hexdigest()
        prefix = f"marketplace:wb:read:{digest}"
        keys = (f"{prefix}:cooldown", f"{prefix}:lock")
        owner = str(uuid4())
        redis = redis_from_url(get_settings().redis_url.get_secret_value())
        acquired = False
        cooldown = 0
        try:
            retry: object = await redis.eval(_ACQUIRE, len(keys), *keys, owner)
            if not isinstance(retry, int) or isinstance(retry, bool) or retry < 0:
                raise RedisError("Invalid marketplace limiter result")
            if retry:
                return httpx.Response(429, headers={"Retry-After": str(retry)})
            acquired = True
            response = await request()
            if response.status_code == 429:
                delays = [value for header in ("Retry-After", "X-Ratelimit-Retry")
                          if (value := parse_retry_after(response.headers.get(header), now=datetime.now(UTC), maximum_seconds=86400)) is not None]
                cooldown = max(delays, default=60)
            elif response.headers.get("X-Ratelimit-Remaining") == "0":
                cooldown = parse_retry_after(response.headers.get("X-Ratelimit-Reset"), now=datetime.now(UTC), maximum_seconds=86400) or 0
            return response
        except RedisError:
            # Do not send an uncoordinated request when the safety boundary is
            # unavailable. The normal scheduler backoff will try again later.
            return httpx.Response(503)
        finally:
            try:
                if acquired:
                    await redis.eval(_RELEASE, len(keys), *keys, owner, cooldown)
            finally:
                await redis.aclose()
