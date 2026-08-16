from __future__ import annotations

import importlib
import importlib.util
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.llm_provider_setting import LLMProviderSetting
from app.models.user import User
from app.providers.openrouter import OpenRouterKeyMetadata, OpenRouterModel, OpenRouterProviderError
from app.schemas.llm_admin import LLMModelRoutesRequest, OpenRouterConfigurationUpdateRequest


def _route_values() -> dict[str, str]:
    return {
        "review_model": "approved/review",
        "negative_review_model": "approved/negative",
        "question_model": "approved/question",
        "chat_model": "approved/chat",
        "safety_retry_model": "approved/safety",
        "fallback_model": "approved/fallback",
    }


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _FakeSession:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows
        self.added: list[object] = []
        self.statements: list[object] = []
        self.flush_count = 0

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        if not self.rows:
            raise AssertionError("Unexpected database query")
        return _ScalarResult(self.rows.pop(0))

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


class _Credentials:
    def __init__(self) -> None:
        self.decrypt_calls = 0

    def encrypt(self, plaintext: str) -> str:
        return f"encrypted:{plaintext}"

    def decrypt(self, ciphertext: str) -> str:
        self.decrypt_calls += 1
        assert ciphertext.startswith("encrypted:")
        return ciphertext.removeprefix("encrypted:")

    @staticmethod
    def fingerprint(secret: str) -> str:
        return f"FINGERPRINT-{secret[-4:]}"

    @staticmethod
    def mask_fingerprint(fingerprint: str) -> str:
        return f"••••••••{fingerprint[-4:]}"


class _Provider:
    def __init__(
        self,
        *,
        metadata: OpenRouterKeyMetadata | None = None,
        models: list[OpenRouterModel] | None = None,
        error: OpenRouterProviderError | None = None,
    ) -> None:
        self.metadata = metadata or OpenRouterKeyMetadata(is_management_key=False, is_provisioning_key=False)
        self.models = models or []
        self.error = error

    async def get_current_key(self) -> OpenRouterKeyMetadata:
        if self.error is not None:
            raise self.error
        return self.metadata

    async def list_user_models(self) -> list[OpenRouterModel]:
        if self.error is not None:
            raise self.error
        return self.models


class _ProviderFactory:
    def __init__(self, provider: _Provider) -> None:
        self.provider = provider
        self.keys: list[str] = []

    def __call__(self, key: str) -> _Provider:
        self.keys.append(key)
        return self.provider


def _settings(*, environment_key: str = "sk-or-v1-environment-key") -> SimpleNamespace:
    return SimpleNamespace(
        openrouter_api_key=SecretStr(environment_key),
        openrouter_default_model="approved/environment-default",
        openrouter_fallback_model="approved/environment-fallback",
        openrouter_base_url="https://openrouter.ai/api/v1",
        public_site_url="https://mpreply.example",
        app_name="MPReply",
        openrouter_timeout_seconds=45.0,
        credentials_encryption_key=SecretStr("unused-in-injected-tests"),
    )


def _actor() -> User:
    return User(
        id=uuid4(),
        email="superadmin@example.com",
        name="Superadmin",
        password_hash="hashed",
        status="active",
        is_superadmin=True,
    )


def _row(
    *,
    enabled: bool = True,
    api_key_encrypted: str | None = "encrypted:sk-or-v1-database-key",
    routes: dict[str, str] | None = None,
) -> LLMProviderSetting:
    values = routes or _route_values()
    return LLMProviderSetting(
        id=uuid4(),
        provider="openrouter",
        enabled=enabled,
        api_key_encrypted=api_key_encrypted,
        credential_fingerprint="FINGERPRINT--key" if api_key_encrypted else None,
        validated_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
        updated_at=datetime(2026, 8, 16, 9, 0, tzinfo=UTC),
        **values,
    )


def _catalog_models() -> list[OpenRouterModel]:
    return [
        OpenRouterModel(
            id=model_id,
            name=model_id,
            input_modalities=("text",),
            output_modalities=("text",),
            context_length=128000,
            prompt_price=None,
            completion_price=None,
            expiration_date=None,
        )
        for model_id in _route_values().values()
    ]


