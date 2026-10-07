from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Marketplace, ResponseMode


class MarketplaceAccountCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: UUID
    marketplace: Marketplace
    display_name: str = Field(min_length=2, max_length=255)
    credentials: str = Field(min_length=8, max_length=16384)
    seller_id: str | None = Field(default=None, max_length=255)
    default_response_mode: ResponseMode = ResponseMode.INHERIT

    @field_validator("display_name", mode="before")
    @classmethod
    def normalize_display_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("seller_id", mode="before")
    @classmethod
    def normalize_seller_id(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return value.strip()

    @field_validator("credentials")
    @classmethod
    def validate_credentials(cls, value: str) -> str:
        return _validated_credential(value)


class MarketplaceAccountUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    seller_id: str | None = Field(default=None, max_length=255)
    default_response_mode: ResponseMode | None = None
    status: Literal["active", "disabled", "pending_validation"] | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def normalize_display_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("seller_id", mode="before")
    @classmethod
    def normalize_seller_id(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return value.strip()


class MarketplaceAccountRotateCredentialsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credentials: str = Field(min_length=8, max_length=16384)

    @field_validator("credentials")
    @classmethod
    def validate_credentials(cls, value: str) -> str:
        return _validated_credential(value)


class MarketplaceAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    marketplace: str
    display_name: str
    seller_id: str | None
    status: str
    credentials_masked: str
    credentials_status: str
    scopes_json: dict[str, object]
    default_response_mode: str
    last_success_sync_at: datetime | None = None
    last_error_sync_at: datetime | None = None
    sync_error_code: str | None = None
    sync_next_retry_at: datetime | None = None
    error_count: int = 0
    created_at: datetime
    updated_at: datetime


class MarketplaceAccountValidateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    status: str
    credentials_status: str
    scopes: list[str]
    checked_at: datetime
    error_code: str | None = None
    error_message_safe: str | None = None


class MarketplaceAccountActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    status: str
    credentials_status: str
    credentials_masked: str
    message: str


def _validated_credential(value: str) -> str:
    if value != value.strip() or "\x00" in value:
        raise ValueError("credentials must not contain surrounding whitespace or null bytes")
    return value
