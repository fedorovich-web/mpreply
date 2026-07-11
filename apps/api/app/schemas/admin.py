from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AdminOverviewResponse(BaseModel):
    generated_at: datetime
    organizations_total: int = Field(ge=0)
    organizations_active: int = Field(ge=0)
    users_total: int = Field(ge=0)
    subscriptions_active: int = Field(ge=0)
    usage_events_30d: int = Field(ge=0)
    ai_cost_estimate_30d: float = Field(ge=0)
    integration_failures_24h: int = Field(ge=0)
    replies_failed_24h: int = Field(ge=0)
