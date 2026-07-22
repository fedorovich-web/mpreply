from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.seller_settings import SellerSettings
from app.models.user import User
from app.schemas.seller_settings import SellerResponseTone, SellerSettingsResponse, SellerSettingsUpdateRequest
from app.services.seller_settings_service import SellerSettingsService

router = APIRouter(prefix="/api/organizations", tags=["seller-settings"])


@router.get("/{organization_id}/seller-settings", response_model=SellerSettingsResponse)
async def get_seller_settings(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SellerSettingsResponse:
    settings = await SellerSettingsService(session).get_for_actor(
        organization_id=organization_id,
        actor=current_user,
    )
    await session.commit()
    return to_seller_settings_response(settings)


@router.patch("/{organization_id}/seller-settings", response_model=SellerSettingsResponse)
async def update_seller_settings(
    organization_id: UUID,
    payload: SellerSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> SellerSettingsResponse:
    settings = await SellerSettingsService(session).update(
        organization_id=organization_id,
        actor=current_user,
        payload=payload,
    )
    await session.commit()
    return to_seller_settings_response(settings)


def to_seller_settings_response(settings: SellerSettings) -> SellerSettingsResponse:
    return SellerSettingsResponse(
        id=settings.id,
        organization_id=settings.organization_id,
        response_tone=cast(SellerResponseTone, settings.response_tone),
        brand_rules=settings.brand_rules,
        knowledge_base=settings.knowledge_base,
        reply_signature=settings.reply_signature,
        prohibited_phrases=[str(value) for value in (settings.prohibited_phrases_json or [])],
        created_by=settings.created_by,
        updated_by=settings.updated_by,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )
