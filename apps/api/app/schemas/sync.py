from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class MarketplaceSyncResponse(BaseModel):
    account_id: UUID
    marketplace: str
    status: str
    imported_reviews: int
    imported_questions: int
    updated_reviews: int
    updated_questions: int
    skipped: int
    error_code: str | None = None
    error_message_safe: str | None = None
