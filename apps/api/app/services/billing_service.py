from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.billing import (
    BillingOverviewResponse,
    BillingPlanResponse,
    SubscriptionResponse,
    UsageLimitItem,
)
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self.organization_service = OrganizationService(session)
        self.plan_limits = PlanLimitService(session)

    async def overview(self, *, actor: User, organization_id: UUID) -> BillingOverviewResponse:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        context, decisions = await self.plan_limits.evaluate_all(organization_id=organization_id)
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
            pricing_finalized=context.plan.price_month_minor is not None,
        )
