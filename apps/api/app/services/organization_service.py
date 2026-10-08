from __future__ import annotations

import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found, payment_required
from app.models.billing_plan import BillingPlan
from app.models.enums import ResponseMode
from app.models.organization import Organization, OrganizationUser
from app.models.subscription import Subscription
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.plan_limit_service import PlanLimitService
from app.services.reply_credit_service import ReplyCreditService

_ALLOWED_ROLES = {"owner", "admin", "manager", "viewer"}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower().strip())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "workspace"


class OrganizationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.plan_limits = PlanLimitService(session)

    async def create_organization(self, *, owner: User, name: str, slug: str | None) -> Organization:
        # Serialize trial claims before inserting membership foreign keys.
        await self.session.scalar(select(User.id).where(User.id == owner.id).with_for_update(key_share=True))
        plan_result = await self.session.execute(select(BillingPlan).where(BillingPlan.is_default.is_(True), BillingPlan.is_active.is_(True)).limit(1))
        default_plan = plan_result.scalar_one_or_none()
        organization = Organization(
            name=name.strip(),
            slug=slugify(slug or name),
            owner_user_id=owner.id,
            plan_id=default_plan.id if default_plan is not None else None,
            default_response_mode=ResponseMode.AUTO.value,
            status="active",
        )
        self.session.add(organization)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise bad_request("Organization slug is already used") from exc

        membership = OrganizationUser(
            organization_id=organization.id,
            user_id=owner.id,
            role="owner",
            status="active",
        )
        self.session.add(membership)
        await self.session.flush()

        trial = await ReplyCreditService(self.session).activate_trial(organization_id=organization.id, owner_user_id=owner.id)
        if default_plan is not None:
            period_start, period_end = PlanLimitService.month_period(datetime.now(UTC))
            self.session.add(
                Subscription(
                    organization_id=organization.id,
                    plan_id=default_plan.id,
                    status="trialing" if trial is not None else "inactive",
                    current_period_start=trial.starts_at if trial is not None else period_start,
                    current_period_end=trial.ends_at if trial is not None else period_end,
                    trial_ends_at=trial.ends_at if trial is not None else None,
                    provider=None,
                )
            )
            await self.session.flush()

        await self.audit.write(
            action="organization.created",
            entity_type="organization",
            organization_id=organization.id,
            actor_user_id=owner.id,
            entity_id=str(organization.id),
            metadata={"name": organization.name, "slug": organization.slug},
        )
        return organization

    async def list_for_user(self, *, user_id: UUID) -> list[Organization]:
        rows = await self.list_for_user_with_roles(user_id=user_id)
        return [organization for organization, _role in rows]

    async def list_for_user_with_roles(self, *, user_id: UUID) -> list[tuple[Organization, str]]:
        stmt = (
            select(Organization, OrganizationUser.role)
            .join(OrganizationUser, OrganizationUser.organization_id == Organization.id)
            .where(OrganizationUser.user_id == user_id, OrganizationUser.status == "active")
            .order_by(Organization.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return [(organization, role) for organization, role in result.all()]

    async def get_for_user(self, *, organization_id: UUID, user_id: UUID) -> Organization:
        stmt = (
            select(Organization)
            .join(OrganizationUser, OrganizationUser.organization_id == Organization.id)
            .where(
                Organization.id == organization_id,
                OrganizationUser.user_id == user_id,
                OrganizationUser.status == "active",
            )
        )
        result = await self.session.execute(stmt)
        organization = result.scalar_one_or_none()
        if organization is None:
            raise not_found("Organization not found")
        return organization

    async def get_membership(self, *, organization_id: UUID, user_id: UUID) -> OrganizationUser:
        stmt = select(OrganizationUser).where(
            OrganizationUser.organization_id == organization_id,
            OrganizationUser.user_id == user_id,
            OrganizationUser.status == "active",
        )
        result = await self.session.execute(stmt)
        membership = result.scalar_one_or_none()
        if membership is None:
            raise not_found("Organization membership not found")
        return membership

    async def require_membership_role(self, *, organization_id: UUID, user_id: UUID, allowed_roles: set[str]) -> OrganizationUser:
        membership = await self.get_membership(organization_id=organization_id, user_id=user_id)
        if membership.role not in allowed_roles:
            raise forbidden("You do not have permission to perform this action")
        return membership

    async def update_organization(
        self,
        *,
        organization_id: UUID,
        actor: User,
        name: str | None = None,
        default_response_mode: str | None = None,
        status: str | None = None,
    ) -> Organization:
        await self.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles={"owner", "admin"},
        )
        organization = await self.get_for_user(organization_id=organization_id, user_id=actor.id)
        if name is not None:
            organization.name = name.strip()
        if default_response_mode is not None:
            organization.default_response_mode = default_response_mode
        if status is not None:
            organization.status = status

        await self.session.flush()
        await self.audit.write(
            action="organization.updated",
            entity_type="organization",
            organization_id=organization.id,
            actor_user_id=actor.id,
            entity_id=str(organization.id),
            metadata={
                "name_changed": name is not None,
                "default_response_mode": default_response_mode,
                "status": status,
            },
        )
        return organization

    async def add_user(
        self,
        *,
        organization_id: UUID,
        actor: User,
        user_id: UUID,
        role: str,
    ) -> OrganizationUser:
        if role not in _ALLOWED_ROLES:
            raise bad_request("Unsupported organization role")
        await self.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles={"owner", "admin"},
        )
        limit_decision = await self.plan_limits.evaluate_metric(
            organization_id=organization_id,
            metric="members",
        )
        if not limit_decision.allowed:
            raise payment_required("Member limit is exhausted for the current plan")
        membership = OrganizationUser(
            organization_id=organization_id,
            user_id=user_id,
            role=role,
            status="active",
        )
        self.session.add(membership)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise bad_request("User is already a member of this organization") from exc

        await self.audit.write(
            action="organization.user.added",
            entity_type="organization_user",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(membership.id),
            metadata={"user_id": str(user_id), "role": role},
        )
        return membership
