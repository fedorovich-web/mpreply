from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.json_schema import SkipJsonSchema


class ProductSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    external_id: str
    sku: str | None = None
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    image_url: str | None = None
    product_url: str | None = None


class CustomerMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    marketplace_account_id: UUID
    product_id: UUID | None = None
    marketplace: str
    external_id: str
    type: str
    status: str
    rating: int | None = None
    customer_display_name: str | None = None
    customer_text: str
    customer_photos_json: list[object]
    marketplace_created_at: datetime
    imported_at: datetime
    last_synced_at: datetime
    assigned_to: UUID | None = None
    priority: str
    metadata_json: dict[str, object]
    product: ProductSummary | None = None
    created_at: datetime
    updated_at: datetime


class CustomerMessageListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CustomerMessageResponse]
    total: int
    page: int
    page_size: int


class CustomerMessageUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["archived", "escalated"] | SkipJsonSchema[None] = None
    assigned_to: UUID | None = None
    priority: Literal["low", "normal", "high", "urgent"] | SkipJsonSchema[None] = None

    @field_validator("status", "priority", mode="before")
    @classmethod
    def reject_null_for_required_values(cls, value: object) -> object:
        if value is None:
            raise ValueError("This field cannot be null")
        return value
