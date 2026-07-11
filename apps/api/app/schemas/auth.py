from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None
    status: str
    is_superadmin: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AuthSessionResponse(BaseModel):
    user: UserResponse
