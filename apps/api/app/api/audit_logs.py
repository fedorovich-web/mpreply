from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    organization_id: UUID,
    action: str | None = Query(default=None, min_length=1, max_length=255),
    entity_type: str | None = Query(default=None, min_length=1, max_length=128),
    actor_user_id: UUID | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    cursor: str | None = Query(default=None, max_length=512),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AuditLogListResponse:
    page = await AuditService(session).list_for_organization(
        actor=current_user,
        organization_id=organization_id,
        action=action,
        entity_type=entity_type,
        actor_user_id=actor_user_id,
        created_from=created_from,
        created_to=created_to,
        cursor=cursor,
        limit=limit,
    )
    return AuditLogListResponse(
        items=[to_audit_log_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
        limit=limit,
    )


def to_audit_log_response(item: AuditLog) -> AuditLogResponse:
    if item.organization_id is None:
        raise ValueError("Tenant audit log must have organization_id")
    return AuditLogResponse(
        id=item.id,
        organization_id=item.organization_id,
        actor_user_id=item.actor_user_id,
        action=item.action,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        ip_address=item.ip_address,
        user_agent=item.user_agent,
        metadata=item.metadata_json or {},
        created_at=item.created_at,
    )
