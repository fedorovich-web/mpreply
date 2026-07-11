from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.message import (
    CustomerMessageListResponse,
    CustomerMessageResponse,
    CustomerMessageUpdateRequest,
)
from app.services.message_service import MessageService

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=CustomerMessageListResponse)
async def list_messages(
    organization_id: UUID,
    marketplace: str | None = None,
    type: str | None = Query(default=None, alias="type"),
    status: str | None = None,
    rating_min: int | None = None,
    rating_max: int | None = None,
    product_id: UUID | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerMessageListResponse:
    service = MessageService(session)
    rows, total = await service.list_messages(
        actor=current_user,
        organization_id=organization_id,
        marketplace=marketplace,
        message_type=type,
        status=status,
        rating_min=rating_min,
        rating_max=rating_max,
        product_id=product_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return CustomerMessageListResponse(
        items=[service.to_response(message, product) for message, product in rows],
        total=total,
        page=max(page, 1),
        page_size=min(max(page_size, 1), 100),
    )


@router.get("/{message_id}", response_model=CustomerMessageResponse)
async def get_message(
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerMessageResponse:
    service = MessageService(session)
    message, product = await service.get_message(actor=current_user, message_id=message_id)
    return service.to_response(message, product)


@router.patch("/{message_id}", response_model=CustomerMessageResponse)
async def update_message(
    message_id: UUID,
    payload: CustomerMessageUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerMessageResponse:
    service = MessageService(session)
    message = await service.update_message(
        actor=current_user,
        message_id=message_id,
        status=payload.status,
        assigned_to=payload.assigned_to,
        priority=payload.priority,
    )
    await session.commit()
    return service.to_response(message)
