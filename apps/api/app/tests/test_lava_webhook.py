from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta, tzinfo
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.billing_webhook import BillingWebhook
from app.providers.lava import LavaClient
from app.schemas.billing import PurchaseRequest
from app.services.billing_order_service import BillingOrderService
from app.services.lava_webhook_service import LavaWebhookService
from app.services.reply_credit_service import ReplyCreditService, utc
from app.tests.test_billing_order_routes import seed_buyer
from app.tests.test_lava_client import configured
from app.tests.test_reply_credits import credit_session_factory


@pytest.mark.asyncio
async def test_webhook_route_requires_provider_header_without_cookie_auth(
    monkeypatch: pytest.MonkeyPatch, webhook_db: async_sessionmaker[AsyncSession],
) -> None:
    from app.api.billing import router
    from app.db.session import get_db_session
    app = FastAPI()
    app.include_router(router)
    async def database() -> AsyncIterator[AsyncSession]:
        async with webhook_db() as session:
            yield session
    app.dependency_overrides[get_db_session] = database
    monkeypatch.setattr("app.services.lava_webhook_service.get_settings", lambda: configured())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as http:
        response = await http.post("/api/billing/lava/webhook", json={})
    assert response.status_code == 401


@pytest.fixture
async def webhook_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.mark.asyncio
@pytest.mark.parametrize("secret", [None, "wrong"])
async def test_unauthenticated_webhook_is_not_persisted(webhook_db: async_sessionmaker[AsyncSession], secret: str | None) -> None:
    async with webhook_db() as session:
        with pytest.raises(HTTPException) as failure:
            await LavaWebhookService(session, settings=configured()).receive(api_key=secret, payload=b'{}')
        assert failure.value.status_code == 401
        assert await session.scalar(select(func.count()).select_from(BillingWebhook)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("first_event", ["payment.success", "payment.failed"])
async def test_success_replay_grants_once_and_failed_cannot_regress_paid(webhook_db: async_sessionmaker[AsyncSession], first_event: str) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    invoice_id = uuid4()
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(200, json={"id": str(invoice_id), "paymentUrl": "https://app.lava.top/pay"})
        return httpx.Response(200, json={"id": str(invoice_id), "status": "COMPLETED", "receipt": {"amount": 1290, "currency": "RUB"}})
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session)
        client = LavaClient(settings=settings, http=http)
        order = await BillingOrderService(session, settings=settings, client=client).create(
            actor=actor, organization_id=org.id, idempotency_key=uuid4(), purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
        )
        service = LavaWebhookService(session, settings=settings, client=client)
        event = {"eventType": first_event, "contractId": str(invoice_id), "product": {"id": str(settings.lava_product_id)},
                 "amount": 1290, "currency": "RUB", "status": "completed", "buyer": {"email": "should-not-be-stored@example.com"}}
        for _ in range(2):
            await service.receive(api_key=settings.lava_webhook_secret.get_secret_value(), payload=json.dumps(event).encode())
            await service.process_due(now=datetime.now(UTC), limit=10)
        await session.refresh(order)
        assert order.state == "paid"
        assert (await ReplyCreditService(session).balance(organization_id=org.id)).paid_available == 300
        event["eventType"] = "payment.failed"
        event["status"] = "failed"
        await service.receive(api_key=settings.lava_webhook_secret.get_secret_value(), payload=json.dumps(event).encode())
        await service.process_due(now=datetime.now(UTC), limit=10)
        await session.refresh(order)
        assert order.state == "paid"
        assert (await ReplyCreditService(session).balance(organization_id=org.id)).paid_available == 300
        payloads = (await session.scalars(select(BillingWebhook.payload_json))).all()
        assert "should-not-be-stored" not in json.dumps(payloads)


@pytest.mark.asyncio
@pytest.mark.parametrize("mismatch", ["product", "amount", "currency"])
async def test_mismatched_payment_never_grants_credits(webhook_db: async_sessionmaker[AsyncSession], mismatch: str) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    invoice_id = uuid4()
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(200, json={"id": str(invoice_id), "paymentUrl": "https://app.lava.top/pay"})
        return httpx.Response(200, json={"id": str(invoice_id), "status": "COMPLETED", "receipt": {"amount": 1290, "currency": "RUB"}})
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session)
        client = LavaClient(settings=settings, http=http)
        order = await BillingOrderService(session, settings=settings, client=client).create(
            actor=actor, organization_id=org.id, idempotency_key=uuid4(), purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
        )
        event = {"eventType": "payment.success", "contractId": str(invoice_id), "product": {"id": str(settings.lava_product_id)},
                 "amount": 1290, "currency": "RUB", "status": "completed"}
        if mismatch == "product":
            event["product"] = {"id": str(uuid4())}
        elif mismatch == "amount":
            event["amount"] = 1
        else:
            event["currency"] = "USD"
        service = LavaWebhookService(session, settings=settings, client=client)
        await service.receive(api_key=settings.lava_webhook_secret.get_secret_value(), payload=json.dumps(event).encode())
        await service.process_due(now=datetime.now(UTC), limit=10)
        await session.refresh(order)
        assert order.state != "paid"
        assert (await ReplyCreditService(session).balance(organization_id=order.organization_id)).paid_available == 0


@pytest.fixture
def webhook_clock(monkeypatch: pytest.MonkeyPatch) -> list[datetime]:
    current = [datetime.now(UTC)]
    clock = Mock(wraps=datetime)
    def current_time(_: tzinfo | None = None) -> datetime:
        return current[0]
    clock.now.side_effect = current_time
    monkeypatch.setattr("app.services.lava_webhook_service.datetime", clock)
    return current


