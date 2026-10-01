from __future__ import annotations

import calendar
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utc
from app.models.billing_order import BillingOrder
from app.models.billing_period import BillingPeriod
from app.models.billing_plan import BillingPlan
from app.models.organization import Organization
from app.models.subscription import Subscription


def add_calendar_months(anchor: datetime, months: int) -> datetime:
    value = utc(anchor)
    year, month = divmod(value.year * 12 + value.month - 1 + months, 12)
    month += 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def period_boundary(period: BillingPeriod, index: int) -> datetime:
    start, anchor = utc(period.starts_at), utc(period.calendar_anchor)
    offset = (start.year - anchor.year) * 12 + start.month - anchor.month
    return add_calendar_months(anchor, offset + index)


class BillingPeriodService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _lock(self, organization_id: UUID) -> Organization:
        org = await self.session.scalar(select(Organization).where(Organization.id == organization_id).with_for_update(key_share=True))
        if org is None:
            raise ValueError("Organization does not exist")
        return org

    async def add_paid_period(self, *, order: BillingOrder, now: datetime) -> BillingPeriod:
        if order.state != "paid" or order.provider_invoice_id is None or order.paid_at is None or order.kind != "plan":
            raise ValueError("Verified tariff payment is required")
        await self._lock(order.organization_id)
        existing = await self.session.scalar(select(BillingPeriod).where(BillingPeriod.order_id == order.id))
        if existing is not None:
            return existing
        months = order.snapshot_json.get("months")
        if type(months) is not int or months not in (1, 12):
            raise ValueError("Invalid purchased period")
        plan = await self.session.scalar(select(BillingPlan).where(BillingPlan.code == order.snapshot_json.get("plan_code")))
        if plan is None:
            raise ValueError("Purchased tariff is missing")
        previous = await self.session.scalar(select(BillingPeriod).join(BillingOrder, BillingOrder.id == BillingPeriod.order_id).where(
            BillingPeriod.organization_id == order.organization_id, BillingOrder.state == "paid",
        ).order_by(BillingPeriod.ends_at.desc()).limit(1))
        anchor = utc(previous.calendar_anchor) if previous is not None and utc(previous.ends_at) > utc(now) else utc(now)
        start = utc(previous.ends_at) if previous is not None and utc(previous.ends_at) > utc(now) else utc(now)
        if previous is None:
            legacy = await self.session.scalar(select(Subscription).where(Subscription.organization_id == order.organization_id))
            if (legacy is not None and legacy.status == "active" and legacy.provider and legacy.provider_subscription_id
                    and legacy.current_period_start is not None and utc(legacy.current_period_start) <= utc(now)
                    and legacy.current_period_end is not None and utc(legacy.current_period_end) > utc(now)):
                start = anchor = utc(legacy.current_period_end)
        offset = (start.year - anchor.year) * 12 + start.month - anchor.month
        period = BillingPeriod(organization_id=order.organization_id, order_id=order.id, plan_id=plan.id,
                               starts_at=start, ends_at=add_calendar_months(anchor, offset + months), calendar_anchor=anchor,
                               months=months, monthly_credits=order.monthly_credits, next_grant_index=0, next_grant_at=start)
        self.session.add(period)
        await self.session.flush()
        return period

    async def materialize_current(self, *, organization_id: UUID, now: datetime) -> BillingPeriod | None:
        # The ledger primitive is loaded here so reservation can depend on this service without an import cycle.
        from app.services.reply_credit_service import ReplyCreditService

        first = await self.session.scalar(select(BillingPeriod.id).join(BillingOrder, BillingOrder.id == BillingPeriod.order_id).where(
            BillingPeriod.organization_id == organization_id, BillingOrder.state == "paid",
        ).limit(1))
        if first is None:
            return None
        org = await self._lock(organization_id)
        periods = list((await self.session.scalars(select(BillingPeriod).join(BillingOrder, BillingOrder.id == BillingPeriod.order_id).where(
            BillingPeriod.organization_id == organization_id, BillingOrder.state == "paid",
        ).order_by(BillingPeriod.starts_at).execution_options(populate_existing=True))).all())
        current: BillingPeriod | None = None
        credits = ReplyCreditService(self.session)
        for paid in periods:
            while paid.next_grant_index < paid.months and period_boundary(paid, paid.next_grant_index) <= utc(now):
                await credits.grant(organization_id=organization_id, source_key=f"lava:order:{paid.order_id}:month:{paid.next_grant_index}",
                                    kind="monthly", quantity=paid.monthly_credits, now=now)
                paid.next_grant_index += 1
            paid.next_grant_at = period_boundary(paid, paid.next_grant_index) if paid.next_grant_index < paid.months else None
            if utc(paid.starts_at) <= utc(now) < utc(paid.ends_at):
                current = paid
        subscription = await self.session.scalar(select(Subscription).where(Subscription.organization_id == organization_id))
        if current is not None:
            if subscription is None:
                subscription = Subscription(organization_id=organization_id, plan_id=current.plan_id)
                self.session.add(subscription)
            subscription.plan_id = current.plan_id
            subscription.status = "active"
            subscription.current_period_start = current.starts_at
            subscription.current_period_end = current.ends_at
            subscription.trial_ends_at = None
            subscription.provider = "lava"
            subscription.provider_subscription_id = None
            subscription.cancel_at_period_end = True
            org.plan_id = current.plan_id
        elif subscription is not None and subscription.provider == "lava":
            subscription.status = "expired"
        await self.session.flush()
        return current

    async def grant_due(self, *, now: datetime, limit: int) -> int:
        organizations = list((await self.session.scalars(select(BillingPeriod.organization_id).where(
            BillingPeriod.next_grant_at.is_not(None), BillingPeriod.next_grant_at <= now,
        ).order_by(BillingPeriod.next_grant_at, BillingPeriod.id).limit(limit))).all())
        for organization_id in dict.fromkeys(organizations):
            await self.materialize_current(organization_id=organization_id, now=now)
        await self.session.commit()
        return len(set(organizations))
