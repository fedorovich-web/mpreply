from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnalyticsPeriod(BaseModel):
    start: datetime
    end: datetime
    days: int = Field(ge=1, le=366)


class AnalyticsOverviewResponse(BaseModel):
    period: AnalyticsPeriod
    total_messages: int = Field(ge=0)
    new_messages: int = Field(ge=0)
    unanswered_messages: int = Field(ge=0)
    answered_messages: int = Field(ge=0)
    negative_reviews: int = Field(ge=0)
    replies_sent: int = Field(ge=0)
    auto_replies_sent: int = Field(ge=0)
    manual_replies_sent: int = Field(ge=0)
    ai_drafts_generated: int = Field(ge=0)
    average_response_seconds: float | None = Field(default=None, ge=0)
    ai_acceptance_rate: float | None = Field(default=None, ge=0, le=1)


class DailyMessagePoint(BaseModel):
    date: date
    imported: int = Field(ge=0)
    answered: int = Field(ge=0)


class MessageAnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    points: list[DailyMessagePoint]


class MarketplaceAnalyticsItem(BaseModel):
    marketplace: str
    messages: int = Field(ge=0)
    answered: int = Field(ge=0)
    failed_integration_events: int = Field(ge=0)


class MarketplaceAnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    items: list[MarketplaceAnalyticsItem]


class ProductAnalyticsItem(BaseModel):
    product_id: UUID
    name: str
    sku: str | None
    messages: int = Field(ge=0)
    negative_reviews: int = Field(ge=0)


class ProductAnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    items: list[ProductAnalyticsItem]


class TeamAnalyticsItem(BaseModel):
    user_id: UUID
    email: str
    name: str | None
    replies_sent: int = Field(ge=0)


class TeamAnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    items: list[TeamAnalyticsItem]


class AIModelUsageItem(BaseModel):
    model: str
    drafts: int = Field(ge=0)
    tokens_input: int = Field(ge=0)
    tokens_output: int = Field(ge=0)
    cost_estimate: float = Field(ge=0)
    average_latency_ms: float | None = Field(default=None, ge=0)


class AIUsageAnalyticsResponse(BaseModel):
    period: AnalyticsPeriod
    drafts_generated: int = Field(ge=0)
    tokens_input: int = Field(ge=0)
    tokens_output: int = Field(ge=0)
    cost_estimate: float = Field(ge=0)
    average_latency_ms: float | None = Field(default=None, ge=0)
    safety_flagged_drafts: int = Field(ge=0)
    models: list[AIModelUsageItem]
