from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt


class BillingPlanResponse(BaseModel):
    id: UUID
    code: str
    name: str
    price_month_minor: int | None
    currency: str
    limits_json: dict[str, object]
    features_json: dict[str, object]
    is_active: bool
    is_default: bool

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id: UUID
    organization_id: UUID
    plan_id: UUID
    status: str
    current_period_start: datetime | None
    current_period_end: datetime | None
    trial_ends_at: datetime | None
    cancel_at_period_end: bool
    provider: str | None
    provider_customer_id: str | None
    provider_subscription_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsageLimitItem(BaseModel):
    metric: str
    used: int = Field(ge=0)
    limit: int | None = Field(default=None, ge=0)
    remaining: int | None = Field(default=None, ge=0)
    allowed: bool


class BillingOverviewResponse(BaseModel):
    organization_id: UUID
    plan: BillingPlanResponse
    subscription: SubscriptionResponse | None
    usage_period_start: datetime
    usage_period_end: datetime
    usage: list[UsageLimitItem]
    pricing_finalized: bool
    reply_balance: ReplyBalanceResponse


class ReplyBalanceResponse(BaseModel):
    available: int = Field(ge=0)
    spendable: int = Field(ge=0)
    trial_available: int = Field(ge=0)
    paid_available: int = Field(ge=0)
    reserved: int = Field(ge=0)
    consumed: int = Field(ge=0)
    expired: int = Field(ge=0)
    granted: int = Field(ge=0)
    trial_ends_at: datetime | None
    paid_entitled: bool


class PackPurchase(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quantity: StrictInt = Field(gt=0, le=20000)
    count: StrictInt = Field(gt=0, le=2147483647)


class PurchaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["plan", "addon"]
    plan_code: str | None = Field(default=None, max_length=64)
    months: StrictInt | None = None
    packs: list[PackPurchase] = Field(default_factory=list[PackPurchase], max_length=32)


class CreateOrderRequest(PurchaseRequest):
    organization_id: UUID
    idempotency_key: UUID


class BillingOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    kind: str
    amount_minor: int
    currency: str
    state: str
    payment_url: str | None
    monthly_credits: int
    addon_credits: int
    created_at: datetime
    paid_at: datetime | None
    last_error: str | None


class CatalogPlan(BaseModel):
    code: str
    amount_month_minor: int
    amount_year_minor: int
    monthly_credits: int


class CatalogPack(BaseModel):
    quantity: int
    amount_minor: int


class BillingCatalogResponse(BaseModel):
    enabled: bool
    can_purchase: bool
    currency: str = "RUB"
    plans: list[CatalogPlan]
    packs: list[CatalogPack]
