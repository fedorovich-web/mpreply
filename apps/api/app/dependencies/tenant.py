from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import TenantContext
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.services.organization_service import OrganizationService


async def get_tenant_context(
    organization_id: UUID = Header(alias="X-Organization-Id"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TenantContext:
    service = OrganizationService(session)
    membership = await service.get_membership(
        organization_id=organization_id,
        user_id=current_user.id,
    )
    return TenantContext(
        organization_id=organization_id,
        user_id=current_user.id,
        role=membership.role,
    )


def require_roles(allowed_roles: set[str]) -> Callable[[TenantContext], TenantContext]:
    def dependency(context: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        context.require_role(allowed_roles)
        return context

    return dependency
