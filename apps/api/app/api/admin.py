from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.admin import require_superadmin
from app.models.user import User
from app.schemas.admin import AdminOverviewResponse
from app.services.admin_service import AdminService

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    _current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminOverviewResponse:
    return await AdminService(session).overview()
