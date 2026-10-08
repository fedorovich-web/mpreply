from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.billing_plan import BillingPlan
from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.providers.lava import LavaClient
from app.schemas.billing import PurchaseRequest
from app.services.billing_order_service import BillingOrderService
from app.tests.test_lava_client import configured
from app.tests.test_reply_credits import credit_session_factory


@pytest.fixture
async def orders_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


async def seed_buyer(session: AsyncSession, role: str = "owner", status: str = "active") -> tuple[User, Organization]:
    actor = User(email=f"{uuid4()}@example.com", password_hash="test", status=status)
    org = Organization(name="Order test", slug=str(uuid4()), status="active")
    session.add_all([actor, org])
    if await session.scalar(select(BillingPlan.id).where(BillingPlan.code == "start")) is None:
        session.add(BillingPlan(code="start", name="Start", price_month_minor=129000, currency="RUB", is_active=True))
    await session.flush()
    session.add(OrganizationUser(organization_id=org.id, user_id=actor.id, role=role, status="active"))
    await session.commit()
    return actor, org


@pytest.mark.asyncio
async def test_same_order_key_returns_same_checkout_without_second_invoice(orders_db: async_sessionmaker[AsyncSession]) -> None:
    calls = 0
    invoice = uuid4()
    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert json.loads(request.content)["amount"] == 1290
        return httpx.Response(200, json={"id": str(invoice), "paymentUrl": "https://app.lava.top/pay"})
    settings = configured(web_app_url="https://app.mpreply.ru")
    async with orders_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session)
        service = BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http))
        key = uuid4()
        request = PurchaseRequest(kind="plan", plan_code="start", months=1)
        first = await service.create(actor=actor, organization_id=org.id, idempotency_key=key, purchase=request)
        replay = await service.create(actor=actor, organization_id=org.id, idempotency_key=key, purchase=request)
        assert (first.id, first.state, first.amount_minor) == (replay.id, "pending", 129000)
        assert first.provider_invoice_id == invoice
        assert calls == 1
        with pytest.raises(HTTPException) as failure:
            await service.create(actor=actor, organization_id=org.id, idempotency_key=key,
                                 purchase=PurchaseRequest(kind="plan", plan_code="start", months=12))
        assert failure.value.status_code == 409
        assert not (failure.value.headers or {}).get("X-Billing-Order-Not-Created")
        assert calls == 1


@pytest.mark.asyncio
async def test_preorder_rejection_proves_that_no_invoice_was_created(orders_db: async_sessionmaker[AsyncSession]) -> None:
    from app.schemas.billing import PackPurchase
    async with orders_db() as session:
        actor, org = await seed_buyer(session)
        with pytest.raises(HTTPException) as failure:
            await BillingOrderService(session, settings=configured()).create(
                actor=actor, organization_id=org.id, idempotency_key=uuid4(),
                purchase=PurchaseRequest(kind="addon", packs=[PackPurchase(quantity=20000, count=100)] * 3),
            )
        assert failure.value.status_code == 400
        assert (failure.value.headers or {}).get("X-Billing-Order-Not-Created") == "1"


@pytest.mark.asyncio
@pytest.mark.parametrize("role,status", [("viewer", "active"), ("manager", "active"), ("owner", "demo"), ("owner", "blocked")])
async def test_forbidden_buyer_never_calls_lava(orders_db: async_sessionmaker[AsyncSession], role: str, status: str) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise AssertionError("Forbidden buyer must not call Lava")
    settings = configured()
    async with orders_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session, role=role, status=status)
        with pytest.raises(HTTPException) as failure:
            await BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http)).create(
                actor=actor, organization_id=org.id, idempotency_key=uuid4(), purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
            )
        assert failure.value.status_code == 403


@pytest.mark.asyncio
async def test_ambiguous_post_is_saved_and_replayed_without_retry(orders_db: async_sessionmaker[AsyncSession]) -> None:
    calls = 0
    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.ReadTimeout("timeout", request=request)
    settings = configured(web_app_url="https://app.mpreply.ru")
    async with orders_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session)
        service = BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http))
        key = uuid4()
        request = PurchaseRequest(kind="plan", plan_code="start", months=1)
        order = await service.create(actor=actor, organization_id=org.id, idempotency_key=key, purchase=request)
        assert order.state == "review_required" and order.payment_url is None
        assert (await service.create(actor=actor, organization_id=org.id, idempotency_key=key, purchase=request)).id == order.id
        assert calls == 1


@pytest.mark.asyncio
async def test_other_organization_cannot_read_order(orders_db: async_sessionmaker[AsyncSession]) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    async with orders_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={
        "id": str(uuid4()), "paymentUrl": "https://app.lava.top/pay",
    }))) as http:
        actor, org = await seed_buyer(session)
        service = BillingOrderService(session, settings=settings, client=LavaClient(settings=settings, http=http))
        order = await service.create(actor=actor, organization_id=org.id, idempotency_key=uuid4(),
                                     purchase=PurchaseRequest(kind="plan", plan_code="start", months=1))
        with pytest.raises(HTTPException) as failure:
            await service.get(actor=actor, organization_id=uuid4(), order_id=order.id)
        assert failure.value.status_code == 404
