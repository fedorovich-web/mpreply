from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text, update
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization
from app.models.product import Product
from app.models.reply_credit import ReplyCreditEvent, ReplyCreditOperation
from app.models.user import User
from app.providers.groq import GroqProvider
from app.services.ai_service import AIService
from app.services.demo_workspace_service import ensure_demo_workspace
from app.services.organization_service import OrganizationService
from app.services.reply_credit_service import ReplyCreditService, recover_due_credit_accounts
from app.tests.test_ai_credit_generation import VALID_COMPLETION


@pytest.fixture
async def postgres_credits() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    configured = os.environ.get("MPREPLY_CREDIT_TEST_DATABASE_URL")
    if not configured:
        pytest.skip("Requires the isolated native PostgreSQL credit test database")
    url = make_url(configured)
    if url.host not in {"127.0.0.1", "localhost"} or not (url.database or "").startswith("mpreply_credit_test_"):
        raise ValueError("Credit tests may only use an isolated local PostgreSQL test database")
    engine = create_async_engine(url, pool_size=12, max_overflow=12)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


async def seeded_org(factory: async_sessionmaker[AsyncSession], quantity: int = 1) -> UUID:
    async with factory() as session:
        org = Organization(name="PostgreSQL credit test", slug=str(uuid4()), status="active")
        session.add(org)
        await session.flush()
        await ReplyCreditService(session).grant(
            organization_id=org.id,
            source_key="trial",
            kind="trial",
            quantity=quantity,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        return org.id


@pytest.mark.asyncio
async def test_postgres_only_one_concurrent_request_can_reserve_the_last_credit(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    org_id = await seeded_org(postgres_credits)

    async def reserve() -> int:
        async with postgres_credits() as session:
            try:
                await ReplyCreditService(session).reserve(organization_id=org_id, operation_key=uuid4(), request_hash="a" * 64)
                await session.commit()
                return 200
            except HTTPException as error:
                await session.rollback()
                return error.status_code

    results = await asyncio.gather(*(reserve() for _ in range(20)))
    assert results.count(200) == 1 and results.count(402) == 19
    async with postgres_credits() as session:
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.available, balance.reserved, balance.granted) == (0, 1, 1)


@pytest.mark.asyncio
async def test_postgres_concurrent_operation_replays_share_one_reservation(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    org_id = await seeded_org(postgres_credits, 50)
    key = uuid4()

    async def reserve() -> UUID:
        async with postgres_credits() as session:
            operation = await ReplyCreditService(session).reserve(organization_id=org_id, operation_key=key, request_hash="a" * 64)
            await session.commit()
            return operation.id

    operations = await asyncio.gather(*(reserve() for _ in range(12)))
    assert len(set(operations)) == 1
    async with postgres_credits() as session:
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.available, balance.reserved) == (49, 1)


@pytest.mark.asyncio
async def test_postgres_history_is_immutable_and_draft_reference_is_tenant_scoped(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    org_id = await seeded_org(postgres_credits)
    async with postgres_credits() as session:
        event_id = await session.scalar(select(ReplyCreditEvent.id).where(ReplyCreditEvent.organization_id == org_id))
        with pytest.raises(DBAPIError):
            await session.execute(text("UPDATE reply_credit_events SET quantity = 99 WHERE id = :id"), {"id": event_id})
        await session.rollback()
        with pytest.raises(DBAPIError):
            await session.execute(text("DELETE FROM reply_credit_events WHERE id = :id"), {"id": event_id})
        await session.rollback()
        user = await ensure_demo_workspace(session)
        message = await session.scalar(select(CustomerMessage).where(CustomerMessage.organization_id != org_id))
        assert message is not None
        draft = AIDraft(
            organization_id=message.organization_id,
            message_id=message.id,
            provider="test",
            model="test",
            prompt_version="test",
            prompt_input_hash="a" * 64,
            draft_text="Synthetic draft",
            created_by=user.id,
        )
        session.add(draft)
        await session.flush()
        draft_id = draft.id
        await session.commit()
        operation = await ReplyCreditService(session).reserve(organization_id=org_id, operation_key=uuid4(), request_hash="a" * 64)
        operation_id = operation.id
        await session.commit()
        with pytest.raises(IntegrityError):
            await ReplyCreditService(session).consume(organization_id=org_id, operation_id=operation_id, draft_id=draft_id)
        await session.rollback()
        operation = await session.get(ReplyCreditOperation, operation_id)
        assert operation is not None and operation.state == "reserved"


@pytest.mark.asyncio
async def test_postgres_concurrent_workspace_creation_grants_only_one_owner_trial(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    async with postgres_credits() as session:
        user = User(email=f"{uuid4()}@example.test", name="Owner", password_hash="synthetic", status="active")
        session.add(user)
        await session.commit()
        user_id = user.id

    async def create() -> UUID:
        async with postgres_credits() as session:
            owner = await session.get(User, user_id)
            assert owner is not None
            org = await OrganizationService(session).create_organization(owner=owner, name="Concurrent", slug=str(uuid4()))
            await session.commit()
            return org.id

    organizations = await asyncio.gather(*(create() for _ in range(6)))
    async with postgres_credits() as session:
        balances = [await ReplyCreditService(session).balance(organization_id=org) for org in organizations]
        assert sum(balance.granted for balance in balances) == 350
        assert sum(balance.available > 0 for balance in balances) == 1
        assert await session.scalar(select(func.count()).select_from(Organization).where(Organization.id.in_(organizations))) == 6


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["answered", "product", "unchanged"])
async def test_postgres_generation_rechecks_context_after_provider_without_holding_message_lock(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, change: str,
) -> None:
    now = datetime.now(UTC)
    async with postgres_credits() as session:
        actor = User(email=f"{uuid4()}@example.test", name="Generation test", password_hash="synthetic", status="active")
        session.add(actor)
        await session.flush()
        org = await OrganizationService(session).create_organization(owner=actor, name="Generation test", slug=str(uuid4()))
        account = MarketplaceAccount(
            id=uuid4(), organization_id=org.id, marketplace="wildberries", display_name="Synthetic test account",
            credentials_encrypted="synthetic-no-credentials", credentials_fingerprint="0" * 64,
        )
        session.add(account)
        await session.flush()
        product = Product(
            id=uuid4(), organization_id=org.id, marketplace_account_id=account.id,
            marketplace="wildberries", external_id=str(uuid4()), name="Context item", metadata_json={"size": "original"},
        )
        session.add(product)
        await session.flush()
        message = CustomerMessage(
            organization_id=org.id, marketplace_account_id=account.id, product_id=product.id, marketplace="wildberries",
            external_id=str(uuid4()), type="review", status="needs_reply", rating=5, customer_text="Positive feedback",
            marketplace_created_at=now, imported_at=now, last_synced_at=now,
        )
        session.add(message)
        await session.commit()
        org_id, message_id, product_id = org.id, message.id, product.id

        async def complete(**_: object) -> object:
            # This would time out if generation held row locks during provider I/O.
            async with asyncio.timeout(3), postgres_credits() as concurrent:
                if change == "product":
                    await concurrent.execute(update(Product).where(Product.id == product_id).values(metadata_json={"size": "changed"}))
                elif change == "answered":
                    await concurrent.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(status="answered"))
                else:
                    await concurrent.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(priority="high"))
                await concurrent.commit()
            return VALID_COMPLETION

        provider = AsyncMock(side_effect=complete)
        monkeypatch.setattr(GroqProvider, "complete", provider)
        service = AIService(session)
        key = uuid4()
        if change == "unchanged":
            draft = await service.generate_draft(actor=actor, message_id=message_id, operation_key=key)
            # A completed request remains replayable after the message is answered.
            message.status = "answered"
            await session.commit()
            repeated = await service.generate_draft(actor=actor, message_id=message_id, operation_key=key)
            assert repeated.id == draft.id
        else:
            with pytest.raises(HTTPException) as failure:
                await service.generate_draft(actor=actor, message_id=message_id, operation_key=key)
            assert failure.value.status_code == 409
        assert provider.await_count == 1
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.available, balance.reserved, balance.consumed) == ((349, 0, 1) if change == "unchanged" else (350, 0, 0))
        await session.refresh(message)
        assert message.status == ("needs_reply" if change == "product" else "answered")
        assert await session.scalar(select(func.count()).select_from(AIDraft).where(AIDraft.organization_id == org_id)) == (1 if change == "unchanged" else 0)


