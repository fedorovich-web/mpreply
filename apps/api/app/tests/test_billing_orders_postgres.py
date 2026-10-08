from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.billing_order import BillingOrder
from app.models.billing_period import BillingPeriod
from app.models.billing_plan import BillingPlan
from app.models.organization import Organization
from app.models.user import User
from app.providers.lava import LavaClient, VerifiedInvoice
from app.schemas.billing import PurchaseRequest
from app.services.billing_order_service import BillingOrderService
from app.services.lava_webhook_service import LavaWebhookService
from app.services.reply_credit_service import CreditKind, ReplyCreditService
from app.tests.test_billing_order_routes import seed_buyer
from app.tests.test_lava_client import configured


@pytest.fixture
async def billing_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    configured = os.environ.get("MPREPLY_BILLING_TEST_DATABASE_URL")
    if not configured:
        pytest.skip("Requires isolated native PostgreSQL billing test database")
    url = make_url(configured)
    if url.host not in {"127.0.0.1", "localhost"} or not (url.database or "").startswith("mpreply_credit_test_"):
        raise ValueError("Billing tests only run against an isolated local test database")
    engine = create_async_engine(url, pool_size=12, max_overflow=12)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


async def seed_order(session: AsyncSession, *, org: Organization | None = None, key: object = None) -> BillingOrder:
    user = User(email=f"{uuid4()}@example.com", password_hash="test", status="active", email_verified_at=datetime.now(UTC))
    session.add(user)
    await session.flush()
    if org is None:
        org = Organization(name="Billing test", slug=str(uuid4()), owner_user_id=user.id, status="active")
        session.add(org)
        await session.flush()
    order = BillingOrder(organization_id=org.id, actor_user_id=user.id, idempotency_key=key or uuid4(), request_hash="a" * 64,
                         correlation=str(uuid4()), kind="plan", amount_minor=129000, currency="RUB", monthly_credits=300,
                         addon_credits=0, snapshot_json={"kind": "plan", "plan_code": "start", "months": 1}, state="creating")
    session.add(order)
    await session.flush()
    return order


@pytest.mark.asyncio
async def test_duplicate_order_idempotency_key_is_rejected_in_database(billing_db: async_sessionmaker[AsyncSession]) -> None:
    async with billing_db() as session:
        order = await seed_order(session)
        org = await session.get(Organization, order.organization_id)
        await session.commit()
        with pytest.raises(IntegrityError):
            await seed_order(session, org=org, key=order.idempotency_key)
        await session.rollback()


@pytest.mark.asyncio
async def test_period_cannot_reference_another_tenants_order(billing_db: async_sessionmaker[AsyncSession]) -> None:
    async with billing_db() as session:
        order = await seed_order(session)
        other_order = await seed_order(session)
        plan = await session.scalar(select(BillingPlan).where(BillingPlan.code == "start"))
        assert plan is not None
        now = datetime.now(UTC)
        session.add(BillingPeriod(organization_id=other_order.organization_id, order_id=order.id, plan_id=plan.id,
                                 starts_at=now, ends_at=now + timedelta(days=31), calendar_anchor=now, months=1,
                                 monthly_credits=300, next_grant_index=0))
        with pytest.raises(IntegrityError):
            await session.flush()
        await session.rollback()


@pytest.mark.asyncio
async def test_approved_prices_seeded_without_removing_legacy_plans(billing_db: async_sessionmaker[AsyncSession]) -> None:
    async with billing_db() as session:
        plans = {plan.code: plan for plan in (await session.scalars(select(BillingPlan))).all()}
        assert {code: plans[code].price_month_minor for code in ("start", "team", "business")} == {
            "start": 129000, "team": 349000, "business": 699000,
        }
        assert {"growth", "agency"}.issubset(plans)


@pytest.mark.asyncio
async def test_paid_order_requires_durable_provider_proof(billing_db: async_sessionmaker[AsyncSession]) -> None:
    async with billing_db() as session:
        order = await seed_order(session)
        await session.commit()
        order.state = "paid"
        with pytest.raises(IntegrityError):
            await session.flush()
        await session.rollback()


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["amount_minor", "monthly_credits", "snapshot_json", "provider_invoice_id", "state"])
async def test_paid_financial_terms_are_immutable(billing_db: async_sessionmaker[AsyncSession], field: str) -> None:
    async with billing_db() as session:
        order = await seed_order(session)
        order.state, order.provider_invoice_id, order.paid_at = "paid", uuid4(), datetime.now(UTC)
        await session.commit()
        values: dict[str, object] = {"amount_minor": 1, "monthly_credits": 999, "snapshot_json": {}, "provider_invoice_id": uuid4(), "state": "pending"}
        setattr(order, field, values[field])
        with pytest.raises(DBAPIError):
            await session.flush()
        await session.rollback()


