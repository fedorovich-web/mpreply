from __future__ import annotations

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings


def test_groq_remains_the_explicit_default() -> None:
    settings = Settings()
    assert settings.ai_reply_provider == "groq"
    assert settings.openrouter_api_key.get_secret_value() == ""


@pytest.mark.parametrize("key", ["", "replace-only-in-real-env", "SET_IN_DOKPLOY_ENVIRONMENT", "key", "sk-or- whitespace-invalid-key"])
def test_openrouter_activation_rejects_unusable_keys(key: str) -> None:
    with pytest.raises(ValidationError, match="OPENROUTER_API_KEY"):
        Settings(ai_reply_provider="openrouter", openrouter_api_key=SecretStr(key))


def test_openrouter_key_is_masked_and_timeout_is_bounded() -> None:
    key = "sk-or-v1-synthetic-configuration-key"
    settings = Settings(ai_reply_provider="openrouter", openrouter_api_key=SecretStr(key))
    assert settings.ai_reply_provider == "openrouter"
    assert key not in repr(settings)
    assert key not in settings.model_dump_json()
    for timeout in (0, -1, 121, float("inf"), float("nan")):
        with pytest.raises(ValidationError):
            Settings(openrouter_timeout_seconds=timeout)


def test_unknown_provider_is_rejected_instead_of_falling_back() -> None:
    with pytest.raises(ValidationError, match="ai_reply_provider"):
        Settings.model_validate({"ai_reply_provider": "unconfigured"})
