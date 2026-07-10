from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AutoReplyEnqueueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    ai_draft_id: UUID | None = None


class AutoReplyEnqueueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queued: bool
    duplicate: bool = False
    reply_id: UUID | None = None
    worker_message_id: str | None = None
    status: str
    reason: str | None = None
    matched_rule_id: UUID | None = None
    quota_reason: str | None = None


class ReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    message_id: UUID
    ai_draft_id: UUID | None = None
    automation_rule_id: UUID | None = None
    status: str
    mode: str
    idempotency_key: str | None = None
    worker_message_id: str | None = None
    attempt_count: int
    max_attempts: int
    last_attempt_at: datetime | None = None
    next_retry_at: datetime | None = None
    error_code: str | None = None
    marketplace_reply_id: str | None = None
    sent_at: datetime | None = None
    failed_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class ReplyRetryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queued: bool
    reply_id: UUID
    worker_message_id: str
    status: str


class ReplyListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ReplyResponse]
    total: int = Field(ge=0)
