from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MarketplaceSyncStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    marketplace_account_id: UUID
    stream: str
    status: str
    cursor: str | None = None
    next_run_at: datetime | None = None
    last_attempt_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_cycle_completed_at: datetime | None = None
    consecutive_failures: int
    lease_expires_at: datetime | None = None
    last_worker_message_id: str | None = None


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
