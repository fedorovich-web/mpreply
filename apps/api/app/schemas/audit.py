from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    actor_user_id: UUID | None
    action: str
    entity_type: str
    entity_id: str | None
    ip_address: str | None
    user_agent: str | None
    metadata: dict[str, object]
    created_at: datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    next_cursor: str | None = None
    has_more: bool = False
    limit: int = Field(ge=1, le=100)
