from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_draft import AIDraft
from app.models.billing_plan import BillingPlan
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.subscription import Subscription

_LIMIT_METRICS = (
    "ai_drafts_monthly",
    "replies_sent_monthly",
    "marketplace_accounts",
    "members",
)


@dataclass(frozen=True)
class UsageLimitDecision:
    metric: str
    used: int
    limit: int | None
    remaining: int | None
    allowed: bool


@dataclass(frozen=True)
class BillingContext:
    plan: BillingPlan
    subscription: Subscription | None
    period_start: datetime
    period_end: datetime


class PlanLimitService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_billing_context(self, *, organization_id: UUID, now: datetime | None = None) -> BillingContext:
        current = now or datetime.now(UTC)
        period_start, period_end = self.month_period(current)

        subscription_result = await self.session.execute(
            select(Subscription).where(
                Subscription.organization_id == organization_id,
                Subscription.status.in_({"active", "trialing", "past_due"}),
            )
        )
        subscription = subscription_result.scalar_one_or_none()

        plan: BillingPlan | None = None
        if subscription is not None:
            plan_result = await self.session.execute(select(BillingPlan).where(BillingPlan.id == subscription.plan_id))
            plan = plan_result.scalar_one_or_none()

        if plan is None:
            organization_result = await self.session.execute(select(Organization).where(Organization.id == organization_id))
            organization = organization_result.scalar_one_or_none()
            if organization is not None and organization.plan_id is not None:
                plan_result = await self.session.execute(select(BillingPlan).where(BillingPlan.id == organization.plan_id))
                plan = plan_result.scalar_one_or_none()

        if plan is None:
            plan_result = await self.session.execute(select(BillingPlan).where(BillingPlan.is_default.is_(True), BillingPlan.is_active.is_(True)).limit(1))
            plan = plan_result.scalar_one_or_none()

        if plan is None:
            raise RuntimeError("Default billing plan is not configured")

        effective_start = subscription.current_period_start if subscription and subscription.current_period_start else period_start
        effective_end = subscription.current_period_end if subscription and subscription.current_period_end else period_end
        return BillingContext(plan=plan, subscription=subscription, period_start=effective_start, period_end=effective_end)

    async def evaluate_all(self, *, organization_id: UUID, now: datetime | None = None) -> tuple[BillingContext, list[UsageLimitDecision]]:
        context = await self.get_billing_context(organization_id=organization_id, now=now)
        decisions = [
            await self.evaluate_metric(
                organization_id=organization_id,
                metric=metric,
                context=context,
            )
            for metric in _LIMIT_METRICS
        ]
        return context, decisions

    async def evaluate_metric(
        self,
        *,
        organization_id: UUID,
        metric: str,
        context: BillingContext | None = None,
        now: datetime | None = None,
    ) -> UsageLimitDecision:
        billing = context or await self.get_billing_context(organization_id=organization_id, now=now)
        limit = self.limit_value(billing.plan.limits_json, metric)
        used = await self._usage_value(
            organization_id=organization_id,
            metric=metric,
            period_start=billing.period_start,
            period_end=billing.period_end,
        )
        remaining = None if limit is None else max(limit - used, 0)
        return UsageLimitDecision(
            metric=metric,
            used=used,
            limit=limit,
            remaining=remaining,
            allowed=limit is None or used < limit,
        )

    async def _usage_value(
        self,
        *,
        organization_id: UUID,
        metric: str,
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        if metric == "ai_drafts_monthly":
            stmt = select(func.count(AIDraft.id)).where(
                AIDraft.organization_id == organization_id,
                AIDraft.created_at >= period_start,
                AIDraft.created_at < period_end,
            )
        elif metric == "replies_sent_monthly":
            stmt = select(func.count(Reply.id)).where(
                Reply.organization_id == organization_id,
                Reply.sent_at.is_not(None),
                Reply.sent_at >= period_start,
                Reply.sent_at < period_end,
            )
        elif metric == "marketplace_accounts":
            stmt = select(func.count(MarketplaceAccount.id)).where(
                MarketplaceAccount.organization_id == organization_id,
                MarketplaceAccount.status != "revoked",
            )
        elif metric == "members":
            stmt = select(func.count(OrganizationUser.id)).where(
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.status == "active",
            )
        else:
            raise ValueError(f"Unsupported plan metric: {metric}")

        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    def limit_value(limits: dict[str, object], metric: str) -> int | None:
        raw = limits.get(metric)
        if raw is None:
            return None
        if isinstance(raw, bool) or not isinstance(raw, int) or raw < 0:
            raise ValueError(f"Invalid billing limit for {metric}")
        return raw

    @staticmethod
    def month_period(now: datetime) -> tuple[datetime, datetime]:
        normalized = now.astimezone(UTC)
        start = datetime(normalized.year, normalized.month, 1, tzinfo=UTC)
        end = datetime(normalized.year + 1, 1, 1, tzinfo=UTC) if normalized.month == 12 else datetime(normalized.year, normalized.month + 1, 1, tzinfo=UTC)
        return start, end
