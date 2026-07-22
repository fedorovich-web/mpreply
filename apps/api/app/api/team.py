from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.organization import OrganizationUser
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.team import (
    InvitationAcceptRequest,
    InvitationCreatedResponse,
    InvitationCreateRequest,
    InvitationResponse,
    TeamMemberResponse,
    TeamMemberRoleUpdateRequest,
)
from app.services.team_service import TeamMember, TeamService

router = APIRouter(tags=["team"])


@router.post(
    "/api/organizations/{organization_id}/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    organization_id: UUID,
    payload: InvitationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InvitationCreatedResponse:
    created = await TeamService(session).create_invitation(
        organization_id=organization_id,
        actor=current_user,
        email=str(payload.email),
        role=payload.role,
        ttl_hours=get_settings().auth_invitation_ttl_hours,
    )
    await session.commit()
    return InvitationCreatedResponse.model_validate(
        {**InvitationResponse.model_validate(created.invitation).model_dump(), "accept_token": created.accept_token}
    )


@router.get(
    "/api/organizations/{organization_id}/invitations",
    response_model=list[InvitationResponse],
)
async def list_invitations(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[InvitationResponse]:
    invitations = await TeamService(session).list_invitations(organization_id=organization_id, actor=current_user)
    return [InvitationResponse.model_validate(invitation) for invitation in invitations]


@router.delete(
    "/api/organizations/{organization_id}/invitations/{invitation_id}",
    response_model=InvitationResponse,
)
async def revoke_invitation(
    organization_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> InvitationResponse:
    invitation = await TeamService(session).revoke_invitation(
        organization_id=organization_id,
        invitation_id=invitation_id,
        actor=current_user,
    )
    await session.commit()
    return InvitationResponse.model_validate(invitation)


@router.post("/api/invitations/accept", response_model=MessageResponse)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    try:
        await TeamService(session).accept_invitation(actor=current_user, token=payload.token)
    except HTTPException:
        await session.commit()
        raise
    await session.commit()
    return MessageResponse(message="Invitation accepted")


@router.get(
    "/api/organizations/{organization_id}/members",
    response_model=list[TeamMemberResponse],
)
async def list_members(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[TeamMemberResponse]:
    members = await TeamService(session).list_members(organization_id=organization_id, actor=current_user)
    return [to_member_response(member) for member in members]


@router.patch(
    "/api/organizations/{organization_id}/members/{membership_id}",
    response_model=MessageResponse,
)
async def update_member_role(
    organization_id: UUID,
    membership_id: UUID,
    payload: TeamMemberRoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    await TeamService(session).update_member_role(
        organization_id=organization_id,
        membership_id=membership_id,
        actor=current_user,
        role=payload.role,
    )
    await session.commit()
    return MessageResponse(message="Member role updated")


@router.delete(
    "/api/organizations/{organization_id}/members/{membership_id}",
    response_model=MessageResponse,
)
async def remove_member(
    organization_id: UUID,
    membership_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    await TeamService(session).remove_member(
        organization_id=organization_id,
        membership_id=membership_id,
        actor=current_user,
    )
    await session.commit()
    return MessageResponse(message="Member removed")


def to_member_response(member: TeamMember) -> TeamMemberResponse:
    membership: OrganizationUser = member.membership
    user = member.user
    return TeamMemberResponse(
        membership_id=membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=membership.role,  # type: ignore[arg-type]
        status=membership.status,
        created_at=membership.created_at,
        updated_at=membership.updated_at,
    )
