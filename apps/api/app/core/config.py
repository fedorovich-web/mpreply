from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRET_MARKERS = {
    "",
    "change-me",
    "replace-me",
    "replace-with-local-dev-secret-at-least-32-bytes",
    "replace-with-fernet-compatible-key",
    "replace-only-in-real-env",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["local", "staging", "production"] = "local"
    app_name: str = "Respio"
    app_version: str = "0.1.20"

    api_base_url: str = "http://localhost:8000"
    web_app_url: str = "http://localhost:3000"
    public_site_url: str = "http://localhost:3000"

    database_url: SecretStr = Field(default=SecretStr("postgresql+asyncpg://respio:respio_password@localhost:5432/respio"))
    redis_url: SecretStr = Field(default=SecretStr("redis://localhost:6379/0"))

    auth_secret_key: SecretStr = Field(default=SecretStr("replace-with-local-dev-secret-at-least-32-bytes"))
    auth_access_token_ttl_minutes: int = 15
    auth_refresh_token_ttl_days: int = 30
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    credentials_encryption_key: SecretStr = Field(default=SecretStr("replace-with-fernet-compatible-key"))
    openrouter_api_key: SecretStr = Field(default=SecretStr("replace-only-in-real-env"))
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_default_model: str = "openai/gpt-5.2"
    openrouter_fallback_model: str = "anthropic/claude-sonnet-4.6"
    openrouter_timeout_seconds: float = 45.0

    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    log_level: str = "INFO"

    rate_limit_enabled: bool = False
    ai_daily_cost_limit_default: float = 5.00
    auto_reply_daily_limit_default: int = 100
    auto_reply_max_attempts: int = 4
    auto_reply_execution_lease_seconds: int = 120

    cors_allowed_origins: list[str] = Field(default_factory=list)
    allowed_hosts: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1", "testserver"])
    readiness_timeout_seconds: float = Field(default=3.0, gt=0.0, le=30.0)
    security_headers_enabled: bool = True
    deployment_version: str = "local"

    @property
    def cors_origins(self) -> list[str]:
        origins = [*self.cors_allowed_origins]
        for candidate in (self.web_app_url, self.public_site_url):
            normalized = candidate.rstrip("/")
            if normalized not in origins:
                origins.append(normalized)
        return origins

    @property
    def trusted_hosts(self) -> list[str]:
        hosts = [*self.allowed_hosts]
        for internal_host in ("localhost", "127.0.0.1"):
            if internal_host not in hosts:
                hosts.append(internal_host)
        return hosts

    @model_validator(mode="after")
    def validate_runtime_contract(self) -> Self:
        if self.auth_cookie_samesite == "none" and not self.auth_cookie_secure:
            raise ValueError("AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true")

        if self.app_env != "production":
            return self

        self._require_secure_production_secret("AUTH_SECRET_KEY", self.auth_secret_key, min_length=32)
        self._require_secure_production_secret("OPENROUTER_API_KEY", self.openrouter_api_key, min_length=16)
        self._require_valid_fernet_key()

        if not self.auth_cookie_secure:
            raise ValueError("Production requires AUTH_COOKIE_SECURE=true")
        if self.auth_cookie_samesite == "none":
            raise ValueError("Production must not use AUTH_COOKIE_SAMESITE=none by default")

        for label, url in (
            ("WEB_APP_URL", self.web_app_url),
            ("PUBLIC_SITE_URL", self.public_site_url),
            ("API_BASE_URL", self.api_base_url),
        ):
            if urlparse(url).scheme != "https":
                raise ValueError(f"Production requires HTTPS for {label}")

        if not self.allowed_hosts or "*" in self.allowed_hosts:
            raise ValueError("Production requires explicit ALLOWED_HOSTS without wildcard")
        if "*" in self.cors_origins:
            raise ValueError("Production requires explicit CORS origins without wildcard")
        if not self.cors_origins:
            raise ValueError("Production requires at least one CORS origin")

        return self

    @staticmethod
    def _require_secure_production_secret(label: str, value: SecretStr, *, min_length: int) -> None:
        raw = value.get_secret_value().strip()
        if raw.lower() in _INSECURE_SECRET_MARKERS or len(raw) < min_length:
            raise ValueError(f"Production requires a non-placeholder {label} with at least {min_length} characters")

    def _require_valid_fernet_key(self) -> None:
        raw = self.credentials_encryption_key.get_secret_value().strip()
        if raw.lower() in _INSECURE_SECRET_MARKERS:
            raise ValueError("Production requires a non-placeholder CREDENTIALS_ENCRYPTION_KEY")
        try:
            Fernet(raw.encode("utf-8"))
        except (ValueError, TypeError) as exc:
            raise ValueError("CREDENTIALS_ENCRYPTION_KEY must be a valid Fernet key") from exc


@lru_cache
def get_settings() -> Settings:
    return Settings()
