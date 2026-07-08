from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductSummary(BaseModel):
    id: UUID
    external_id: str
    sku: str | None = None
    name: str
    brand: str | None = None
    category: str | None = None
    image_url: str | None = None
    product_url: str | None = None


class CustomerMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    customer_photos_json: list
    marketplace_created_at: datetime
    imported_at: datetime
    last_synced_at: datetime
    assigned_to: UUID | None = None
    priority: str
    metadata_json: dict
    product: ProductSummary | None = None
    created_at: datetime
    updated_at: datetime


class CustomerMessageListResponse(BaseModel):
    items: list[CustomerMessageResponse]
    total: int
    page: int
    page_size: int


class CustomerMessageUpdateRequest(BaseModel):
    status: str | None = Field(default=None, max_length=64)
    assigned_to: UUID | None = None
    priority: str | None = Field(default=None, max_length=32)
