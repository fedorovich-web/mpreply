from __future__ import annotations

from datetime import datetime
from typing import Literal, Self, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SellerResponseTone = Literal["neutral", "friendly", "formal", "apologetic"]


class SellerSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response_tone: SellerResponseTone | None = None
    brand_rules: str | None = Field(default=None, max_length=2000)
    knowledge_base: str | None = Field(default=None, max_length=4000)
    reply_signature: str | None = Field(default=None, max_length=500)
    prohibited_phrases: list[str] | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def validate_nullable_patch_fields(self) -> Self:
        if "response_tone" in self.model_fields_set and self.response_tone is None:
            raise ValueError("response_tone cannot be null")
        return self

    @field_validator("brand_rules", "knowledge_base", "reply_signature", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("prohibited_phrases", mode="before")
    @classmethod
    def normalize_prohibited_phrases(cls, value: object) -> object:
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


class SellerSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    response_tone: SellerResponseTone
    brand_rules: str | None
    knowledge_base: str | None
    reply_signature: str | None
    prohibited_phrases: list[str]
    created_by: UUID | None
    updated_by: UUID | None
    created_at: datetime
    updated_at: datetime
