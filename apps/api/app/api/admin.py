from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.csrf import require_csrf_header
from app.db.session import get_db_session
from app.dependencies.admin import require_superadmin
from app.models.user import User
from app.schemas.admin import AdminOverviewResponse, AdminUserActionRequest, AdminUserResponse, AdminUsersResponse
from app.services.admin_service import AdminService

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    _current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminOverviewResponse:
    return await AdminService(session).overview()


@router.get("/users", response_model=AdminUsersResponse)
async def list_admin_users(
    response: Response,
    q: str = Query(default="", max_length=320),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=2_147_483_647),
    _current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUsersResponse:
    response.headers["Cache-Control"] = "no-store"
    return await AdminService(session).list_users(q=q.strip(), limit=limit, offset=offset)


@router.post("/users/{user_id}/actions", response_model=AdminUserResponse, dependencies=[Depends(require_csrf_header)])
async def apply_admin_user_action(
    user_id: UUID,
    payload: AdminUserActionRequest,
    response: Response,
    current_user: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_db_session),
) -> AdminUserResponse:
    result = await AdminService(session).apply_user_action(actor_id=current_user.id, user_id=user_id, action=payload.action)
    await session.commit()
    response.headers["Cache-Control"] = "no-store"
    return result
