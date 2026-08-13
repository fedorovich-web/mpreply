from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class DashboardAttentionItem(BaseModel):
    key: Literal["failed", "manual_review", "needs_reply"]
    title: str
    count: int = Field(ge=0)
    href: str
    severity: Literal["danger", "warning", "info"]


class DashboardAttentionResponse(BaseModel):
    organization_id: UUID
    items: list[DashboardAttentionItem]
    integration_issues: int = Field(ge=0)
