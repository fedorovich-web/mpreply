from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.base import MarketplacePage, NormalizedMessage, NormalizedProduct
from app.models.ai_draft import AIDraft
from app.models.customer_message import CustomerMessage
from app.models.enums import MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization
from app.models.product import Product
from app.models.reply_credit import ReplyCreditEvent, ReplyCreditOperation
from app.models.user import User
from app.services.marketplace_account_service import MarketplaceAccountService
from app.services.marketplace_ingest_service import MarketplaceIngestService
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits", "synthetic_encryption_key"]


async def test_postgres_concurrent_reviews_and_questions_reuse_product_and_reimports_reuse_message(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    async with postgres_credits() as session:
        initial = await seed(session)
        account_id = initial.marketplace_account_id

    now = datetime.now(UTC)
    product = NormalizedProduct(external_id="shared-wb-product", sku="sku", name="Shared product", brand=None,
                                category=None, image_url=None, product_url=None)

    async def ingest(kind: MessageType) -> None:
        async with postgres_credits() as session:
            account = await session.get(MarketplaceAccount, account_id)
            assert account is not None
            message = NormalizedMessage(external_id=f"same-{kind.value}", message_type=kind,
                                        rating=5 if kind is MessageType.REVIEW else None,
                                        customer_display_name=None, customer_text="Synthetic content",
                                        customer_photos=(), marketplace_created_at=now, product=product)
            for _ in range(2):
                await MarketplaceIngestService(session).ingest_page(account, MarketplacePage(items=(message,), next_cursor=None), now)
            await session.commit()

    await asyncio.gather(ingest(MessageType.REVIEW), ingest(MessageType.QUESTION))
    async with postgres_credits() as session:
        assert await session.scalar(select(func.count()).select_from(Product).where(
            Product.marketplace_account_id == account_id, Product.external_id == product.external_id)) == 1
        assert await session.scalar(select(func.count()).select_from(CustomerMessage).where(
            CustomerMessage.marketplace_account_id == account_id, CustomerMessage.external_id.like("same-%"))) == 2


@pytest.mark.parametrize("marketplace", ["wildberries", "ozon", "yandex_market", "avito"])
async def test_postgres_delete_connection_preserves_credit_history_and_prevents_reactivation(
    postgres_credits: async_sessionmaker[AsyncSession], marketplace: str,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert account is not None
        account.marketplace = marketplace
        actor = await session.scalar(select(User).join(Organization, Organization.owner_user_id == User.id)
                                     .where(Organization.id == account.organization_id))
        assert actor is not None
        draft = AIDraft(organization_id=account.organization_id, message_id=message.id, provider="synthetic", model="test",
                        prompt_version="test", prompt_input_hash="a" * 64, draft_text="Synthetic reply")
        session.add(draft)
        await session.flush()
        credits = ReplyCreditService(session)
        operation = await credits.reserve(organization_id=account.organization_id, operation_key=uuid4(), request_hash="a" * 64)
        await credits.consume(organization_id=account.organization_id, operation_id=operation.id, draft_id=draft.id)
        await session.commit()
        before = await session.scalar(select(func.count()).select_from(ReplyCreditEvent).where(ReplyCreditEvent.organization_id == account.organization_id))
        await MarketplaceAccountService(session).delete_account(actor=actor, account_id=account.id)
        await session.commit()
        assert account.credentials_encrypted == "" and account.status == "deleted"
        assert await session.get(CustomerMessage, message.id) is not None
        assert await session.get(ReplyCreditOperation, operation.id) is not None
        after = await session.scalar(select(func.count()).select_from(ReplyCreditEvent).where(ReplyCreditEvent.organization_id == account.organization_id))
        assert after == before
        assert not await MarketplaceAccountService(session).list_accounts(actor=actor, organization_id=account.organization_id)
        with pytest.raises(HTTPException) as error:
            await MarketplaceAccountService(session).rotate_credentials(actor=actor, account_id=account.id, raw_credentials="cannot-reactivate")
        assert error.value.status_code == 404
