from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.billing_plan import BillingPlan
from app.models.enums import Marketplace, ResponseMode
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.services.marketplace_account_service import MarketplaceAccountService
from app.tests.test_automatic_drafts import synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits", "synthetic_encryption_key"]


async def test_concurrent_connections_cannot_exceed_plan_limit_and_do_not_block_other_tenants(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    async with postgres_credits() as session:
        actor = User(email=f"{uuid4()}@example.com", password_hash="synthetic", status="active")
        plan = BillingPlan(code=str(uuid4()), name="Synthetic one connection plan", limits_json={"marketplace_accounts": 1})
        session.add_all([actor, plan])
        await session.flush()
        organizations = [Organization(name="Synthetic limit test", slug=str(uuid4()), owner_user_id=actor.id, plan_id=plan.id)
                         for _ in range(2)]
        session.add_all(organizations)
        await session.flush()
        session.add_all([OrganizationUser(organization_id=org.id, user_id=actor.id, role="owner") for org in organizations])
        await session.commit()
        actor_id = actor.id
        organization_id, other_organization_id = (org.id for org in organizations)

    async def create(session: AsyncSession, organization_id: UUID) -> None:
        actor = await session.get(User, actor_id)
        assert actor is not None
        await MarketplaceAccountService(session).create_account(
            actor=actor, organization_id=organization_id, marketplace=Marketplace.WILDBERRIES,
            display_name="Synthetic connection", raw_credentials="synthetic-never-sent", seller_id=None,
            default_response_mode=ResponseMode.SEMI_AUTO,
        )

    async with postgres_credits() as first, postgres_credits() as second:
        await create(first, organization_id)
        second_pid = await second.scalar(text("SELECT pg_backend_pid()"))

        async def competing_create() -> int:
            try:
                await create(second, organization_id)
                await second.commit()
                return 201
            except HTTPException as error:
                await second.rollback()
                return error.status_code

        competing = asyncio.create_task(competing_create())
        try:
            async with asyncio.timeout(10), postgres_credits() as observer:
                while not competing.done():
                    blocked = await observer.scalar(text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": second_pid})
                    if blocked:
                        break
                    await asyncio.sleep(0.01)

            async with asyncio.timeout(5), postgres_credits() as other:
                await create(other, other_organization_id)
                await other.commit()

            await first.commit()
            assert await asyncio.wait_for(competing, timeout=10) == 402
        finally:
            if not competing.done():
                competing.cancel()
                await asyncio.gather(competing, return_exceptions=True)

    async with postgres_credits() as session:
        for org_id in (organization_id, other_organization_id):
            assert await session.scalar(select(func.count()).select_from(MarketplaceAccount).where(
                MarketplaceAccount.organization_id == org_id,
            )) == 1
