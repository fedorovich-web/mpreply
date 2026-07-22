from __future__ import annotations

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


def _production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "production",
        "api_base_url": "https://api.mpreply.ru",
        "web_app_url": "https://app.mpreply.ru",
        "public_site_url": "https://mpreply.ru",
        "auth_secret_key": SecretStr("a" * 64),
        "credentials_encryption_key": SecretStr(Fernet.generate_key().decode("utf-8")),
        "openrouter_api_key": SecretStr("sk-or-v1-production-test-key"),
        "auth_cookie_secure": True,
        "auth_cookie_samesite": "lax",
        "cors_allowed_origins": ["https://app.mpreply.ru", "https://mpreply.ru"],
        "allowed_hosts": ["api.mpreply.ru"],
    }
    values.update(overrides)
    return Settings.model_validate(values)


def test_valid_production_settings_pass() -> None:
    settings = _production_settings()

    assert settings.app_env == "production"
    assert settings.auth_cookie_secure is True


def test_production_rejects_placeholder_secret() -> None:
    with pytest.raises(ValidationError, match="AUTH_SECRET_KEY"):
        _production_settings(auth_secret_key=SecretStr("replace-with-local-dev-secret"))


def test_production_rejects_insecure_cookie() -> None:
    with pytest.raises(ValidationError, match="AUTH_COOKIE_SECURE"):
        _production_settings(auth_cookie_secure=False)


def test_production_rejects_http_origin() -> None:
    with pytest.raises(ValidationError, match="HTTPS"):
        _production_settings(public_site_url="http://mpreply.ru")


def test_production_rejects_invalid_fernet_key() -> None:
    with pytest.raises(ValidationError, match="Fernet"):
        _production_settings(credentials_encryption_key=SecretStr("not-a-fernet-key"))
