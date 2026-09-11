from __future__ import annotations

from hashlib import sha256

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


def _rate_limit_key(*, scope: str, identifier: str) -> str:
    digest = sha256(identifier.strip().lower().encode("utf-8")).hexdigest()
    return f"rate-limit:auth:{scope}:{digest}"


async def enforce_auth_rate_limit(
    request: Request,
    *,
    scope: str,
    identifier: str,
    limit: int,
    window_seconds: int,
) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    client_host = request.client.host if request.client else "unknown"
    key = _rate_limit_key(scope=scope, identifier=f"{client_host}:{identifier}")
    redis = Redis.from_url(settings.redis_url.get_secret_value(), decode_responses=True)
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        if count > limit:
            ttl = await redis.ttl(key)
            retry_after = max(int(ttl), 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many authentication attempts",
                headers={"Retry-After": str(retry_after)},
            )
    except RedisError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication protection is temporarily unavailable",
        ) from exc
    finally:
        await redis.aclose()
