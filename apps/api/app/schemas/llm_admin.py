from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class LLMModelRoutesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    review_model: str = Field(min_length=1, max_length=255)
    negative_review_model: str = Field(min_length=1, max_length=255)
    question_model: str = Field(min_length=1, max_length=255)
    chat_model: str = Field(min_length=1, max_length=255)
    safety_retry_model: str = Field(min_length=1, max_length=255)
    fallback_model: str = Field(min_length=1, max_length=255)

    @field_validator("*", mode="before")
    @classmethod
    def normalize_model_id(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class OpenRouterKeyValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: SecretStr = Field(min_length=16, max_length=512)


class OpenRouterConfigurationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: SecretStr | None = Field(default=None, min_length=16, max_length=512)
    routes: LLMModelRoutesRequest


class OpenRouterConfigurationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["openrouter"] = "openrouter"
    state: Literal["active", "disabled", "unconfigured"]
    source: Literal["database", "environment", "none"]
    enabled: bool
    credential_fingerprint_masked: str | None = Field(default=None, max_length=32)
    validated_at: datetime | None = None
    updated_at: datetime | None = None
    routes: LLMModelRoutesRequest | None = None


class OpenRouterCatalogModelResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    input_modalities: list[str] = Field(default_factory=list, max_length=16)
    output_modalities: list[str] = Field(default_factory=list, max_length=16)
    context_length: int | None = Field(default=None, ge=1)
    prompt_price: Decimal | None = Field(default=None, ge=0)
    completion_price: Decimal | None = Field(default=None, ge=0)
    expiration_date: datetime | None = None


class OpenRouterCatalogResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: Literal["openrouter"] = "openrouter"
    validated_at: datetime
    items: list[OpenRouterCatalogModelResponse] = Field(max_length=2000)
