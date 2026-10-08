from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.models.base import Base
from app.models.billing_plan import BillingPlan
from app.models.organization import Organization
from app.models.reply_credit import ReplyCreditEvent
from app.models.subscription import Subscription
from app.models.user import User
from app.services.billing_service import BillingService
from app.services.organization_service import OrganizationService
from app.services.reply_credit_service import ReplyCreditService, recover_due_credit_accounts

NOW = datetime(2026, 9, 30, 12, tzinfo=UTC)


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_: JSONB, __: object, **___: object) -> str:
    return "JSON"


async def credit_session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


@pytest.fixture
async def credit_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


async def organization(session: AsyncSession) -> Organization:
    org = Organization(name="Credit test", slug=str(uuid4()), status="active")
    session.add(org)
    await session.flush()
    return org


@pytest.mark.asyncio
async def test_trial_expires_at_exact_deadline_and_paid_balance_is_preserved(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=350, expires_at=NOW + timedelta(days=14), now=NOW)
        await service.grant(organization_id=org.id, source_key="paid", kind="monthly", quantity=300, now=NOW)
        await session.commit()
        before = await service.balance(organization_id=org.id, now=NOW + timedelta(days=14, microseconds=-1))
        assert (before.trial_available, before.paid_available) == (350, 300)
        after = await service.balance(organization_id=org.id, now=NOW + timedelta(days=14))
        assert (after.available, after.expired) == (300, 350)
        with pytest.raises(HTTPException) as failure:
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, paid_entitled=False, now=NOW + timedelta(days=14))
        assert failure.value.status_code == 402
        assert (await service.balance(organization_id=org.id, now=NOW + timedelta(days=400))).paid_available == 300


@pytest.mark.asyncio
async def test_grant_replay_never_adds_credits_twice_and_rejects_changed_amount(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        first = await service.grant(organization_id=org.id, source_key="paid-period-1", kind="monthly", quantity=300, now=NOW)
        same = await service.grant(organization_id=org.id, source_key="paid-period-1", kind="monthly", quantity=300, now=NOW)
        assert same.id == first.id
        with pytest.raises(HTTPException) as failure:
            await service.grant(organization_id=org.id, source_key="paid-period-1", kind="monthly", quantity=800, now=NOW)
        assert failure.value.status_code == 409
        await service.grant(organization_id=org.id, source_key="paid-period-2", kind="monthly", quantity=300, now=NOW + timedelta(days=31))
        balance = await service.balance(organization_id=org.id, now=NOW + timedelta(days=31))
        assert (balance.available, balance.granted) == (600, 600)
        assert await session.scalar(select(func.count()).select_from(ReplyCreditEvent)) == 2


@pytest.mark.asyncio
async def test_last_credit_is_reserved_once_and_duplicate_request_does_not_reserve_again(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=1, expires_at=NOW + timedelta(days=14), now=NOW)
        key = uuid4()
        operation = await service.reserve(organization_id=org.id, operation_key=key, request_hash="a" * 64, paid_entitled=False, now=NOW)
        replay = await service.reserve(organization_id=org.id, operation_key=key, request_hash="a" * 64, paid_entitled=False, now=NOW)
        assert replay.id == operation.id
        assert (await service.balance(organization_id=org.id, now=NOW)).reserved == 1
        with pytest.raises(HTTPException) as failure:
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, paid_entitled=False, now=NOW)
        assert failure.value.status_code == 402
        with pytest.raises(HTTPException) as mismatch:
            await service.reserve(organization_id=org.id, operation_key=key, request_hash="b" * 64, paid_entitled=False, now=NOW)
        assert mismatch.value.status_code == 409


@pytest.mark.asyncio
async def test_failure_release_is_idempotent_and_trial_release_after_expiry_cannot_restore_expired_credit(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=2, expires_at=NOW + timedelta(days=14), now=NOW)
        operation = await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, paid_entitled=False, now=NOW)
        await service.release(organization_id=org.id, operation_id=operation.id, reason="provider_failed", now=NOW)
        await service.release(organization_id=org.id, operation_id=operation.id, reason="provider_failed", now=NOW)
        assert (await service.balance(organization_id=org.id, now=NOW)).available == 2
        second = await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="b" * 64, paid_entitled=False, now=NOW)
        await service.release(organization_id=org.id, operation_id=second.id, reason="provider_failed", now=NOW + timedelta(days=14))
        balance = await service.balance(organization_id=org.id, now=NOW + timedelta(days=14))
        assert (balance.available, balance.reserved, balance.consumed, balance.expired) == (0, 0, 0, 2)
        assert balance.granted == balance.available + balance.reserved + balance.consumed + balance.expired


