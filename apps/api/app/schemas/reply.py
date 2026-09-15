from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.message import CustomerMessageResponse


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


class ManualReplyCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    ai_draft_id: UUID | None = None
    reply_text: str | None = Field(default=None, min_length=1, max_length=12000)

    @model_validator(mode="after")
    def require_source(self) -> ManualReplyCreateRequest:
        if self.ai_draft_id is None and not (self.reply_text and self.reply_text.strip()):
            raise ValueError("Either ai_draft_id or reply_text is required")
        return self


class ManualReplyUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply_text: str = Field(min_length=1, max_length=12000)
    expected_revision: int = Field(ge=1)


class ManualReplyRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=1000)


class ReplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    message_id: UUID
    ai_draft_id: UUID | None = None
    automation_rule_id: UUID | None = None
    reply_text: str
    status: str
    mode: str
    revision: int
    idempotency_key: str | None = None
    worker_message_id: str | None = None
    attempt_count: int
    max_attempts: int
    last_attempt_at: datetime | None = None
    next_retry_at: datetime | None = None
    error_code: str | None = None
    created_by: UUID | None = None
    approved_by: UUID | None = None
    sent_by: UUID | None = None
    submitted_for_review_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None
    marketplace_reply_id: str | None = None
    sent_at: datetime | None = None
    failed_reason: str | None = None
    metadata_json: dict[str, object]
    created_at: datetime
    updated_at: datetime


class SafetySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    flags: list[str]
    reasons: list[str]


class ManualReplyWorkflowResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: ReplyResponse
    safety: SafetySummary


class ManualReplySendResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queued: bool
    duplicate: bool = False
    reply_id: UUID
    worker_message_id: str | None = None
    status: str


class ReviewQueueItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: ReplyResponse
    message: CustomerMessageResponse
    safety: SafetySummary


class ReviewQueueListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ReviewQueueItemResponse]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class ReplyRetryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queued: bool
    reply_id: UUID
    worker_message_id: str | None = None
    status: str


class ReplyListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ReplyResponse]
    total: int = Field(ge=0)
