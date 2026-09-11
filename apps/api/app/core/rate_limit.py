from __future__ import annotations

from hashlib import sha256
from urllib.parse import parse_qs, unquote, urlsplit

from fastapi import HTTPException, Request, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


def _redis_from_url(url: str) -> Redis:
    parsed = urlsplit(url)
    if parsed.scheme not in {"redis", "rediss"}:
        raise ValueError("REDIS_URL must use redis:// or rediss://")
    if parsed.hostname is None:
        raise ValueError("REDIS_URL must include a host")

    query = parse_qs(parsed.query, strict_parsing=True) if parsed.query else {}
    unsupported = set(query) - {"db"}
    if unsupported:
        names = ", ".join(sorted(unsupported))
        raise ValueError(f"Unsupported REDIS_URL query parameters: {names}")

    path_db = parsed.path.removeprefix("/")
    db_value = query.get("db", [path_db or "0"])[0]
    try:
        db = int(db_value)
    except ValueError as exc:
        raise ValueError("REDIS_URL database must be an integer") from exc
    if db < 0:
        raise ValueError("REDIS_URL database must be non-negative")

    return Redis(
        host=parsed.hostname,
        port=parsed.port or 6379,
        db=db,
        username=unquote(parsed.username) if parsed.username else None,
        password=unquote(parsed.password) if parsed.password else None,
        ssl=parsed.scheme == "rediss",
        decode_responses=True,
    )


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
    redis = _redis_from_url(settings.redis_url.get_secret_value())
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
