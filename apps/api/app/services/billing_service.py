from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer_package import AnswerPackage
from app.models.user import User
from app.schemas.billing import (
    AnswerBalanceResponse,
    AnswerPackageResponse,
    BillingOverviewResponse,
    BillingPlanResponse,
    SubscriptionResponse,
    UsageLimitItem,
)
from app.services.answer_entitlement_service import AnswerEntitlementService
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)
        self.entitlements = AnswerEntitlementService(session)
        self.plan_limits = PlanLimitService(session)

    async def list_answer_packages(self) -> list[AnswerPackageResponse]:
        result = await self.session.execute(
            select(AnswerPackage)
            .where(AnswerPackage.is_active.is_(True))
            .order_by(AnswerPackage.display_order.asc(), AnswerPackage.code.asc())
        )
        return [AnswerPackageResponse.model_validate(package) for package in result.scalars().all()]

    async def answer_balance(self, *, actor: User, organization_id: UUID) -> AnswerBalanceResponse:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        balance = await self.entitlements.get_balance(organization_id=organization_id)
        return AnswerBalanceResponse(
            organization_id=balance.organization_id,
            available=balance.available,
            reserved=balance.reserved,
            total=balance.total,
            trial_available=balance.trial_available,
            paid_available=balance.paid_available,
            trial_expires_at=balance.trial_expires_at,
            marketplace_limit=balance.marketplace_limit,
        )

    async def overview(self, *, actor: User, organization_id: UUID) -> BillingOverviewResponse:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        context, decisions = await self.plan_limits.evaluate_all(organization_id=organization_id)
        answer_balance = await self.entitlements.get_balance(organization_id=organization_id)
        return BillingOverviewResponse(
            organization_id=organization_id,
            plan=BillingPlanResponse.model_validate(context.plan),
            subscription=SubscriptionResponse.model_validate(context.subscription) if context.subscription else None,
            usage_period_start=context.period_start,
            usage_period_end=context.period_end,
            usage=[
                UsageLimitItem(
                    metric=decision.metric,
                    used=decision.used,
                    limit=decision.limit,
                    remaining=decision.remaining,
                    allowed=decision.allowed,
                )
                for decision in decisions
            ],
            answer_balance=AnswerBalanceResponse(
                organization_id=answer_balance.organization_id,
                available=answer_balance.available,
                reserved=answer_balance.reserved,
                total=answer_balance.total,
                trial_available=answer_balance.trial_available,
                paid_available=answer_balance.paid_available,
                trial_expires_at=answer_balance.trial_expires_at,
                marketplace_limit=answer_balance.marketplace_limit,
            ),
            pricing_finalized=context.plan.price_month_minor is not None,
        )
