from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.billing import (
    BillingOverviewResponse,
    BillingPlanResponse,
    ReplyBalanceResponse,
    SubscriptionResponse,
    UsageLimitItem,
)
from app.services.organization_service import OrganizationService
from app.services.plan_limit_service import PlanLimitService
from app.services.reply_credit_service import ReplyCreditService, utc

_READ_ROLES = {"owner", "admin", "manager", "viewer"}


class BillingService:
    def __init__(self, session: AsyncSession) -> None:
        self.organization_service = OrganizationService(session)
        self.plan_limits = PlanLimitService(session)
        self.credits = ReplyCreditService(session)

    async def overview(self, *, actor: User, organization_id: UUID, now: datetime | None = None) -> BillingOverviewResponse:
        now = now or datetime.now(UTC)
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_READ_ROLES,
        )
        context, decisions = await self.plan_limits.evaluate_all(organization_id=organization_id, now=now)
        balance = await self.credits.balance(organization_id=organization_id, now=now)
        paid_entitled = await self.credits.paid_entitled(organization_id=organization_id, now=now)
        subscription = SubscriptionResponse.model_validate(context.subscription) if context.subscription else None
        if subscription is not None:
            deadline = subscription.trial_ends_at if subscription.status == "trialing" else subscription.current_period_end
            if subscription.status in {"trialing", "active"} and deadline is not None and utc(deadline) <= utc(now):
                subscription.status = "expired"
        return BillingOverviewResponse(
            organization_id=organization_id,
            plan=BillingPlanResponse.model_validate(context.plan),
            subscription=subscription,
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
            reply_balance=ReplyBalanceResponse(
                available=balance.available,
                spendable=balance.trial_available + (balance.paid_available if paid_entitled else 0),
                trial_available=balance.trial_available,
                paid_available=balance.paid_available,
                reserved=balance.reserved,
                consumed=balance.consumed,
                expired=balance.expired,
                granted=balance.granted,
                trial_ends_at=balance.trial_ends_at,
                paid_entitled=paid_entitled,
            ),
        )
