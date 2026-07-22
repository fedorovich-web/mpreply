from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


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


class AnswerPackageResponse(BaseModel):
    id: UUID
    code: str
    name: str
    kind: str
    answer_count: int | None = Field(default=None, ge=1)
    price_minor: int | None = Field(default=None, ge=0)
    currency: str
    validity_days: int | None = Field(default=None, ge=1)
    marketplace_limit: int | None = Field(default=None, ge=1)
    display_order: int
    is_active: bool
    metadata_json: dict[str, object]

    model_config = {"from_attributes": True}


class AnswerBalanceResponse(BaseModel):
    organization_id: UUID
    available: int = Field(ge=0)
    reserved: int = Field(ge=0)
    total: int = Field(ge=0)
    trial_available: int = Field(ge=0)
    paid_available: int = Field(ge=0)
    trial_expires_at: datetime | None
    marketplace_limit: int | None = Field(default=None, ge=0)


class BillingOverviewResponse(BaseModel):
    organization_id: UUID
    plan: BillingPlanResponse
    subscription: SubscriptionResponse | None
    usage_period_start: datetime
    usage_period_end: datetime
    usage: list[UsageLimitItem]
    answer_balance: AnswerBalanceResponse
    pricing_finalized: bool
