from __future__ import annotations

from functools import lru_cache
from typing import Literal, Self
from urllib.parse import urlparse
from uuid import UUID

from cryptography.fernet import Fernet
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRET_MARKERS = {
    "",
    "change-me",
    "replace-me",
    "replace-with-local-dev-secret-at-least-32-bytes",
    "replace-with-fernet-compatible-key",
    "replace-only-in-real-env",
    "set-in-dokploy-environment",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["local", "staging", "production"] = "local"
    app_name: str = "MPReply"
    app_version: str = "0.1.27"

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
    auth_email_verification_ttl_hours: int = Field(default=24, ge=1, le=168)
    auth_password_reset_ttl_minutes: int = Field(default=30, ge=5, le=120)
    auth_action_token_cooldown_seconds: int = Field(default=60, ge=15, le=3600)

    resend_api_key: SecretStr = Field(default=SecretStr(""))
    resend_api_url: str = "https://api.resend.com/emails"
    resend_timeout_seconds: float = Field(default=10.0, gt=0.0, le=30.0)
    transactional_email_from: str = "MPReply <no-reply@mpreply.ru>"
    support_email: str = "support@mpreply.ru"

    lava_enabled: bool = False
    lava_api_key: SecretStr = Field(default=SecretStr(""))
    lava_webhook_secret: SecretStr = Field(default=SecretStr(""))
    lava_offer_id: UUID | None = None
    lava_product_id: UUID | None = None

    @field_validator("lava_offer_id", "lava_product_id", mode="before")
    @classmethod
    def empty_provider_identifier(cls, value: object) -> object:
        return None if value == "" else value

    yandex_oauth_enabled: bool = False
    yandex_oauth_client_id: str = Field(default="", max_length=128)
    yandex_oauth_client_secret: SecretStr = Field(default=SecretStr(""))

    @model_validator(mode="after")
    def validate_yandex_oauth_contract(self) -> Self:
        if self.yandex_oauth_enabled:
            if not self.yandex_oauth_client_id.strip() or not self.yandex_oauth_client_secret.get_secret_value().strip():
                raise ValueError("Enabled Yandex ID requires client ID and client secret")
            try:
                Fernet(self.credentials_encryption_key.get_secret_value().encode())
            except (ValueError, TypeError):
                raise ValueError("Enabled Yandex ID requires a valid credentials encryption key") from None
            self._require_https_origin("API_BASE_URL", self.api_base_url)
            self._require_https_origin("WEB_APP_URL", self.web_app_url)
        return self

    @model_validator(mode="after")
    def validate_lava_contract(self) -> Self:
        if self.lava_enabled:
            api_key = self.lava_api_key.get_secret_value()
            webhook_key = self.lava_webhook_secret.get_secret_value()
            if not api_key.strip() or self.lava_offer_id is None or self.lava_product_id is None:
                raise ValueError("Enabled Lava requires API key, offer and product IDs")
            if not 32 <= len(webhook_key) <= 80 or not webhook_key.isascii() or any(char.isspace() for char in webhook_key):
                raise ValueError("Lava webhook secret must contain 32 to 80 ASCII characters without whitespace")
            if api_key == webhook_key:
                raise ValueError("Lava webhook secret must differ from the provider API key")
        return self

    credentials_encryption_key: SecretStr = Field(default=SecretStr("replace-with-fernet-compatible-key"))
    groq_api_key: SecretStr = Field(default=SecretStr("replace-only-in-real-env"))
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_default_model: str = "qwen/qwen3.8-27b"
    groq_timeout_seconds: float = 45.0

    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    log_level: str = "INFO"

    rate_limit_enabled: bool = False
    ai_daily_cost_limit_default: float = 5.00
    auto_reply_daily_limit_default: int = 100
    auto_reply_max_attempts: int = 4
    auto_reply_execution_lease_seconds: int = 120
    marketplace_scheduler_interval_seconds: int = Field(default=30, ge=5, le=300)
    marketplace_scheduler_batch_size: int = Field(default=25, ge=1, le=100)

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
        if self.app_env != "production":
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
        self._require_secure_production_secret("GROQ_API_KEY", self.groq_api_key, min_length=16)
        self._require_secure_production_secret("RESEND_API_KEY", self.resend_api_key, min_length=8)
        self._require_valid_fernet_key()

        if not self.auth_cookie_secure:
            raise ValueError("Production requires AUTH_COOKIE_SECURE=true")
        if self.auth_cookie_samesite == "none":
            raise ValueError("Production must not use AUTH_COOKIE_SAMESITE=none by default")
        if not self.rate_limit_enabled:
            raise ValueError("Production requires RATE_LIMIT_ENABLED=true")

        for label, url in (
            ("WEB_APP_URL", self.web_app_url),
            ("PUBLIC_SITE_URL", self.public_site_url),
            ("API_BASE_URL", self.api_base_url),
        ):
            self._require_https_origin(label, url)

        self._require_fixed_external_endpoint(
            "GROQ_BASE_URL",
            self.groq_base_url,
            expected_host="api.groq.com",
            expected_path="/openai/v1",
        )
        self._require_fixed_external_endpoint(
            "RESEND_API_URL",
            self.resend_api_url,
            expected_host="api.resend.com",
            expected_path="/emails",
        )

        if not self.allowed_hosts or any("*" in host for host in self.allowed_hosts):
            raise ValueError("Production requires explicit ALLOWED_HOSTS without wildcard")
        forbidden_hosts = {"localhost", "127.0.0.1", "::1", "testserver"}
        if any(host.strip().lower() in forbidden_hosts for host in self.allowed_hosts):
            raise ValueError("Production ALLOWED_HOSTS must not include local or test hosts")
        if any(not host or host != host.strip() or "/" in host or ":" in host or "@" in host for host in self.allowed_hosts):
            raise ValueError("Production ALLOWED_HOSTS must contain hostnames only")
        if not self.cors_origins:
            raise ValueError("Production requires at least one CORS origin")
        for origin in self.cors_origins:
            self._require_https_origin("CORS origin", origin)
        api_host = urlparse(self.api_base_url).hostname
        if api_host not in self.allowed_hosts:
            raise ValueError("Production ALLOWED_HOSTS must include the API hostname")

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

    @staticmethod
    def _require_fixed_external_endpoint(
        label: str,
        value: str,
        *,
        expected_host: str,
        expected_path: str,
    ) -> None:
        parsed = urlparse(value)
        if (
            parsed.scheme != "https"
            or parsed.hostname != expected_host
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path.rstrip("/") != expected_path
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"Production requires the official fixed endpoint for {label}")

    @staticmethod
    def _require_https_origin(label: str, value: str) -> None:
        parsed = urlparse(value)
        if (
            value != value.strip()
            or parsed.scheme != "https"
            or not parsed.hostname
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.params
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"Production requires an HTTPS origin for {label}")


@lru_cache
def get_settings() -> Settings:
    return Settings()