def _service_module():
    assert importlib.util.find_spec("app.services.llm_configuration_service") is not None
    return importlib.import_module("app.services.llm_configuration_service")


@pytest.mark.parametrize(
    ("message_type", "rating", "expected"),
    [
        ("review", 1, "approved/negative"),
        ("review", 2, "approved/negative"),
        ("review", 3, "approved/review"),
        ("review", None, "approved/review"),
        ("question", None, "approved/question"),
        ("chat", None, "approved/chat"),
    ],
)
def test_route_resolver_selects_the_approved_scenario_model(
    message_type: str,
    rating: int | None,
    expected: str,
) -> None:
    assert importlib.util.find_spec("app.services.llm_route_resolver") is not None
    resolver_module = importlib.import_module("app.services.llm_route_resolver")
    routes = resolver_module.LLMModelRoutes(**_route_values())

    assert resolver_module.LLMRouteResolver.select_model(
        routes,
        message_type=message_type,
        rating=rating,
    ) == expected


def test_route_resolver_rejects_an_unsupported_message_type() -> None:
    assert importlib.util.find_spec("app.services.llm_route_resolver") is not None
    resolver_module = importlib.import_module("app.services.llm_route_resolver")
    routes = resolver_module.LLMModelRoutes(**_route_values())

    with pytest.raises(resolver_module.LLMConfigurationError) as exc_info:
        resolver_module.LLMRouteResolver.select_model(routes, message_type="unsupported", rating=None)

    assert exc_info.value.error_code == "openrouter_unsupported_message_type"


async def test_runtime_uses_environment_bootstrap_when_database_row_is_absent() -> None:
    service_module = _service_module()
    session = _FakeSession([None])
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=_ProviderFactory(_Provider()),
    )

    runtime = await service.resolve_runtime()

    assert runtime.api_key == "sk-or-v1-environment-key"
    assert runtime.source == "environment"
    assert runtime.routes.review_model == "approved/environment-default"
    assert runtime.routes.safety_retry_model == "approved/environment-fallback"


async def test_explicit_disable_overrides_database_and_environment_keys_before_decrypt() -> None:
    service_module = _service_module()
    credentials = _Credentials()
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, _FakeSession([_row(enabled=False)])),
        settings=cast(object, _settings()),
        credentials=cast(object, credentials),
        provider_factory=_ProviderFactory(_Provider()),
    )

    with pytest.raises(service_module.LLMConfigurationError) as exc_info:
        await service.resolve_runtime()

    assert exc_info.value.error_code == "openrouter_disabled"
    assert credentials.decrypt_calls == 0


async def test_database_key_and_routes_take_precedence() -> None:
    service_module = _service_module()
    factory = _ProviderFactory(_Provider())
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, _FakeSession([_row()])),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=factory,
    )

    runtime = await service.resolve_runtime()

    assert runtime.api_key == "sk-or-v1-database-key"
    assert runtime.source == "database"
    assert runtime.routes.review_model == "approved/review"


