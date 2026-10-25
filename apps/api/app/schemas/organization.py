from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

OrganizationRole = Literal["owner", "admin", "manager", "viewer"]


class OrganizationCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=255)


class OrganizationUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

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
    current_user_role: OrganizationRole
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
