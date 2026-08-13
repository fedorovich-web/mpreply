from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any, cast

from fastapi import FastAPI
from redis.asyncio import Redis

from app.core.config import get_settings
from app.db.session import engine
from app.services.auth_rate_limit_service import (
    AuthRateLimiter,
    AuthRateLimitPolicy,
    RateLimitRedisClient,
    RedisFixedWindowStore,
)


@asynccontextmanager
async def application_lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings = get_settings()
    redis_client: Redis | None = None
    if settings.rate_limit_enabled:
        redis_client = cast(
            Redis,
            cast(Any, Redis).from_url(settings.redis_url.get_secret_value(), decode_responses=True),
        )
    app.state.auth_rate_limiter = AuthRateLimiter(
        store=RedisFixedWindowStore(cast(RateLimitRedisClient, redis_client)) if redis_client is not None else None,
        enabled=settings.rate_limit_enabled,
        login_policy=AuthRateLimitPolicy(
            subject_limit=settings.auth_login_account_limit,
            ip_limit=settings.auth_login_ip_limit,
            window_seconds=settings.auth_login_rate_limit_window_seconds,
        ),
        registration_policy=AuthRateLimitPolicy(
            subject_limit=settings.auth_registration_account_limit,
            ip_limit=settings.auth_registration_ip_limit,
            window_seconds=settings.auth_registration_rate_limit_window_seconds,
        ),
        refresh_policy=AuthRateLimitPolicy(
            subject_limit=settings.auth_refresh_token_limit,
            ip_limit=settings.auth_refresh_ip_limit,
            window_seconds=settings.auth_refresh_rate_limit_window_seconds,
        ),
    )
    try:
        yield
    finally:
        if redis_client is not None:
            await redis_client.aclose()
        await engine.dispose()
