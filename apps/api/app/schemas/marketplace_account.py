from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Marketplace, ResponseMode


class MarketplaceAccountCreateRequest(BaseModel):
    organization_id: UUID
    marketplace: Marketplace
    display_name: str = Field(min_length=2, max_length=255)
    credentials: str = Field(min_length=8, max_length=4096)
    seller_id: str | None = Field(default=None, max_length=255)
    default_response_mode: ResponseMode = ResponseMode.INHERIT


class MarketplaceAccountUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    seller_id: str | None = Field(default=None, max_length=255)
    default_response_mode: ResponseMode | None = None
    status: str | None = Field(default=None, max_length=64)


class MarketplaceAccountRotateCredentialsRequest(BaseModel):
    credentials: str = Field(min_length=8, max_length=4096)


class MarketplaceAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    ai_instruction_set_id: UUID | None = None
    last_success_sync_at: datetime | None = None
    last_error_sync_at: datetime | None = None
    error_count: int = 0
    created_at: datetime
    updated_at: datetime


class MarketplaceAccountValidateResponse(BaseModel):
    id: UUID
    status: str
    credentials_status: str
    scopes: list[str]
    checked_at: datetime
    error_code: str | None = None
    error_message_safe: str | None = None


class MarketplaceAccountActionResponse(BaseModel):
    id: UUID
    status: str
    credentials_status: str
    credentials_masked: str
    message: str
