from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.billing_order import BillingOrder
from app.models.billing_period import BillingPeriod
from app.models.billing_plan import BillingPlan
from app.models.organization import Organization
from app.models.reply_credit import ReplyCreditGrant
from app.models.subscription import Subscription
from app.models.user import User
from app.services.billing_period_service import BillingPeriodService, add_calendar_months
from app.services.plan_limit_service import PlanLimitService
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_reply_credits import credit_session_factory

NOW = datetime(2026, 1, 31, 12, tzinfo=UTC)


@pytest.fixture
async def periods_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


def test_calendar_months_preserve_original_day_and_time() -> None:
    assert add_calendar_months(NOW, 1) == datetime(2026, 2, 28, 12, tzinfo=UTC)
    assert add_calendar_months(NOW, 2) == datetime(2026, 3, 31, 12, tzinfo=UTC)
    assert add_calendar_months(datetime(2024, 2, 29, 10, tzinfo=UTC), 12) == datetime(2025, 2, 28, 10, tzinfo=UTC)


async def paid_order(session: AsyncSession, org: Organization | None = None, *, code: str = "start", months: int = 1) -> BillingOrder:
    user = User(email=f"{uuid4()}@example.com", password_hash="test", status="active")
    session.add(user)
    if org is None:
        org = Organization(name="Period test", slug=str(uuid4()), status="active")
        session.add(org)
    if await session.scalar(select(BillingPlan.id).where(BillingPlan.code == code)) is None:
        session.add(BillingPlan(code=code, name=code, currency="RUB", is_active=True))
    await session.flush()
    order = BillingOrder(organization_id=org.id, actor_user_id=user.id, idempotency_key=uuid4(), request_hash="a" * 64,
                         correlation=str(uuid4()), kind="plan", amount_minor=129000, currency="RUB", monthly_credits=300 if code == "start" else 800,
                         addon_credits=0, snapshot_json={"plan_code": code, "months": months}, state="paid", provider_invoice_id=uuid4(), paid_at=NOW)
    session.add(order)
    await session.flush()
    return order


@pytest.mark.asyncio
async def test_annual_period_grants_due_months_once_and_expires_access(periods_db: async_sessionmaker[AsyncSession]) -> None:
    async with periods_db() as session:
        order = await paid_order(session, months=12)
        service = BillingPeriodService(session)
        period = await service.add_paid_period(order=order, now=NOW)
        await service.materialize_current(organization_id=order.organization_id, now=NOW)
        assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 300
        await service.materialize_current(organization_id=order.organization_id, now=add_calendar_months(NOW, 2))
        await service.materialize_current(organization_id=order.organization_id, now=add_calendar_months(NOW, 2))
        assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 900
        assert await ReplyCreditService(session).paid_entitled(organization_id=order.organization_id, now=NOW)
        assert not await ReplyCreditService(session).paid_entitled(organization_id=order.organization_id, now=period.ends_at)
        await service.materialize_current(organization_id=order.organization_id, now=add_calendar_months(NOW, 20))
        assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 3600


@pytest.mark.asyncio
async def test_renewal_retains_anchor_and_switches_tariff_at_boundary(periods_db: async_sessionmaker[AsyncSession]) -> None:
    async with periods_db() as session:
        order = await paid_order(session)
        service = BillingPeriodService(session)
        first = await service.add_paid_period(order=order, now=NOW)
        org = await session.get(Organization, order.organization_id)
        second_order = await paid_order(session, org=org, code="team")
        second = await service.add_paid_period(order=second_order, now=NOW)
        assert second.starts_at == first.ends_at
        assert second.ends_at == datetime(2026, 3, 31, 12, tzinfo=UTC)
        current = await service.materialize_current(organization_id=order.organization_id, now=NOW)
        assert current is not None and current.order_id == order.id
        current = await service.materialize_current(organization_id=order.organization_id, now=first.ends_at)
        assert current is not None and current.order_id == second_order.id
        assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 1100


@pytest.mark.asyncio
async def test_period_from_unpaid_order_never_grants_access(periods_db: async_sessionmaker[AsyncSession]) -> None:
    async with periods_db() as session:
        order = await paid_order(session)
        order.state = "pending"
        with pytest.raises(ValueError):
            await BillingPeriodService(session).add_paid_period(order=order, now=NOW)
        assert await session.scalar(select(BillingPeriod.id)) is None


@pytest.mark.asyncio
async def test_annual_payment_evaluates_usage_within_current_month(periods_db: async_sessionmaker[AsyncSession]) -> None:
    async with periods_db() as session:
        order = await paid_order(session, months=12)
        await BillingPeriodService(session).add_paid_period(order=order, now=NOW)
        context = await PlanLimitService(session).get_billing_context(organization_id=order.organization_id, now=add_calendar_months(NOW, 2))
        assert context.period_start == add_calendar_months(NOW, 2)
        assert context.period_end == add_calendar_months(NOW, 3)


@pytest.mark.asyncio
async def test_reservation_materializes_due_month_without_scheduler_or_overview(periods_db: async_sessionmaker[AsyncSession]) -> None:
    async with periods_db() as session:
        order = await paid_order(session, months=12)
        service = BillingPeriodService(session)
        await service.add_paid_period(order=order, now=NOW)
        await service.materialize_current(organization_id=order.organization_id, now=NOW)
        first = await session.scalar(select(ReplyCreditGrant).where(ReplyCreditGrant.organization_id == order.organization_id))
        assert first is not None
        first.available, first.consumed = 0, first.quantity
        await session.commit()
        credits = ReplyCreditService(session)
        operation = await credits.reserve(organization_id=order.organization_id, operation_key=uuid4(), request_hash="a" * 64,
                                          now=add_calendar_months(NOW, 1))
        assert operation.state == "reserved"
        balance = await credits.balance(organization_id=order.organization_id)
        assert balance.paid_available == 299 and balance.reserved == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("proven", [True, False])
async def test_first_lava_purchase_preserves_only_proven_legacy_paid_interval(periods_db: async_sessionmaker[AsyncSession], proven: bool) -> None:
    async with periods_db() as session:
        order = await paid_order(session)
        plan = await session.scalar(select(BillingPlan).where(BillingPlan.code == "start"))
        assert plan is not None
        legacy_end = datetime(2026, 2, 20, 12, tzinfo=UTC)
        legacy = Subscription(organization_id=order.organization_id, plan_id=plan.id, status="active", provider="legacy" if proven else None,
                              provider_subscription_id="verified-existing" if proven else None,
                              current_period_start=datetime(2026, 1, 20, 12, tzinfo=UTC), current_period_end=legacy_end)
        session.add(legacy)
        await session.commit()
        service = BillingPeriodService(session)
        period = await service.add_paid_period(order=order, now=NOW)
        assert period.starts_at == (legacy_end if proven else NOW)
        await service.materialize_current(organization_id=order.organization_id, now=NOW)
        assert legacy.provider == ("legacy" if proven else "lava")
        if proven:
            assert legacy.provider_subscription_id == "verified-existing"
            assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 0
            await service.materialize_current(organization_id=order.organization_id, now=legacy_end)
            assert legacy.provider == "lava" and legacy.provider_subscription_id is None
            assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 300
