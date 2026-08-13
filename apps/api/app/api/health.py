from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from time import perf_counter
from typing import Any, Literal, cast

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    app: str
    version: str
    environment: str
    timestamp: datetime


class DependencyHealth(BaseModel):
    status: Literal["ok", "error"]
    latency_ms: float
    error_code: str | None = None


class ReadinessResponse(BaseModel):
    status: Literal["ok", "error"]
    app: str
    version: str
    environment: str
    timestamp: datetime
    dependencies: dict[str, DependencyHealth]


@router.get("/health", response_model=HealthResponse)
@router.get("/health/live", response_model=HealthResponse)
async def healthcheck() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(UTC),
    )


@router.get("/health/ready", response_model=ReadinessResponse)
async def readiness_check() -> JSONResponse:
    settings = get_settings()
    database, redis = await asyncio.gather(
        _check_database(settings.readiness_timeout_seconds),
        _check_redis(settings.readiness_timeout_seconds),
    )
    dependencies = {"database": database, "redis": redis}
    ready = all(item.status == "ok" for item in dependencies.values())
    payload = ReadinessResponse(
        status="ok" if ready else "error",
        app=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(UTC),
        dependencies=dependencies,
    )
    return JSONResponse(status_code=200 if ready else 503, content=payload.model_dump(mode="json"))


async def _check_database(timeout_seconds: float) -> DependencyHealth:
    started_at = perf_counter()
    try:
        async with asyncio.timeout(timeout_seconds):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except Exception:
        return DependencyHealth(
            status="error",
            latency_ms=_elapsed_ms(started_at),
            error_code="database_unavailable",
        )
    return DependencyHealth(status="ok", latency_ms=_elapsed_ms(started_at))


async def _check_redis(timeout_seconds: float) -> DependencyHealth:
    settings = get_settings()
    started_at = perf_counter()
    client = cast(
        Redis,
        cast(Any, Redis).from_url(settings.redis_url.get_secret_value(), decode_responses=True),
    )
    try:
        async with asyncio.timeout(timeout_seconds):
            await cast(Any, client).ping()
    except Exception:
        return DependencyHealth(
            status="error",
            latency_ms=_elapsed_ms(started_at),
            error_code="redis_unavailable",
        )
    finally:
        await client.aclose()
    return DependencyHealth(status="ok", latency_ms=_elapsed_ms(started_at))


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)
