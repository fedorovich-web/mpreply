from __future__ import annotations

from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationResponse,
    OrganizationRole,
    OrganizationUpdateRequest,
)
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    service = OrganizationService(session)
    organization = await service.create_organization(
        owner=current_user,
        name=payload.name,
        slug=payload.slug,
    )
    await session.commit()
    return to_organization_response(organization, "owner")


@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[OrganizationResponse]:
    service = OrganizationService(session)
    organizations = await service.list_for_user_with_roles(user_id=current_user.id)
    return [to_organization_response(organization, role) for organization, role in organizations]


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    service = OrganizationService(session)
    organization = await service.get_for_user(organization_id=organization_id, user_id=current_user.id)
    membership = await service.get_membership(organization_id=organization_id, user_id=current_user.id)
    return to_organization_response(organization, membership.role)


@router.patch("/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: UUID,
    payload: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationResponse:
    service = OrganizationService(session)
    organization = await service.update_organization(
        organization_id=organization_id,
        actor=current_user,
        name=payload.name,
        default_response_mode=payload.default_response_mode,
        status=payload.status,
    )
    membership = await service.get_membership(organization_id=organization_id, user_id=current_user.id)
    await session.commit()
    return to_organization_response(organization, membership.role)


def to_organization_response(organization: Organization, role: str) -> OrganizationResponse:
    return OrganizationResponse(
        id=organization.id,
        name=organization.name,
        slug=organization.slug,
        owner_user_id=organization.owner_user_id,
        plan_id=organization.plan_id,
        default_response_mode=organization.default_response_mode,
        status=organization.status,
        current_user_role=cast(OrganizationRole, role),
        created_at=organization.created_at,
        updated_at=organization.updated_at,
    )
