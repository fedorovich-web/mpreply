from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.ai_instruction_set import (
    AIInstructionSetAssignmentRequest,
    AIInstructionSetAssignmentResponse,
    AIInstructionSetCreateRequest,
    AIInstructionSetResponse,
    AIInstructionSetUpdateRequest,
)
from app.services.ai_instruction_set_service import AIInstructionSetService

router = APIRouter(tags=["ai-instruction-sets"])


@router.get("/api/organizations/{organization_id}/instruction-sets", response_model=list[AIInstructionSetResponse])
async def list_instruction_sets(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[AIInstructionSetResponse]:
    service = AIInstructionSetService(session)
    rows = await service.list_for_actor(organization_id=organization_id, actor=current_user)
    return [service.to_response(row) for row in rows]


@router.post(
    "/api/organizations/{organization_id}/instruction-sets",
    response_model=AIInstructionSetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_instruction_set(
    organization_id: UUID,
    payload: AIInstructionSetCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIInstructionSetResponse:
    service = AIInstructionSetService(session)
    row = await service.create(organization_id=organization_id, actor=current_user, payload=payload)
    await session.commit()
    return service.to_response(row)


@router.patch(
    "/api/organizations/{organization_id}/instruction-sets/{instruction_set_id}",
    response_model=AIInstructionSetResponse,
)
async def update_instruction_set(
    organization_id: UUID,
    instruction_set_id: UUID,
    payload: AIInstructionSetUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIInstructionSetResponse:
    service = AIInstructionSetService(session)
    row = await service.update(
        organization_id=organization_id,
        instruction_set_id=instruction_set_id,
        actor=current_user,
        payload=payload,
    )
    await session.commit()
    return service.to_response(row)


@router.post(
    "/api/organizations/{organization_id}/instruction-sets/{instruction_set_id}/make-default",
    response_model=AIInstructionSetResponse,
)
async def make_default_instruction_set(
    organization_id: UUID,
    instruction_set_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIInstructionSetResponse:
    service = AIInstructionSetService(session)
    row = await service.make_default(
        organization_id=organization_id,
        instruction_set_id=instruction_set_id,
        actor=current_user,
    )
    await session.commit()
    return service.to_response(row)


@router.patch(
    "/api/marketplace-accounts/{account_id}/instruction-set",
    response_model=AIInstructionSetAssignmentResponse,
)
async def assign_instruction_set(
    account_id: UUID,
    payload: AIInstructionSetAssignmentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AIInstructionSetAssignmentResponse:
    account = await AIInstructionSetService(session).assign_to_account(
        account_id=account_id,
        instruction_set_id=payload.instruction_set_id,
        actor=current_user,
    )
    await session.commit()
    return AIInstructionSetAssignmentResponse(
        marketplace_account_id=account.id,
        instruction_set_id=account.ai_instruction_set_id,
    )
