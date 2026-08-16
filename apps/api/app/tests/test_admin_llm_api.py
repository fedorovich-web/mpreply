from __future__ import annotations

import importlib
import importlib.util
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.llm_admin import (
    LLMModelRoutesRequest,
    OpenRouterCatalogResponse,
    OpenRouterConfigurationResponse,
    OpenRouterConfigurationUpdateRequest,
)


def _routes() -> dict[str, str]:
    return {
        "review_model": "approved/review",
        "negative_review_model": "approved/negative",
        "question_model": "approved/question",
        "chat_model": "approved/chat",
        "safety_retry_model": "approved/safety",
        "fallback_model": "approved/fallback",
    }


def _configuration() -> OpenRouterConfigurationResponse:
    return OpenRouterConfigurationResponse(
        state="active",
        source="database",
        enabled=True,
        credential_fingerprint_masked="••••••••A1B2",
        validated_at=datetime(2026, 8, 16, 10, 0, tzinfo=UTC),
        updated_at=datetime(2026, 8, 16, 10, 0, tzinfo=UTC),
        routes=LLMModelRoutesRequest(**_routes()),
    )


def _user(*, is_superadmin: bool) -> User:
    return User(
        id=uuid4(),
        email="admin@example.com",
        name="Admin",
        password_hash="hashed",
        status="active",
        is_superadmin=is_superadmin,
    )


class _Session:
    def __init__(self) -> None:
        self.commit_count = 0

    async def commit(self) -> None:
        self.commit_count += 1


class _Service:
    def __init__(self) -> None:
        self.saved_key: str | None = None

    async def get_safe_configuration(self) -> OpenRouterConfigurationResponse:
        return _configuration()

    async def validate_candidate(self, *, actor: User, api_key: str) -> OpenRouterCatalogResponse:
        self.saved_key = api_key
        return OpenRouterCatalogResponse(validated_at=datetime(2026, 8, 16, 10, 0, tzinfo=UTC), items=[])

    async def refresh_models(self, *, actor: User) -> OpenRouterCatalogResponse:
        return OpenRouterCatalogResponse(validated_at=datetime(2026, 8, 16, 10, 0, tzinfo=UTC), items=[])

    async def save_configuration(
        self,
        *,
        actor: User,
        payload: OpenRouterConfigurationUpdateRequest,
    ) -> OpenRouterConfigurationResponse:
        api_key = payload.api_key
        self.saved_key = api_key.get_secret_value() if api_key is not None else None
        return _configuration()

    async def disable(self, *, actor: User) -> OpenRouterConfigurationResponse:
        return _configuration().model_copy(update={"state": "disabled", "enabled": False})

    async def remove_local_key(self, *, actor: User) -> OpenRouterConfigurationResponse:
        return _configuration().model_copy(
            update={"state": "disabled", "source": "none", "enabled": False, "credential_fingerprint_masked": None}
        )


def _router_module():
    assert importlib.util.find_spec("app.api.admin_llm") is not None
    return importlib.import_module("app.api.admin_llm")


def test_admin_llm_router_exposes_only_the_approved_method_path_pairs() -> None:
    router_module = _router_module()
    methods_by_path: dict[str, set[str]] = {}
    for route in router_module.router.routes:
        methods_by_path.setdefault(route.path, set()).update(route.methods or set())

    assert methods_by_path == {
        "/api/admin/llm/openrouter": {"GET", "PUT"},
        "/api/admin/llm/openrouter/validate": {"POST"},
        "/api/admin/llm/openrouter/models/refresh": {"POST"},
        "/api/admin/llm/openrouter/disable": {"POST"},
        "/api/admin/llm/openrouter/key": {"DELETE"},
    }


def test_regular_user_is_rejected_before_database_session_resolution() -> None:
    router_module = _router_module()
    app = FastAPI()
    app.include_router(router_module.router)
    session_requested = False

    async def session_dependency() -> AsyncGenerator[object]:
        nonlocal session_requested
        session_requested = True
        yield object()

    app.dependency_overrides[get_current_user] = lambda: _user(is_superadmin=False)
    app.dependency_overrides[get_db_session] = session_dependency

    response = TestClient(app).get("/api/admin/llm/openrouter")

    assert response.status_code == 403
    assert session_requested is False


def test_superadmin_put_saves_safe_configuration_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    router_module = _router_module()
    app = FastAPI()
    app.include_router(router_module.router)
    session = _Session()
    service = _Service()

    async def session_dependency() -> AsyncGenerator[object]:
        yield session

    app.dependency_overrides[get_current_user] = lambda: _user(is_superadmin=True)
    app.dependency_overrides[get_db_session] = session_dependency
    def service_factory(_: object) -> _Service:
        return service

    monkeypatch.setattr(router_module, "LLMConfigurationService", service_factory)

    response = TestClient(app).put(
        "/api/admin/llm/openrouter",
        json={"api_key": "sk-or-v1-candidate-key", "routes": _routes()},
    )

    assert response.status_code == 200
    payload = cast(dict[str, object], response.json())
    assert payload["state"] == "active"
    assert "api_key" not in payload
    assert service.saved_key == "sk-or-v1-candidate-key"
    assert session.commit_count == 1