@pytest.mark.asyncio
async def test_tenants_cannot_release_each_others_reservations(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        first, second = await organization(session), await organization(session)
        service = ReplyCreditService(session)
        await service.grant(organization_id=first.id, source_key="paid", kind="addon", quantity=50, now=NOW)
        operation = await service.reserve(organization_id=first.id, operation_key=uuid4(), request_hash="a" * 64, paid_entitled=True, now=NOW)
        with pytest.raises(HTTPException) as failure:
            await service.release(organization_id=second.id, operation_id=operation.id, reason="provider_failed", now=NOW)
        assert failure.value.status_code == 404
        assert (await service.balance(organization_id=first.id, now=NOW)).reserved == 1


@pytest.mark.asyncio
async def test_abandoned_reservation_is_released_and_late_completion_is_fenced(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        await service.grant(organization_id=org.id, source_key="paid", kind="addon", quantity=50, now=NOW)
        operation = await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, paid_entitled=True, now=NOW)
        assert await service.recover_expired(organization_id=org.id, now=NOW) == 0
        assert await service.recover_expired(organization_id=org.id, now=NOW + timedelta(minutes=10)) == 1
        with pytest.raises(HTTPException) as failure:
            await service.consume(organization_id=org.id, operation_id=operation.id, draft_id=uuid4(), now=NOW + timedelta(minutes=10))
        assert failure.value.status_code == 409
        balance = await service.balance(organization_id=org.id, now=NOW + timedelta(minutes=10))
        assert (balance.available, balance.reserved, balance.consumed) == (50, 0, 0)


@pytest.mark.asyncio
async def test_new_owner_gets_350_trial_replies_once_not_for_each_workspace(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        owner = User(email="owner@example.test", name="Owner", password_hash="synthetic", status="active")
        session.add(owner)
        await session.commit()
        first = await OrganizationService(session).create_organization(owner=owner, name="First", slug="trial-first")
        await session.commit()
        second = await OrganizationService(session).create_organization(owner=owner, name="Second", slug="trial-second")
        await session.commit()
        first_balance = await ReplyCreditService(session).balance(organization_id=first.id)
        second_balance = await ReplyCreditService(session).balance(organization_id=second.id)
        assert (first_balance.available, second_balance.available) == (350, 0)
        assert first_balance.trial_ends_at is not None
        expiry_balance = await ReplyCreditService(session).balance(organization_id=first.id, now=first_balance.trial_ends_at)
        assert (expiry_balance.available, expiry_balance.expired) == (0, 350)


@pytest.mark.asyncio
async def test_expired_grant_replay_remains_idempotent(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        service = ReplyCreditService(session)
        original = await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=350, expires_at=NOW + timedelta(days=14), now=NOW)
        replay = await service.grant(
            organization_id=org.id, source_key="trial", kind="trial", quantity=350, expires_at=NOW + timedelta(days=14), now=NOW + timedelta(days=30)
        )
        assert replay.id == original.id
        assert (await service.balance(organization_id=org.id, now=NOW + timedelta(days=30))).expired == 350


@pytest.mark.asyncio
async def test_paid_credit_access_requires_provider_entitlement_in_the_current_period(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        org = await organization(session)
        plan = BillingPlan(code="test", name="Test", is_default=True, is_active=True)
        session.add(plan)
        await session.flush()
        subscription = Subscription(
            organization_id=org.id, plan_id=plan.id, status="active", current_period_start=NOW, current_period_end=NOW + timedelta(days=30)
        )
        session.add(subscription)
        await session.flush()
        service = ReplyCreditService(session)
        await service.grant(organization_id=org.id, source_key="paid", kind="monthly", quantity=300, now=NOW)
        assert not await service.paid_entitled(organization_id=org.id, now=NOW)
        with pytest.raises(HTTPException) as unpaid:
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, now=NOW)
        assert unpaid.value.status_code == 402
        subscription.provider, subscription.provider_subscription_id = "synthetic-test", "subscription-test"
        await session.flush()
        assert await service.paid_entitled(organization_id=org.id, now=NOW)
        operation = await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, now=NOW)
        await service.release(organization_id=org.id, operation_id=operation.id, reason="test", now=NOW)
        with pytest.raises(HTTPException) as ended:
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, now=NOW + timedelta(days=30))
        assert ended.value.status_code == 402
        assert (await service.balance(organization_id=org.id, now=NOW + timedelta(days=300))).paid_available == 300


@pytest.mark.asyncio
async def test_billing_overview_does_not_present_expired_trial_as_active(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        plan = BillingPlan(code="trial-test", name="Test", is_default=True, is_active=True)
        owner = User(email="billing-trial@example.test", name="Owner", password_hash="synthetic", status="active")
        session.add_all([plan, owner])
        await session.commit()
        org = await OrganizationService(session).create_organization(owner=owner, name="Trial billing", slug="billing-expiry")
        await session.commit()
        balance = await ReplyCreditService(session).balance(organization_id=org.id)
        assert balance.trial_ends_at is not None
        overview = await BillingService(session).overview(actor=owner, organization_id=org.id, now=balance.trial_ends_at)
        assert overview.subscription is not None and overview.subscription.status == "expired"
        assert overview.reply_balance.spendable == 0 and overview.reply_balance.expired == 350


@pytest.mark.asyncio
async def test_background_credit_recovery_is_bounded_and_releases_expired_reservations(credit_db: async_sessionmaker[AsyncSession]) -> None:
    async with credit_db() as session:
        first, second = await organization(session), await organization(session)
        service = ReplyCreditService(session)
        for org in [first, second]:
            await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=350, expires_at=NOW + timedelta(days=14), now=NOW)
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, now=NOW)
        await session.commit()
        assert await recover_due_credit_accounts(session, now=NOW, limit=1) == 0
        assert await recover_due_credit_accounts(session, now=NOW + timedelta(days=14), limit=1) == 1
        reserved = [(await service.balance(organization_id=org.id, now=NOW + timedelta(days=14))).reserved for org in [first, second]]
        assert sum(reserved) == 1
        assert await recover_due_credit_accounts(session, now=NOW + timedelta(days=14), limit=1) == 1
        assert await recover_due_credit_accounts(session, now=NOW + timedelta(days=14), limit=1) == 0
        for org in [first, second]:
            balance = await service.balance(organization_id=org.id, now=NOW + timedelta(days=14))
            assert (balance.available, balance.reserved, balance.consumed, balance.expired) == (0, 0, 0, 350)