async def test_failed_rotation_preserves_the_existing_key_and_routes() -> None:
    service_module = _service_module()
    existing = _row()
    original_ciphertext = existing.api_key_encrypted
    original_routes = existing.review_model
    session = _FakeSession([existing])
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=_ProviderFactory(
            _Provider(error=OpenRouterProviderError("provider-secret", error_code="openrouter_auth_error"))
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.save_configuration(
            actor=_actor(),
            payload=OpenRouterConfigurationUpdateRequest(
                api_key=SecretStr("sk-or-v1-invalid-rotation"),
                routes=LLMModelRoutesRequest(**_route_values()),
            ),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Ключ OpenRouter недействителен."
    assert existing.api_key_encrypted == original_ciphertext
    assert existing.review_model == original_routes
    assert session.added == []


async def test_successful_rotation_is_encrypted_and_writes_only_safe_audit_metadata() -> None:
    service_module = _service_module()
    now = datetime(2026, 8, 16, 10, 30, tzinfo=UTC)
    existing = _row()
    session = _FakeSession([existing])
    candidate_key = "sk-or-v1-rotated-key"
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=_ProviderFactory(_Provider(models=_catalog_models())),
        now=lambda: now,
    )

    response = await service.save_configuration(
        actor=_actor(),
        payload=OpenRouterConfigurationUpdateRequest(
            api_key=SecretStr(candidate_key),
            routes=LLMModelRoutesRequest(**_route_values()),
        ),
    )

    assert existing.api_key_encrypted == f"encrypted:{candidate_key}"
    assert existing.api_key_encrypted != candidate_key
    assert response.state == "active"
    audits = [item for item in session.added if isinstance(item, AuditLog)]
    assert len(audits) == 1
    audit_payload = audits[0].metadata_json
    assert audit_payload["provider"] == "openrouter"
    assert audit_payload["models"] == _route_values()
    assert candidate_key not in repr(audit_payload)
    assert "encrypted:" not in repr(audit_payload)


async def test_management_key_is_rejected_without_writing_configuration() -> None:
    service_module = _service_module()
    session = _FakeSession([])
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=_ProviderFactory(
            _Provider(
                metadata=OpenRouterKeyMetadata(is_management_key=True, is_provisioning_key=False),
                models=_catalog_models(),
            )
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.validate_candidate(actor=_actor(), api_key="sk-or-v1-management-key")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Нужен обычный inference-ключ OpenRouter."
    assert session.added == []


async def test_safe_configuration_reports_environment_source_without_key_material() -> None:
    service_module = _service_module()
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, _FakeSession([None])),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=_ProviderFactory(_Provider()),
    )

    response = await service.get_safe_configuration()
    payload = response.model_dump(mode="json")

    assert response.state == "active"
    assert response.source == "environment"
    assert "api_key" not in payload
    assert "encrypted" not in repr(payload)
    assert "sk-or-v1-environment-key" not in repr(payload)


async def test_refresh_models_uses_current_database_key_and_writes_safe_audit() -> None:
    service_module = _service_module()
    session = _FakeSession([_row()])
    factory = _ProviderFactory(_Provider(models=_catalog_models()))
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=factory,
        now=lambda: datetime(2026, 8, 16, 11, 0, tzinfo=UTC),
    )

    catalog = await service.refresh_models(actor=_actor())

    assert factory.keys == ["sk-or-v1-database-key"]
    assert {item.id for item in catalog.items} == set(_route_values().values())
    audits = [item for item in session.added if isinstance(item, AuditLog)]
    assert audits[0].metadata_json == {
        "provider": "openrouter",
        "source": "database",
        "model_count": 6,
    }


async def test_disable_is_authoritative_without_decrypting_or_calling_provider() -> None:
    service_module = _service_module()
    existing = _row()
    credentials = _Credentials()
    factory = _ProviderFactory(_Provider())
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, _FakeSession([existing])),
        settings=cast(object, _settings()),
        credentials=cast(object, credentials),
        provider_factory=factory,
    )

    response = await service.disable(actor=_actor())

    assert response.state == "disabled"
    assert existing.enabled is False
    assert credentials.decrypt_calls == 0
    assert factory.keys == []


async def test_remove_local_key_clears_ciphertext_but_does_not_claim_provider_revocation() -> None:
    service_module = _service_module()
    existing = _row()
    session = _FakeSession([existing])
    factory = _ProviderFactory(_Provider())
    service = service_module.LLMConfigurationService(
        cast(AsyncSession, session),
        settings=cast(object, _settings()),
        credentials=cast(object, _Credentials()),
        provider_factory=factory,
    )

    response = await service.remove_local_key(actor=_actor())

    assert response.state == "disabled"
    assert existing.api_key_encrypted is None
    assert existing.credential_fingerprint is None
    assert factory.keys == []
    audit = next(item for item in session.added if isinstance(item, AuditLog))
    assert audit.action == "admin.llm_key_removed"
    assert audit.metadata_json["provider_key_revoked"] is False
    assert "sk-or-v1-database-key" not in repr(audit.metadata_json)
