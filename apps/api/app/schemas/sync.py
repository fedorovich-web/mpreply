from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MarketplaceSyncResponse(BaseModel):
    account_id: UUID
    marketplace: str
    status: Literal["success", "failed", "in_progress", "partial"]
    imported_reviews: int
    imported_questions: int
    imported_chats: int
    updated_reviews: int
    updated_questions: int
    updated_chats: int
    skipped: int
    error_code: str | None = None
    error_message_safe: str | None = None
