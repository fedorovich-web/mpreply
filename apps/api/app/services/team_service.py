from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, conflict, forbidden, not_found, payment_required
from app.models.organization import Organization, OrganizationUser
from app.models.organization_invitation import OrganizationInvitation
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService

_INVITABLE_ROLES = {"admin", "manager", "viewer"}
_MANAGE_ROLES = {"owner", "admin"}


@dataclass(frozen=True)
class CreatedInvitation:
    invitation: OrganizationInvitation
    accept_token: str


@dataclass(frozen=True)
class TeamMember:
    membership: OrganizationUser
    user: User


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(48)


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class TeamService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.organizations = OrganizationService(session)
        self.plan_limits = PlanLimitService(session)

    async def create_invitation(
        self,
        *,
        organization_id: UUID,
        actor: User,
        email: str,
        role: str,
        ttl_hours: int,
    ) -> CreatedInvitation:
        if role not in _INVITABLE_ROLES:
            raise bad_request("Unsupported invitation role")
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        await self._lock_organization(organization_id=organization_id)
        normalized_email = email.strip().lower()
        existing_user_result = await self.session.execute(select(User).where(User.email == normalized_email))
        existing_user = existing_user_result.scalar_one_or_none()
        if existing_user is not None:
            membership_result = await self.session.execute(
                select(OrganizationUser).where(
                    OrganizationUser.organization_id == organization_id,
                    OrganizationUser.user_id == existing_user.id,
                    OrganizationUser.status == "active",
                )
            )
            if membership_result.scalar_one_or_none() is not None:
                raise conflict("User is already a member of this organization")

        limit = await self.plan_limits.evaluate_metric(organization_id=organization_id, metric="members")
        now = datetime.now(UTC)
        if limit.limit is not None:
            pending_count_result = await self.session.execute(
                select(func.count(OrganizationInvitation.id)).where(
                    OrganizationInvitation.organization_id == organization_id,
                    OrganizationInvitation.status == "pending",
                    OrganizationInvitation.expires_at > now,
                )
            )
            pending_count = int(pending_count_result.scalar_one())
            if limit.used + pending_count >= limit.limit:
                raise payment_required("Member limit is exhausted for active members and pending invitations")

        pending_result = await self.session.execute(
            select(OrganizationInvitation)
            .where(
                OrganizationInvitation.organization_id == organization_id,
                OrganizationInvitation.email == normalized_email,
                OrganizationInvitation.status == "pending",
            )
            .with_for_update()
        )
        pending = pending_result.scalar_one_or_none()
        if pending is not None and pending.expires_at > now:
            raise conflict("An active invitation already exists for this email")
        if pending is not None:
            pending.status = "expired"
            pending.revoked_at = now
            await self.session.flush()

        raw_token = generate_invitation_token()
        invitation = OrganizationInvitation(
            organization_id=organization_id,
            email=normalized_email,
            role=role,
            token_hash=hash_invitation_token(raw_token),
            status="pending",
            expires_at=now + timedelta(hours=ttl_hours),
            invited_by_user_id=actor.id,
        )
        self.session.add(invitation)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            raise conflict("An active invitation already exists for this email") from exc
        await self.audit.write(
            action="organization.invitation.created",
            entity_type="organization_invitation",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(invitation.id),
            metadata={"email": normalized_email, "role": role},
        )
        return CreatedInvitation(invitation=invitation, accept_token=raw_token)

    async def list_invitations(self, *, organization_id: UUID, actor: User) -> list[OrganizationInvitation]:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        result = await self.session.execute(
            select(OrganizationInvitation)
            .where(OrganizationInvitation.organization_id == organization_id)
            .order_by(OrganizationInvitation.created_at.desc())
        )
        return list(result.scalars().all())

    async def revoke_invitation(
        self,
        *,
        organization_id: UUID,
        invitation_id: UUID,
        actor: User,
    ) -> OrganizationInvitation:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        result = await self.session.execute(
            select(OrganizationInvitation)
            .where(
                OrganizationInvitation.id == invitation_id,
                OrganizationInvitation.organization_id == organization_id,
            )
            .with_for_update()
        )
        invitation = result.scalar_one_or_none()
        if invitation is None:
            raise not_found("Invitation not found")
        if invitation.status != "pending":
            raise conflict("Only pending invitations can be revoked")
        invitation.status = "revoked"
        invitation.revoked_at = datetime.now(UTC)
        await self.session.flush()
        await self.audit.write(
            action="organization.invitation.revoked",
            entity_type="organization_invitation",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(invitation.id),
            metadata={"email": invitation.email},
        )
        return invitation

    async def accept_invitation(self, *, actor: User, token: str) -> OrganizationUser:
        token_hash = hash_invitation_token(token)
        initial_result = await self.session.execute(
            select(OrganizationInvitation).where(OrganizationInvitation.token_hash == token_hash)
        )
        initial_invitation = initial_result.scalar_one_or_none()
        if initial_invitation is None:
            raise not_found("Invitation not found")
        await self._lock_organization(organization_id=initial_invitation.organization_id)
        result = await self.session.execute(
            select(OrganizationInvitation)
            .where(OrganizationInvitation.token_hash == token_hash)
            .with_for_update()
        )
        invitation = result.scalar_one_or_none()
        if invitation is None:
            raise not_found("Invitation not found")
        now = datetime.now(UTC)
        if invitation.status != "pending":
            raise conflict("Invitation is no longer active")
        if invitation.expires_at <= now:
            invitation.status = "expired"
            invitation.revoked_at = now
            await self.session.flush()
            raise conflict("Invitation has expired")
        if actor.email.strip().lower() != invitation.email:
            raise forbidden("Invitation email does not match the authenticated user")

        limit = await self.plan_limits.evaluate_metric(
            organization_id=invitation.organization_id,
            metric="members",
        )
        if not limit.allowed:
            raise payment_required("Member limit is exhausted for the current plan")

        membership_result = await self.session.execute(
            select(OrganizationUser)
            .where(
                OrganizationUser.organization_id == invitation.organization_id,
                OrganizationUser.user_id == actor.id,
            )
            .with_for_update()
        )
        membership = membership_result.scalar_one_or_none()
        if membership is None:
            membership = OrganizationUser(
                organization_id=invitation.organization_id,
                user_id=actor.id,
                role=invitation.role,
                status="active",
            )
            self.session.add(membership)
        else:
            membership.role = invitation.role
            membership.status = "active"

        invitation.status = "accepted"
        invitation.accepted_by_user_id = actor.id
        invitation.accepted_at = now
        await self.session.flush()
        await self.audit.write(
            action="organization.invitation.accepted",
            entity_type="organization_invitation",
            organization_id=invitation.organization_id,
            actor_user_id=actor.id,
            entity_id=str(invitation.id),
            metadata={"membership_id": str(membership.id), "role": membership.role},
        )
        return membership

    async def list_members(self, *, organization_id: UUID, actor: User) -> list[TeamMember]:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        result = await self.session.execute(
            select(OrganizationUser, User)
            .join(User, User.id == OrganizationUser.user_id)
            .where(OrganizationUser.organization_id == organization_id, OrganizationUser.status == "active")
            .order_by(OrganizationUser.created_at.asc())
        )
        return [TeamMember(membership=membership, user=user) for membership, user in result.all()]

    async def update_member_role(
        self,
        *,
        organization_id: UUID,
        membership_id: UUID,
        actor: User,
        role: str,
    ) -> OrganizationUser:
        if role not in _INVITABLE_ROLES:
            raise bad_request("Unsupported member role")
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        membership = await self._get_member_for_update(
            organization_id=organization_id,
            membership_id=membership_id,
        )
        if membership.role == "owner":
            raise forbidden("Organization owner role cannot be changed")
        membership.role = role
        await self.session.flush()
        await self.audit.write(
            action="organization.member.role_updated",
            entity_type="organization_user",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(membership.id),
            metadata={"role": role},
        )
        return membership

    async def remove_member(
        self,
        *,
        organization_id: UUID,
        membership_id: UUID,
        actor: User,
    ) -> OrganizationUser:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_MANAGE_ROLES,
        )
        membership = await self._get_member_for_update(
            organization_id=organization_id,
            membership_id=membership_id,
        )
        if membership.role == "owner":
            raise forbidden("Organization owner cannot be removed")
        if membership.user_id == actor.id:
            raise forbidden("Use a dedicated leave-workspace flow to remove yourself")
        membership.status = "removed"
        await self.session.flush()
        await self.audit.write(
            action="organization.member.removed",
            entity_type="organization_user",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(membership.id),
            metadata={"user_id": str(membership.user_id)},
        )
        return membership

    async def _lock_organization(self, *, organization_id: UUID) -> None:
        result = await self.session.execute(
            select(Organization.id).where(Organization.id == organization_id).with_for_update()
        )
        if result.scalar_one_or_none() is None:
            raise not_found("Organization not found")

    async def _get_member_for_update(self, *, organization_id: UUID, membership_id: UUID) -> OrganizationUser:
        result = await self.session.execute(
            select(OrganizationUser)
            .where(
                OrganizationUser.id == membership_id,
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.status == "active",
            )
            .with_for_update()
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise not_found("Organization member not found")
        return membership
