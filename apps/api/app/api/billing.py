from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.billing import BillingOverviewResponse
from app.services.billing_service import BillingService

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/overview", response_model=BillingOverviewResponse)
async def get_billing_overview(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> BillingOverviewResponse:
    return await BillingService(session).overview(actor=current_user, organization_id=organization_id)
