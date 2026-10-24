from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

import httpx
import structlog
from redis.exceptions import RedisError

from app.adapters.http import parse_retry_after
from app.adapters.wildberries_token import quota_identity
from app.core.config import get_settings
from app.core.rate_limit import redis_from_url

logger = structlog.get_logger(__name__)


class WildberriesCoordinationUnavailable(RuntimeError):
    pass

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


class WildberriesRequestLimiter:

    async def request(self, credential: str, path: str, request: Callable[[], Awaitable[httpx.Response]]) -> httpx.Response:
        category = "ping" if path == "/ping" else "feedbacks-and-questions"
        digest = sha256(f"{quota_identity(credential)}\x00{category}".encode()).hexdigest()
        prefix = f"marketplace:wb:category:v2:{digest}"
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
        except RedisError as exc:
            raise WildberriesCoordinationUnavailable("WB request coordination is unavailable") from exc
        finally:
            try:
                if acquired:
                    try:
                        await redis.eval(_RELEASE, len(keys), *keys, owner, cooldown)
                    except RedisError:
                        logger.warning("wb_request_coordination_release_failed")
            finally:
                try:
                    await redis.aclose()
                except RedisError:
                    logger.warning("wb_request_coordination_close_failed")