def pending_event(*, due: datetime) -> BillingWebhook:
    return BillingWebhook(event_digest=uuid4().hex, event_type="payment.success", state="pending", next_attempt_at=due,
                          payload_json={"contractId": str(uuid4()), "product_id": str(uuid4()), "amount_minor": 129000, "currency": "RUB"})


@pytest.mark.asyncio
async def test_each_webhook_claim_gets_a_full_lease_after_previous_provider_work(
    webhook_db: async_sessionmaker[AsyncSession], webhook_clock: list[datetime],
) -> None:
    started = webhook_clock[0]
    async def handler(_: httpx.Request) -> httpx.Response:
        webhook_clock[0] += timedelta(seconds=40)
        return httpx.Response(503)
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        first, second = pending_event(due=started - timedelta(seconds=2)), pending_event(due=started - timedelta(seconds=1))
        session.add_all([first, second])
        await session.commit()
        processed = await LavaWebhookService(session, settings=configured(), client=LavaClient(settings=configured(), http=http)).process_due(
            now=started, limit=2,
        )
        await session.refresh(second)
        assert processed == 0
        assert second.state == "pending"
        assert second.attempt_count == 1
        assert utc(second.next_attempt_at) == started + timedelta(seconds=81)


@pytest.mark.asyncio
@pytest.mark.parametrize("elapsed", [59, 60, 61])
async def test_payment_settlement_requires_unexpired_lease_at_provider_readback(
    webhook_db: async_sessionmaker[AsyncSession], webhook_clock: list[datetime], elapsed: int,
) -> None:
    settings = configured(web_app_url="https://app.mpreply.ru")
    invoice_id = uuid4()
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(200, json={"id": str(invoice_id), "paymentUrl": "https://app.lava.top/pay"})
        webhook_clock[0] += timedelta(seconds=elapsed)
        return httpx.Response(200, json={"id": str(invoice_id), "status": "COMPLETED", "receipt": {"amount": 1290, "currency": "RUB"}})
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        actor, org = await seed_buyer(session)
        client = LavaClient(settings=settings, http=http)
        order = await BillingOrderService(session, settings=settings, client=client).create(
            actor=actor, organization_id=org.id, idempotency_key=uuid4(), purchase=PurchaseRequest(kind="plan", plan_code="start", months=1),
        )
        event = pending_event(due=webhook_clock[0] - timedelta(seconds=1))
        event.payload_json = {"contractId": str(invoice_id), "product_id": str(settings.lava_product_id), "amount_minor": 129000, "currency": "RUB"}
        session.add(event)
        await session.commit()
        order_id, org_id, event_id = order.id, org.id, event.id
        processed = await LavaWebhookService(session, settings=settings, client=client).process_due(now=webhook_clock[0], limit=1)
        order = await session.get(type(order), order_id, populate_existing=True)
        event = await session.get(BillingWebhook, event_id, populate_existing=True)
        assert order is not None and event is not None
        if elapsed < 60:
            assert processed == 1 and order.state == "paid" and event.state == "processed"
            assert order.paid_at is not None and utc(order.paid_at) == webhook_clock[0]
            assert (await ReplyCreditService(session).balance(organization_id=org_id, now=webhook_clock[0])).paid_available == 300
        else:
            assert processed == 0 and order.state == "pending" and event.state == "processing"
            assert order.paid_at is None and event.lease_token is not None
            assert (await ReplyCreditService(session).balance(organization_id=org_id, now=webhook_clock[0])).paid_available == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("elapsed", [10, 60])
async def test_provider_error_respects_lease_deadline_and_schedules_retry_after_readback(
    webhook_db: async_sessionmaker[AsyncSession], webhook_clock: list[datetime], elapsed: int,
) -> None:
    started = webhook_clock[0]
    def handler(_: httpx.Request) -> httpx.Response:
        webhook_clock[0] += timedelta(seconds=elapsed)
        return httpx.Response(503)
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        event = pending_event(due=started)
        session.add(event)
        await session.commit()
        event_id = event.id
        assert await LavaWebhookService(session, settings=configured(), client=LavaClient(settings=configured(), http=http)).process_due(
            now=started, limit=1,
        ) == 0
        event = await session.get(BillingWebhook, event_id, populate_existing=True)
        assert event is not None and event.attempt_count == 1
        if elapsed < 60:
            assert event.state == "pending" and event.lease_token is None and event.last_error == "lava_request_rejected"
            assert utc(event.next_attempt_at) == started + timedelta(seconds=11)
        else:
            assert event.state == "processing" and event.lease_token is not None and event.last_error is None
            assert utc(event.next_attempt_at) == started


@pytest.mark.asyncio
async def test_provider_error_cannot_requeue_event_whose_processing_state_was_revoked(
    webhook_db: async_sessionmaker[AsyncSession], webhook_clock: list[datetime],
) -> None:
    event = pending_event(due=webhook_clock[0])
    async def handler(_: httpx.Request) -> httpx.Response:
        async with webhook_db() as other:
            await other.execute(update(BillingWebhook).where(BillingWebhook.id == event.id).values(state="review_required"))
            await other.commit()
        return httpx.Response(503)
    async with webhook_db() as session, httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        session.add(event)
        await session.commit()
        event_id = event.id
        assert await LavaWebhookService(session, settings=configured(), client=LavaClient(settings=configured(), http=http)).process_due(
            now=webhook_clock[0], limit=1,
        ) == 0
        stored = await session.get(BillingWebhook, event_id, populate_existing=True)
        assert stored is not None and stored.state == "review_required" and stored.last_error is None