@pytest.mark.asyncio
async def test_postgres_concurrent_maintenance_does_not_expire_or_release_twice(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    # An earlier synthetic clock isolates these due accounts from the other cases.
    now = datetime(2000, 1, 1, tzinfo=UTC)
    organizations: list[UUID] = []
    async with postgres_credits() as session:
        for _ in range(2):
            org = Organization(name="Maintenance test", slug=str(uuid4()), status="active")
            session.add(org)
            await session.flush()
            service = ReplyCreditService(session)
            await service.grant(organization_id=org.id, source_key="trial", kind="trial", quantity=350, expires_at=now + timedelta(days=14), now=now)
            await service.reserve(organization_id=org.id, operation_key=uuid4(), request_hash="a" * 64, now=now)
            organizations.append(org.id)
        await session.commit()

    async def recover() -> int:
        async with postgres_credits() as session:
            return await recover_due_credit_accounts(session, now=now + timedelta(days=14), limit=1)

    assert sum(await asyncio.gather(*(recover() for _ in range(6)))) == 2
    async with postgres_credits() as session:
        for org_id in organizations:
            balance = await ReplyCreditService(session).balance(organization_id=org_id, now=now + timedelta(days=14))
            assert (balance.available, balance.reserved, balance.expired, balance.granted) == (0, 0, 350, 350)
