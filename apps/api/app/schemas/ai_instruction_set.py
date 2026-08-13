from __future__ import annotations

from datetime import datetime
from typing import Literal, Self, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

InstructionTone = Literal["neutral", "friendly", "formal", "apologetic"]
InstructionSetStatus = Literal["active", "archived"]


class _InstructionSetPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand_rules: str | None = Field(default=None, max_length=2000)
    reply_signature: str | None = Field(default=None, max_length=500)
    prohibited_phrases: list[str] | None = Field(default=None, max_length=100)

    @field_validator("brand_rules", "reply_signature", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("prohibited_phrases", mode="before")
    @classmethod
    def normalize_phrases(cls, value: object) -> object:
        if value is None or not isinstance(value, list):
            return value
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_item in cast(list[object], value):
            item = str(raw_item).strip()
            if not item:
                continue
            if len(item) > 200:
                raise ValueError("Each prohibited phrase must be at most 200 characters")
            key = item.casefold()
            if key not in seen:
                normalized.append(item)
                seen.add(key)
        return normalized


class AIInstructionSetCreateRequest(_InstructionSetPolicy):
    name: str = Field(min_length=2, max_length=120)
    response_tone: InstructionTone = "neutral"

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AIInstructionSetUpdateRequest(_InstructionSetPolicy):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    response_tone: InstructionTone | None = None
    status: InstructionSetStatus | None = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        for field_name in ("name", "response_tone", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AIInstructionSetAssignmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instruction_set_id: UUID | None


class AIInstructionSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    name: str
    response_tone: InstructionTone
    brand_rules: str | None
    reply_signature: str | None
    prohibited_phrases: list[str]
    status: InstructionSetStatus
    is_default: bool
    created_by: UUID | None
    updated_by: UUID | None
    created_at: datetime
    updated_at: datetime


class AIInstructionSetAssignmentResponse(BaseModel):
    marketplace_account_id: UUID
    instruction_set_id: UUID | None
