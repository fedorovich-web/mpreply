from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.marketplace_account import MarketplaceAccountResponse

MarketplaceHealthStatus = Literal["healthy", "attention", "error", "disabled"]


class MarketplaceSyncStateSummary(BaseModel):
    id: UUID
    marketplace_account_id: UUID
    stream: str
    status: str
    next_run_at: datetime | None = None
    last_attempt_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_cycle_completed_at: datetime | None = None
    consecutive_failures: int


class MarketplaceSyncJobSummary(BaseModel):
    id: UUID
    job_type: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message_safe: str | None = None
    stats: dict[str, int]
    created_at: datetime


class MarketplaceIntegrationEventSummary(BaseModel):
    id: UUID
    event_type: str
    status: str
    error_code: str | None = None
    error_message_safe: str | None = None
    details: dict[str, object]
    created_at: datetime


class MarketplaceAccountOverviewResponse(BaseModel):
    account: MarketplaceAccountResponse
    health_status: MarketplaceHealthStatus
    health_reasons: list[str]
    scopes: list[str]
    sync_states: list[MarketplaceSyncStateSummary]
    recent_jobs: list[MarketplaceSyncJobSummary]
    recent_events: list[MarketplaceIntegrationEventSummary]
