from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import health as health_module
from app.api.health import DependencyHealth
from app.main import app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_liveness_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_request_id_and_security_headers(client: AsyncClient) -> None:
    response = await client.get("/health/live", headers={"X-Request-ID": "qa-request-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "qa-request-123"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


@pytest.mark.asyncio
async def test_readiness_success(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def healthy_database(_: float) -> DependencyHealth:
        return DependencyHealth(status="ok", latency_ms=1.2)

    async def healthy_redis(_: float) -> DependencyHealth:
        return DependencyHealth(status="ok", latency_ms=0.8)

    monkeypatch.setattr(health_module, "_check_database", healthy_database)
    monkeypatch.setattr(health_module, "_check_redis", healthy_redis)

    response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_readiness_failure_returns_503(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def healthy_database(_: float) -> DependencyHealth:
        return DependencyHealth(status="ok", latency_ms=1.0)

    async def failed_redis(_: float) -> DependencyHealth:
        return DependencyHealth(status="error", latency_ms=3.0, error_code="redis_unavailable")

    monkeypatch.setattr(health_module, "_check_database", healthy_database)
    monkeypatch.setattr(health_module, "_check_redis", failed_redis)

    response = await client.get("/health/ready")

    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "error"
    assert payload["dependencies"]["redis"]["error_code"] == "redis_unavailable"
