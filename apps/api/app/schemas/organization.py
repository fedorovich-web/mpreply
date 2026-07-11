from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=255)


class OrganizationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    default_response_mode: str | None = Field(default=None, pattern="^(auto|semi_auto)$")
    status: str | None = Field(default=None, pattern="^(active|suspended|archived)$")


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    owner_user_id: UUID | None
    plan_id: UUID | None
    default_response_mode: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationUserResponse(BaseModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
