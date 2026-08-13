from __future__ import annotations

from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

KnowledgeCategory = Literal["company", "delivery", "returns", "warranty", "product", "other"]
KnowledgeStatus = Literal["draft", "active", "archived"]


class _KnowledgeEntryScope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    marketplace_account_id: UUID | None = None
    product_id: UUID | None = None


class KnowledgeEntryCreateRequest(_KnowledgeEntryScope):
    category: KnowledgeCategory
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=12000)
    status: KnowledgeStatus = "active"

    @field_validator("title", "content", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class KnowledgeEntryUpdateRequest(_KnowledgeEntryScope):
    category: KnowledgeCategory | None = None
    title: str | None = Field(default=None, min_length=1, max_length=160)
    content: str | None = Field(default=None, min_length=1, max_length=12000)
    status: KnowledgeStatus | None = None

    @field_validator("title", "content", mode="before")
    @classmethod
    def normalize_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def reject_required_nulls(self) -> Self:
        for field_name in ("category", "title", "content", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class KnowledgeEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    marketplace_account_id: UUID | None
    product_id: UUID | None
    category: KnowledgeCategory
    title: str
    content: str
    status: KnowledgeStatus
    created_by: UUID | None
    updated_by: UUID | None
    created_at: datetime
    updated_at: datetime
