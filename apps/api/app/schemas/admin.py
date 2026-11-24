from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    status: str
    is_superadmin: bool
    email_verified_at: datetime | None
    created_at: datetime


class AdminUsersResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int = Field(ge=0)


AdminUserAction = Literal["block", "unblock", "revoke_sessions"]


class AdminUserActionRequest(BaseModel):
    action: AdminUserAction
