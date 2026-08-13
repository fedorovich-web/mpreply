from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.knowledge_entry import (
    KnowledgeCategory,
    KnowledgeEntryCreateRequest,
    KnowledgeEntryResponse,
    KnowledgeEntryUpdateRequest,
    KnowledgeStatus,
)
from app.services.knowledge_entry_service import KnowledgeEntryService

router = APIRouter(tags=["knowledge-entries"])


@router.get(
    "/api/organizations/{organization_id}/knowledge-entries",
    response_model=list[KnowledgeEntryResponse],
)
async def list_knowledge_entries(
    organization_id: UUID,
    search: str | None = Query(default=None, min_length=1, max_length=160),
    status_filter: KnowledgeStatus | None = Query(default=None, alias="status"),
    category: KnowledgeCategory | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[KnowledgeEntryResponse]:
    service = KnowledgeEntryService(session)
    rows = await service.list_for_actor(
        organization_id=organization_id,
        actor=current_user,
        search=search,
        status=status_filter,
        category=category,
    )
    return [service.to_response(row) for row in rows]


@router.post(
    "/api/organizations/{organization_id}/knowledge-entries",
    response_model=KnowledgeEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_knowledge_entry(
    organization_id: UUID,
    payload: KnowledgeEntryCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> KnowledgeEntryResponse:
    service = KnowledgeEntryService(session)
    row = await service.create(organization_id=organization_id, actor=current_user, payload=payload)
    await session.commit()
    return service.to_response(row)


@router.patch(
    "/api/organizations/{organization_id}/knowledge-entries/{entry_id}",
    response_model=KnowledgeEntryResponse,
)
async def update_knowledge_entry(
    organization_id: UUID,
    entry_id: UUID,
    payload: KnowledgeEntryUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> KnowledgeEntryResponse:
    service = KnowledgeEntryService(session)
    row = await service.update(
        organization_id=organization_id,
        entry_id=entry_id,
        actor=current_user,
        payload=payload,
    )
    await session.commit()
    return service.to_response(row)
