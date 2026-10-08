from __future__ import annotations

import io
import json
import re
import urllib.error
import urllib.request
from email.message import Message
from pathlib import Path
from typing import cast

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import health

ROOT = Path(__file__).resolve().parents[4]


@pytest.mark.parametrize("source", ["compose", "dockerfile"])
def test_container_healthcheck_passes_production_host_guard(source: str, monkeypatch: pytest.MonkeyPatch) -> None:
    if source == "compose":
        manifest = (ROOT / "infra/docker/docker-compose.production.yml").read_text(encoding="utf-8")
        line = next(line.strip() for line in manifest.splitlines() if '"CMD", "python", "-c"' in line)
        command = json.loads(line.removeprefix("test: "))[3]
    else:
        dockerfile = (ROOT / "apps/api/Dockerfile").read_text(encoding="utf-8")
        match = re.search(r'CMD python -c "(.+)"', dockerfile)
        assert match is not None
        command = match.group(1)

    async def healthy_dependency(timeout_seconds: float) -> health.DependencyHealth:
        return health.DependencyHealth(status="ok", latency_ms=0)

    monkeypatch.setattr(health, "_check_database", healthy_dependency)
    monkeypatch.setattr(health, "_check_redis", healthy_dependency)
    monkeypatch.setenv("API_BASE_URL", "https://api.mpreply.ru")
    application = FastAPI()
    application.include_router(health.router)
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.mpreply.ru"])
    client = cast(httpx.Client, TestClient(application))

    def request_through_host_guard(request: str | urllib.request.Request, timeout: float) -> io.BytesIO:
        url = request if isinstance(request, str) else request.full_url
        headers = {} if isinstance(request, str) else dict(request.header_items())
        response = client.get(url, headers=headers)
        if response.status_code != 200:
            response_headers: Message[str, str] = Message()
            raise urllib.error.HTTPError(url, response.status_code, response.text, response_headers, None)
        return io.BytesIO(response.content)

    monkeypatch.setattr(urllib.request, "urlopen", request_through_host_guard)
    exec(compile(command, f"<production-{source}-healthcheck>", "exec"), {})


def test_production_health_host_guard_still_rejects_loopback() -> None:
    application = FastAPI()
    application.include_router(health.router)
    application.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.mpreply.ru"])
    client = cast(httpx.Client, TestClient(application))
    response = client.get("http://127.0.0.1:8000/health/live")
    assert response.status_code == 400
