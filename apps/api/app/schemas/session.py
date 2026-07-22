from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuthSessionInfo(BaseModel):
    id: UUID
    status: str
    expires_at: datetime
    last_used_at: datetime | None
    ip_address: str | None
    user_agent: str | None
    current: bool
    created_at: datetime
