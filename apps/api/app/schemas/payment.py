from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PaymentOrderCreateRequest(BaseModel):
    organization_id: UUID
    package_code: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")


class PaymentOrderResponse(BaseModel):
    id: UUID
    organization_id: UUID
    package_id: UUID
    grant_id: UUID | None
    provider: str
    provider_payment_id: str | None
    status: str
    package_code: str
    answer_quantity: int = Field(ge=1)
    amount_minor: int = Field(ge=1)
    currency: str
    confirmation_url: str | None
    provider_status: str | None
    paid_at: datetime | None
    canceled_at: datetime | None
    refunded_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentWebhookResponse(BaseModel):
    accepted: bool = True
    status: str


class PaymentRefundResponse(BaseModel):
    id: UUID
    order_id: UUID
    grant_id: UUID | None
    provider: str
    provider_refund_id: str
    status: str
    amount_minor: int = Field(ge=1)
    currency: str
    answer_quantity_revoked: int | None = Field(default=None, ge=1)
    processed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