@pytest.mark.asyncio
async def test_concurrent_purchase_replays_create_only_one_invoice(billing_db: async_sessionmaker[AsyncSession]) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    calls = 0
    async def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.03)
        return httpx.Response(200, json={"id": str(uuid4()), "paymentUrl": "https://app.lava.top/pay"})
    async with billing_db() as session:
        actor, org = await seed_buyer(session)
        actor_id, org_id = actor.id, org.id
    key = uuid4()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        async def purchase() -> object:
            async with billing_db() as session:
                actor = await session.get(User, actor_id)
                assert actor is not None
                order = await BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http)).create(
                    actor=actor, organization_id=org_id, idempotency_key=key, purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
                )
                return order.id
        orders = await asyncio.gather(*(purchase() for _ in range(20)))
    assert len(set(orders)) == 1 and calls == 1


@pytest.mark.asyncio
async def test_webhook_before_post_response_and_concurrent_replays_grant_once(billing_db: async_sessionmaker[AsyncSession]) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    entered, release = asyncio.Event(), asyncio.Event()
    invoice_id = uuid4()
    correlation = ""
    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal correlation
        if request.method == "POST":
            correlation = json.loads(request.content)["clientUtm"]["utm_content"]
            entered.set()
            await release.wait()
            return httpx.Response(200, json={"id": str(invoice_id), "paymentUrl": "https://app.lava.top/pay"})
        return httpx.Response(200, json={"id": str(invoice_id), "status": "COMPLETED", "receipt": {"amount": 1290, "currency": "RUB"},
                                        "clientUtm": {"utm_content": correlation}})
    async with billing_db() as session:
        actor, org = await seed_buyer(session)
        actor_id, org_id = actor.id, org.id
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        async def create() -> object:
            async with billing_db() as session:
                actor = await session.get(User, actor_id)
                assert actor is not None
                return await BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http)).create(
                    actor=actor, organization_id=org_id, idempotency_key=uuid4(), purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
                )
        task = asyncio.create_task(create())
        await asyncio.wait_for(entered.wait(), timeout=5)
        event = json.dumps({"eventType": "payment.success", "contractId": str(invoice_id), "product": {"id": str(settings.lava_product_id)},
                            "amount": 1290, "currency": "RUB", "status": "completed"}).encode()
        async def deliver() -> None:
            async with billing_db() as session:
                service = LavaWebhookService(session, settings=settings, client=LavaClient(settings=settings, http=http))
                await service.receive(api_key=settings.lava_webhook_secret.get_secret_value(), payload=event)
                await service.process_due(now=datetime.now(UTC), limit=2)
        try:
            await asyncio.gather(*(deliver() for _ in range(20)))
        finally:
            release.set()
        order = await task
    assert isinstance(order, BillingOrder) and order.state == "paid"
    async with billing_db() as session:
        assert (await ReplyCreditService(session).balance(organization_id=org_id)).paid_available == 300
        assert (await session.scalars(select(BillingPeriod).where(BillingPeriod.organization_id == org_id))).all().__len__() == 1


@pytest.mark.asyncio
async def test_settlement_and_ledger_roll_back_together_then_retry_once(
    billing_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    invoice_id = uuid4()
    async with billing_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={
        "id": str(invoice_id), "paymentUrl": "https://app.lava.top/pay",
    }))) as http:
        actor, org = await seed_buyer(session)
        org_id = org.id
        service = BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http))
        order = await service.create(actor=actor, organization_id=org_id, idempotency_key=uuid4(),
                                     purchase=PurchaseRequest(kind="plan", plan_code="start", months=1))
        order_id = order.id
        original = ReplyCreditService.grant
        async def broken_grant(self: ReplyCreditService, *, organization_id: UUID, source_key: str, kind: CreditKind,
                               quantity: int, expires_at: datetime | None = None, now: datetime | None = None) -> None:
            await original(self, organization_id=organization_id, source_key=source_key, kind=kind,
                           quantity=quantity, expires_at=expires_at, now=now)
            raise RuntimeError("synthetic interruption after ledger insertion")
        monkeypatch.setattr(ReplyCreditService, "grant", broken_grant)
        invoice = VerifiedInvoice(invoice_id, "completed", 129000, "RUB", None)
        assert settings.lava_product_id is not None
        with pytest.raises(RuntimeError):
            await service.settle(order_id=order_id, invoice=invoice, event_product_id=settings.lava_product_id, now=datetime.now(UTC))
        await session.rollback()
        stored = await session.get(BillingOrder, order_id)
        assert stored is not None and stored.state == "pending" and stored.paid_at is None
        assert (await ReplyCreditService(session).balance(organization_id=org_id)).paid_available == 0
        assert not (await session.scalars(select(BillingPeriod).where(BillingPeriod.order_id == order_id))).all()
        monkeypatch.setattr(ReplyCreditService, "grant", original)
        await service.settle(order_id=order_id, invoice=invoice, event_product_id=settings.lava_product_id, now=datetime.now(UTC))
        await session.commit()
        assert (await ReplyCreditService(session).balance(organization_id=org_id)).paid_available == 300
