from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["local", "staging", "production"] = "local"
    app_name: str = "Respio"
    app_version: str = "0.1.0"

    api_base_url: str = "http://localhost:8000"
    web_app_url: str = "http://localhost:3000"
    public_site_url: str = "http://localhost:3000"

    database_url: SecretStr = Field(default=SecretStr("postgresql+asyncpg://respio:respio_password@localhost:5432/respio"))
    redis_url: SecretStr = Field(default=SecretStr("redis://localhost:6379/0"))

    auth_secret_key: SecretStr = Field(default=SecretStr("replace-with-local-dev-secret"))
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
    log_level: str = "INFO"

    rate_limit_enabled: bool = False
    ai_daily_cost_limit_default: float = 5.00
    auto_reply_daily_limit_default: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
