from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

TeamRole = Literal["admin", "manager", "viewer"]
MemberRole = Literal["owner", "admin", "manager", "viewer"]


class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role: TeamRole

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class InvitationAcceptRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)


class InvitationResponse(BaseModel):
    id: UUID
    organization_id: UUID
    email: EmailStr
    role: TeamRole
    status: str
    expires_at: datetime
    invited_by_user_id: UUID
    accepted_by_user_id: UUID | None
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvitationCreatedResponse(InvitationResponse):
    accept_token: str


class TeamMemberResponse(BaseModel):
    membership_id: UUID
    user_id: UUID
    email: EmailStr
    name: str | None
    role: MemberRole
    status: str
    created_at: datetime
    updated_at: datetime


class TeamMemberRoleUpdateRequest(BaseModel):
    role: TeamRole
