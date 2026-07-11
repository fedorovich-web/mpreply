from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.analytics import (
    AIUsageAnalyticsResponse,
    AnalyticsOverviewResponse,
    MarketplaceAnalyticsResponse,
    MessageAnalyticsResponse,
    ProductAnalyticsResponse,
    TeamAnalyticsResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AnalyticsOverviewResponse:
    return await AnalyticsService(session).overview(actor=current_user, organization_id=organization_id, days=days)


@router.get("/messages", response_model=MessageAnalyticsResponse)
async def get_message_analytics(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageAnalyticsResponse:
    return await AnalyticsService(session).messages(actor=current_user, organization_id=organization_id, days=days)


@router.get("/marketplaces", response_model=MarketplaceAnalyticsResponse)
async def get_marketplace_analytics(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MarketplaceAnalyticsResponse:
    return await AnalyticsService(session).marketplaces(actor=current_user, organization_id=organization_id, days=days)


@router.get("/products", response_model=ProductAnalyticsResponse)
async def get_product_analytics(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProductAnalyticsResponse:
    return await AnalyticsService(session).products(actor=current_user, organization_id=organization_id, days=days)


@router.get("/team", response_model=TeamAnalyticsResponse)
async def get_team_analytics(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TeamAnalyticsResponse:
    return await AnalyticsService(session).team(actor=current_user, organization_id=organization_id, days=days)


@router.get("/ai-usage", response_model=AIUsageAnalyticsResponse)
async def get_ai_usage_analytics(
    organization_id: UUID,
    days: int = Query(default=30, ge=1, le=366),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIUsageAnalyticsResponse:
    return await AnalyticsService(session).ai_usage(actor=current_user, organization_id=organization_id, days=days)
