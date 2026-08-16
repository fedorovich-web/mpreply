from __future__ import annotations

import importlib
import importlib.util

import pytest
from pydantic import ValidationError
from sqlalchemy import CheckConstraint


def _routes() -> dict[str, str]:
    return {
        "review_model": "openai/review-model",
        "negative_review_model": "anthropic/negative-model",
        "question_model": "google/question-model",
        "chat_model": "openai/chat-model",
        "safety_retry_model": "anthropic/safety-model",
        "fallback_model": "google/fallback-model",
    }


def test_llm_provider_setting_enforces_one_provider_and_complete_routes() -> None:
    assert importlib.util.find_spec("app.models.llm_provider_setting") is not None
    model_module = importlib.import_module("app.models.llm_provider_setting")
    table = model_module.LLMProviderSetting.__table__

    assert table.c.provider.unique is True
    assert {column.name for column in table.columns if column.name.endswith("_model")} == set(_routes())
    assert any(
        isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_llm_provider_settings_routes_complete"
        for constraint in table.constraints
    )


def test_admin_llm_schemas_reject_partial_routes_and_unknown_fields() -> None:
    assert importlib.util.find_spec("app.schemas.llm_admin") is not None
    schema_module = importlib.import_module("app.schemas.llm_admin")

    with pytest.raises(ValidationError):
        schema_module.LLMModelRoutesRequest.model_validate({"review_model": "openai/review-model"})
    with pytest.raises(ValidationError):
        schema_module.LLMModelRoutesRequest.model_validate({**_routes(), "secret": "forbidden"})
    with pytest.raises(ValidationError):
        schema_module.LLMModelRoutesRequest.model_validate({**_routes(), "review_model": "   "})


def test_admin_llm_safe_response_cannot_contain_key_material() -> None:
    assert importlib.util.find_spec("app.schemas.llm_admin") is not None
    schema_module = importlib.import_module("app.schemas.llm_admin")
    safe_payload = {
        "provider": "openrouter",
        "state": "active",
        "source": "database",
        "enabled": True,
        "credential_fingerprint_masked": "••••••••A1B2",
        "validated_at": "2026-08-16T09:00:00Z",
        "updated_at": "2026-08-16T09:00:00Z",
        "routes": _routes(),
    }

    parsed = schema_module.OpenRouterConfigurationResponse.model_validate(safe_payload)
    assert parsed.model_dump(mode="json") == safe_payload
    with pytest.raises(ValidationError):
        schema_module.OpenRouterConfigurationResponse.model_validate({**safe_payload, "api_key": "forbidden"})


def test_admin_llm_update_requires_a_complete_route_set_and_bounded_key() -> None:
    assert importlib.util.find_spec("app.schemas.llm_admin") is not None
    schema_module = importlib.import_module("app.schemas.llm_admin")

    parsed = schema_module.OpenRouterConfigurationUpdateRequest.model_validate(
        {"api_key": "sk-or-v1-test-key-value", "routes": _routes()}
    )
    assert parsed.api_key is not None
    assert parsed.api_key.get_secret_value() == "sk-or-v1-test-key-value"
    assert parsed.routes.model_dump() == _routes()
    with pytest.raises(ValidationError):
        schema_module.OpenRouterConfigurationUpdateRequest.model_validate(
            {"api_key": "short", "routes": _routes()}
        )
