from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal, NoReturn, Protocol, cast

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import bad_request
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.llm_provider_setting import LLMProviderSetting
from app.models.user import User
from app.providers.openrouter import (
    OpenRouterKeyMetadata,
    OpenRouterModel,
    OpenRouterProvider,
    OpenRouterProviderError,
)
from app.schemas.llm_admin import (
    LLMModelRoutesRequest,
    OpenRouterCatalogModelResponse,
    OpenRouterCatalogResponse,
    OpenRouterConfigurationResponse,
    OpenRouterConfigurationUpdateRequest,
)
from app.services.audit_service import AuditService
from app.services.llm_route_resolver import LLMConfigurationError, LLMModelRoutes, LLMRuntimeConfiguration

_PROVIDER = "openrouter"


class _CredentialCodec(Protocol):
    def encrypt(self, plaintext: str) -> str: ...

    def decrypt(self, ciphertext: str) -> str: ...

    def fingerprint(self, secret: str) -> str: ...

    def mask_fingerprint(self, fingerprint: str) -> str: ...


class _OpenRouterClient(Protocol):
    async def get_current_key(self) -> OpenRouterKeyMetadata: ...

    async def list_user_models(self) -> list[OpenRouterModel]: ...


class LLMConfigurationService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: Settings | None = None,
        credentials: _CredentialCodec | None = None,
        provider_factory: Callable[[str], _OpenRouterClient] | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.settings = settings or get_settings()
        self.credentials = credentials or CredentialService(
            self.settings.credentials_encryption_key.get_secret_value()
        )
        self.provider_factory = provider_factory or self._default_provider
        self.now = now or (lambda: datetime.now(UTC))
        self.audit = AuditService(session)

    async def resolve_runtime(self) -> LLMRuntimeConfiguration:
        row = await self._get_row()
        if row is not None and not row.enabled:
            raise LLMConfigurationError("openrouter_disabled")
        source, api_key = self._effective_key(row)
        return LLMRuntimeConfiguration(
            api_key=api_key,
            source=source,
            routes=self._effective_routes(row),
        )

    async def get_safe_configuration(self) -> OpenRouterConfigurationResponse:
        row = await self._get_row()
        return self._safe_configuration(row)

    async def validate_candidate(self, *, actor: User, api_key: str) -> OpenRouterCatalogResponse:
        catalog = await self._validate_key_and_catalog(api_key)
        fingerprint = self.credentials.fingerprint(api_key)
        await self.audit.write(
            action="admin.llm_key_validated",
            entity_type="llm_provider_setting",
            actor_user_id=actor.id,
            entity_id=_PROVIDER,
            metadata={
                "provider": _PROVIDER,
                "credential_fingerprint_masked": self.credentials.mask_fingerprint(fingerprint),
                "model_count": len(catalog),
            },
        )
        return self._catalog_response(catalog)

    async def refresh_models(self, *, actor: User) -> OpenRouterCatalogResponse:
        runtime = await self.resolve_runtime()
        catalog = await self._validate_key_and_catalog(runtime.api_key)
        await self.audit.write(
            action="admin.llm_key_validated",
            entity_type="llm_provider_setting",
            actor_user_id=actor.id,
            entity_id=_PROVIDER,
            metadata={
                "provider": _PROVIDER,
                "source": runtime.source,
                "model_count": len(catalog),
            },
        )
        return self._catalog_response(catalog)

    async def save_configuration(
        self,
        *,
        actor: User,
        payload: OpenRouterConfigurationUpdateRequest,
    ) -> OpenRouterConfigurationResponse:
        row = await self._get_row()
        candidate = payload.api_key.get_secret_value().strip() if payload.api_key is not None else None
        if candidate is not None:
            api_key = candidate
        else:
            _, api_key = self._effective_key(row)

        catalog = await self._validate_key_and_catalog(api_key)
        available_ids = {model.id for model in catalog}
        selected_ids = set(payload.routes.model_dump().values())
        unavailable = sorted(selected_ids - available_ids)
        if unavailable:
            raise bad_request("Одна или несколько выбранных моделей недоступны для этого ключа OpenRouter.")

        if row is None:
            row = LLMProviderSetting(provider=_PROVIDER, enabled=True)
            self.session.add(row)
        if candidate is not None:
            row.api_key_encrypted = self.credentials.encrypt(candidate)
            row.credential_fingerprint = self.credentials.fingerprint(candidate)
        self._assign_routes(row, payload.routes)
        row.enabled = True
        row.validated_at = self.now()
        row.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="admin.llm_configuration_updated",
            entity_type="llm_provider_setting",
            actor_user_id=actor.id,
            entity_id=_PROVIDER,
            metadata={
                "provider": _PROVIDER,
                "source": "database" if row.api_key_encrypted else "environment",
                "credential_fingerprint_masked": self._masked_fingerprint(row),
                "models": payload.routes.model_dump(),
            },
        )
        return self._safe_configuration(row)

    async def disable(self, *, actor: User) -> OpenRouterConfigurationResponse:
        row = await self._get_row()
        if row is None:
            row = LLMProviderSetting(provider=_PROVIDER, enabled=False)
            self.session.add(row)
        row.enabled = False
        row.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="admin.llm_provider_disabled",
            entity_type="llm_provider_setting",
            actor_user_id=actor.id,
            entity_id=_PROVIDER,
            metadata={"provider": _PROVIDER, "source": self._source(row)},
        )
        return self._safe_configuration(row)

    async def remove_local_key(self, *, actor: User) -> OpenRouterConfigurationResponse:
        row = await self._get_row()
        if row is None:
            row = LLMProviderSetting(provider=_PROVIDER, enabled=False)
            self.session.add(row)
        removed_fingerprint = self._masked_fingerprint(row)
        row.api_key_encrypted = None
        row.credential_fingerprint = None
        row.enabled = False
        row.updated_by = actor.id
        await self.session.flush()
        await self.audit.write(
            action="admin.llm_key_removed",
            entity_type="llm_provider_setting",
            actor_user_id=actor.id,
            entity_id=_PROVIDER,
            metadata={
                "provider": _PROVIDER,
                "removed_fingerprint_masked": removed_fingerprint,
                "provider_key_revoked": False,
            },
        )
        return self._safe_configuration(row)

    async def _get_row(self) -> LLMProviderSetting | None:
        result = await self.session.execute(
            select(LLMProviderSetting).where(LLMProviderSetting.provider == _PROVIDER)
        )
        return result.scalar_one_or_none()

    def _effective_key(
        self, row: LLMProviderSetting | None
    ) -> tuple[Literal["database", "environment"], str]:
        if row is not None and row.api_key_encrypted:
            try:
                return "database", self.credentials.decrypt(row.api_key_encrypted)
            except CredentialEncryptionError as exc:
                raise LLMConfigurationError("openrouter_configuration_error") from exc
        environment_key = self._environment_key()
        if environment_key is not None:
            return "environment", environment_key
        raise LLMConfigurationError("openrouter_not_configured")

    def _environment_key(self) -> str | None:
        value = self.settings.openrouter_api_key.get_secret_value().strip()
        if not value or value.startswith("replace-"):
            return None
        return value

    def _effective_routes(self, row: LLMProviderSetting | None) -> LLMModelRoutes:
        if row is not None:
            values = (
                row.review_model,
                row.negative_review_model,
                row.question_model,
                row.chat_model,
                row.safety_retry_model,
                row.fallback_model,
            )
            if all(value is not None for value in values):
                return LLMModelRoutes(*cast(tuple[str, str, str, str, str, str], values))
            if any(value is not None for value in values):
                raise LLMConfigurationError("openrouter_configuration_error")
        return LLMModelRoutes(
            review_model=self.settings.openrouter_default_model,
            negative_review_model=self.settings.openrouter_default_model,
            question_model=self.settings.openrouter_default_model,
            chat_model=self.settings.openrouter_default_model,
            safety_retry_model=self.settings.openrouter_fallback_model,
            fallback_model=self.settings.openrouter_fallback_model,
        )

    async def _validate_key_and_catalog(self, api_key: str) -> list[OpenRouterModel]:
        provider = self.provider_factory(api_key)
        try:
            metadata = await provider.get_current_key()
            if metadata.is_management_key or metadata.is_provisioning_key:
                raise bad_request("Нужен обычный inference-ключ OpenRouter.")
            return await provider.list_user_models()
        except OpenRouterProviderError as exc:
            self._raise_safe_provider_error(exc)

    @staticmethod
    def _raise_safe_provider_error(exc: OpenRouterProviderError) -> NoReturn:
        if exc.error_code == "openrouter_auth_error":
            raise bad_request("Ключ OpenRouter недействителен.") from exc
        if exc.error_code == "openrouter_rate_limited":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenRouter временно ограничил запросы. Повторите позже.",
            ) from exc
        if exc.error_code in {"openrouter_unavailable", "openrouter_timeout", "openrouter_network_error"}:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenRouter временно недоступен. Действующая конфигурация не изменена.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenRouter вернул некорректный ответ. Действующая конфигурация не изменена.",
        ) from exc

    def _catalog_response(self, models: list[OpenRouterModel]) -> OpenRouterCatalogResponse:
        return OpenRouterCatalogResponse(
            validated_at=self.now(),
            items=[
                OpenRouterCatalogModelResponse(
                    id=model.id,
                    name=model.name,
                    input_modalities=list(model.input_modalities),
                    output_modalities=list(model.output_modalities),
                    context_length=model.context_length,
                    prompt_price=model.prompt_price,
                    completion_price=model.completion_price,
                    expiration_date=model.expiration_date,
                )
                for model in models
            ],
        )

    def _safe_configuration(self, row: LLMProviderSetting | None) -> OpenRouterConfigurationResponse:
        source = self._source(row)
        state: Literal["active", "disabled", "unconfigured"]
        if row is not None and not row.enabled:
            state = "disabled"
        elif source == "none":
            state = "unconfigured"
        else:
            state = "active"
        return OpenRouterConfigurationResponse(
            state=state,
            source=source,
            enabled=row.enabled if row is not None else state == "active",
            credential_fingerprint_masked=self._masked_fingerprint(row),
            validated_at=row.validated_at if row is not None else None,
            updated_at=getattr(row, "updated_at", None) if row is not None else None,
            routes=LLMModelRoutesRequest(**self._effective_routes(row).__dict__),
        )

    def _source(
        self, row: LLMProviderSetting | None
    ) -> Literal["database", "environment", "none"]:
        if row is not None and row.api_key_encrypted:
            return "database"
        if self._environment_key() is not None:
            return "environment"
        return "none"

    def _masked_fingerprint(self, row: LLMProviderSetting | None) -> str | None:
        if row is not None and row.credential_fingerprint:
            return self.credentials.mask_fingerprint(row.credential_fingerprint)
        environment_key = self._environment_key()
        if environment_key is None:
            return None
        return self.credentials.mask_fingerprint(self.credentials.fingerprint(environment_key))

    @staticmethod
    def _assign_routes(row: LLMProviderSetting, routes: LLMModelRoutesRequest) -> None:
        row.review_model = routes.review_model
        row.negative_review_model = routes.negative_review_model
        row.question_model = routes.question_model
        row.chat_model = routes.chat_model
        row.safety_retry_model = routes.safety_retry_model
        row.fallback_model = routes.fallback_model

    def _default_provider(self, api_key: str) -> OpenRouterProvider:
        return OpenRouterProvider(
            api_key=api_key,
            base_url=self.settings.openrouter_base_url,
            site_url=self.settings.public_site_url,
            app_title=self.settings.app_name,
            timeout_seconds=self.settings.openrouter_timeout_seconds,
        )
