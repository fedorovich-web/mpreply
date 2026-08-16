from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

AIDraftTone = Literal["neutral", "friendly", "formal", "apologetic"]


class AIDraftGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    tone: AIDraftTone | None = None
    temperature: float = Field(default=0.3, ge=0.0, le=1.2)
    max_tokens: int = Field(default=600, ge=120, le=1500)
    brand_rules: str | None = Field(default=None, max_length=2000)
    knowledge_base: str | None = Field(default=None, max_length=4000)


class AIDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    message_id: UUID
    provider: str
    model: str
    prompt_version: str
    draft_text: str
    tokens_input: int | None = None
    tokens_output: int | None = None
    latency_ms: int | None = None
    cost_estimate: float | None = None
    confidence_score: float | None = None
    safety_flags_json: list[str]
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AIDraftListResponse(BaseModel):
    items: list[AIDraftResponse]
    total: int


class AIDraftErrorResponse(BaseModel):
    ok: bool = False
    error_code: str
    message: str
