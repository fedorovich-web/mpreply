from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Self, cast
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationInfo, field_validator, model_validator
from pydantic.json_schema import SkipJsonSchema

AutomationMode = Literal["auto", "semi_auto"]
AutomationAppliesTo = Literal["all", "review", "question", "chat"]
MarketplaceName = Literal["wildberries", "ozon", "yandex_market", "avito"]
AutomationRuleName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=255)]
_LIST_ITEM_MAX_LENGTHS = {
    "product_ids": 36,
    "category_ids": 255,
    "include_keywords": 200,
    "exclude_keywords": 200,
    "sensitive_topics": 200,
}


class AutomationRuleCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    organization_id: UUID
    marketplace_account_id: UUID | None = None
    name: AutomationRuleName
    priority: int = Field(default=100, ge=0, le=10000)
    is_enabled: bool = True
    mode: AutomationMode = "auto"
    applies_to: AutomationAppliesTo = "all"
    marketplace: MarketplaceName | None = None
    min_rating: int | None = Field(default=None, ge=1, le=5)
    max_rating: int | None = Field(default=None, ge=1, le=5)
    product_ids: list[str] = Field(default_factory=list, max_length=500)
    category_ids: list[str] = Field(default_factory=list, max_length=500)
    include_keywords: list[str] = Field(default_factory=list, max_length=100)
    exclude_keywords: list[str] = Field(default_factory=list, max_length=100)
    sensitive_topics: list[str] = Field(default_factory=list, max_length=100)
    daily_limit: int | None = Field(default=None, ge=1, le=100000)
    hourly_limit: int | None = Field(default=None, ge=1, le=10000)
    require_manual_review_on_flags: bool = True
    stop_on_missing_product_context: bool = True
    stop_on_low_confidence: bool = True
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

    @field_validator(
        "product_ids",
        "category_ids",
        "include_keywords",
        "exclude_keywords",
        "sensitive_topics",
        mode="before",
    )
    @classmethod
    def normalize_string_lists(cls, value: object, info: ValidationInfo) -> object:
        return _normalize_string_list(value, field_name=_required_field_name(info))

    @model_validator(mode="after")
    def validate_rating_range(self) -> Self:
        if self.min_rating is not None and self.max_rating is not None and self.min_rating > self.max_rating:
            raise ValueError("min_rating cannot be greater than max_rating")
        return self


class AutomationRuleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: AutomationRuleName | SkipJsonSchema[None] = None
    priority: int | SkipJsonSchema[None] = Field(default=None, ge=0, le=10000)
    is_enabled: bool | SkipJsonSchema[None] = None
    mode: AutomationMode | SkipJsonSchema[None] = None
    applies_to: AutomationAppliesTo | SkipJsonSchema[None] = None
    marketplace_account_id: UUID | None = None
    marketplace: MarketplaceName | None = None
    min_rating: int | None = Field(default=None, ge=1, le=5)
    max_rating: int | None = Field(default=None, ge=1, le=5)
    product_ids: list[str] | SkipJsonSchema[None] = Field(default=None, max_length=500)
    category_ids: list[str] | SkipJsonSchema[None] = Field(default=None, max_length=500)
    include_keywords: list[str] | SkipJsonSchema[None] = Field(default=None, max_length=100)
    exclude_keywords: list[str] | SkipJsonSchema[None] = Field(default=None, max_length=100)
    sensitive_topics: list[str] | SkipJsonSchema[None] = Field(default=None, max_length=100)
    daily_limit: int | None = Field(default=None, ge=1, le=100000)
    hourly_limit: int | None = Field(default=None, ge=1, le=10000)
    require_manual_review_on_flags: bool | SkipJsonSchema[None] = None
    stop_on_missing_product_context: bool | SkipJsonSchema[None] = None
    stop_on_low_confidence: bool | SkipJsonSchema[None] = None
    confidence_threshold: float | SkipJsonSchema[None] = Field(default=None, ge=0.0, le=1.0)

    @field_validator(
        "name",
        "priority",
        "is_enabled",
        "mode",
        "applies_to",
        "product_ids",
        "category_ids",
        "include_keywords",
        "exclude_keywords",
        "sensitive_topics",
        "require_manual_review_on_flags",
        "stop_on_missing_product_context",
        "stop_on_low_confidence",
        "confidence_threshold",
        mode="before",
    )
    @classmethod
    def reject_null_for_required_values(cls, value: object) -> object:
        if value is None:
            raise ValueError("Field cannot be null")
        return value

    @field_validator(
        "product_ids",
        "category_ids",
        "include_keywords",
        "exclude_keywords",
        "sensitive_topics",
        mode="before",
    )
    @classmethod
    def normalize_string_lists(cls, value: object, info: ValidationInfo) -> object:
        return _normalize_string_list(value, field_name=_required_field_name(info))

    @model_validator(mode="after")
    def validate_rating_range(self) -> Self:
        if self.min_rating is not None and self.max_rating is not None and self.min_rating > self.max_rating:
            raise ValueError("min_rating cannot be greater than max_rating")
        return self


class AutomationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    organization_id: UUID
    marketplace_account_id: UUID | None = None
    name: str
    priority: int
    is_enabled: bool
    mode: str
    applies_to: str
    marketplace: str | None = None
    min_rating: int | None = None
    max_rating: int | None = None
    product_ids: list[str]
    category_ids: list[str]
    include_keywords: list[str]
    exclude_keywords: list[str]
    sensitive_topics: list[str]
    daily_limit: int | None = None
    hourly_limit: int | None = None
    require_manual_review_on_flags: bool
    stop_on_missing_product_context: bool
    stop_on_low_confidence: bool
    confidence_threshold: float
    created_by: UUID | None = None
    updated_by: UUID | None = None
    created_at: datetime
    updated_at: datetime


class AutomationRuleListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AutomationRuleResponse]
    total: int


class AutomationRuleEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: UUID
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)


class AutomationRuleEvaluateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: str
    matched_rule_id: UUID | None = None
    matched_rule_name: str | None = None
    reasons: list[str]
    requires_manual_review: bool
    requires_limit_check: bool


class AutomationRuleActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    id: UUID
    is_enabled: bool


def _normalize_string_list(value: object, *, field_name: str) -> object:
    if not isinstance(value, list):
        return value
    items = cast(list[object], value)
    maximum = _LIST_ITEM_MAX_LENGTHS[field_name]
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, str):
            raise ValueError(f"{field_name} entries must be strings")
        cleaned = item.strip()
        if not cleaned or "\x00" in cleaned or len(cleaned) > maximum:
            raise ValueError(f"{field_name} contains an invalid entry")
        if field_name == "product_ids":
            try:
                cleaned = str(UUID(cleaned))
            except ValueError as exc:
                raise ValueError("product_ids entries must be UUIDs") from exc
        key = cleaned.casefold()
        if key not in seen:
            normalized.append(cleaned)
            seen.add(key)
    return normalized


def _required_field_name(info: ValidationInfo) -> str:
    if info.field_name is None:
        raise RuntimeError("automation rule list validator requires a field name")
    return info.field_name
