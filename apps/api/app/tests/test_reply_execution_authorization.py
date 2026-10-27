from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.capabilities import OZON_CAPABILITY
from app.adapters.ozon import OzonAdapter
from app.adapters.registry import MarketplaceAdapterRegistry, ProviderRegistration
from app.core.config import get_settings
from app.core.security import CredentialService
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.user import User
from app.services.reply_execution_service import ReplyExecutionService
from app.tests.test_automatic_drafts import automatic_db, seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["automatic_db", "postgres_credits", "synthetic_encryption_key"]

_REVOCATIONS = ("role", "membership", "user", "verification", "organization", "missing_actor")


class _SQLiteExecutionService(ReplyExecutionService):
    async def _get_owned_attempt_for_update(self, reply_id: UUID, *, attempt_count: int, idempotency_key: str) -> Reply | None:
        reply = await super()._get_owned_attempt_for_update(reply_id, attempt_count=attempt_count, idempotency_key=idempotency_key)
        # SQLite drops timezone information on round trips; PostgreSQL tests use the unmodified service.
        if reply is not None and reply.last_attempt_at is not None and reply.last_attempt_at.tzinfo is None:
            reply.last_attempt_at = reply.last_attempt_at.replace(tzinfo=UTC)
        return reply


async def _assert_revoked_execution_is_blocked(
    factory: async_sessionmaker[AsyncSession], *, mode: str, stage: str, change: str,
) -> None:
    async with factory() as session:
        message = await seed(session, mode)
        actor = await session.scalar(select(User).where(User.id == (select(Organization.owner_user_id)
                                          .where(Organization.id == message.organization_id)).scalar_subquery()))
        assert actor is not None
        actor.email_verified_at = datetime.now(UTC)
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert account is not None
        account.seller_id = "100200"
        account.scopes_json = {"scopes": ["questions:read", "questions:write"]}
        account.credentials_encrypted = CredentialService(get_settings().credentials_encryption_key.get_secret_value()).encrypt("synthetic-api-key")
        message.metadata_json = {"sku": 646399170}
        message.status = "auto_reply_pending" if mode == "auto" else "approved"
        reply = Reply(organization_id=message.organization_id, message_id=message.id, reply_text="Synthetic reply",
                      status="queued", mode=mode, idempotency_key=str(uuid4()), created_by=actor.id,
                      sent_by=actor.id if mode == "semi_auto" else None)
        session.add(reply)
        await session.commit()
        reply_id, actor_id, organization_id = reply.id, actor.id, message.organization_id

    async def revoke() -> None:
        async with factory() as concurrent:
            if change == "role":
                await concurrent.execute(update(OrganizationUser).where(
                    OrganizationUser.organization_id == organization_id, OrganizationUser.user_id == actor_id,
                ).values(role="viewer"))
            elif change == "membership":
                await concurrent.execute(update(OrganizationUser).where(
                    OrganizationUser.organization_id == organization_id, OrganizationUser.user_id == actor_id,
                ).values(status="disabled"))
            elif change == "user":
                await concurrent.execute(update(User).where(User.id == actor_id).values(status="disabled"))
            elif change == "verification":
                await concurrent.execute(update(User).where(User.id == actor_id).values(email_verified_at=None))
            elif change == "organization":
                await concurrent.execute(update(Organization).where(Organization.id == organization_id).values(status="disabled"))
            else:
                field = Reply.created_by if mode == "auto" else Reply.sent_by
                await concurrent.execute(update(Reply).where(Reply.id == reply_id).values({field: None}))
            await concurrent.commit()

    requests: list[str] = []

    async def provider(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        if request.url.path == "/v1/question/answer/list":
            if stage == "preflight":
                await revoke()
            return httpx.Response(200, json={"answers": [], "last_id": ""})
        assert request.url.path == "/v1/question/answer/create"
        return httpx.Response(200, json={"answer_id": "synthetic-answer"})

    if stage == "queued":
        await revoke()
    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=httpx.MockTransport(provider)) as client, factory() as worker:
        adapter = OzonAdapter(client)
        registry = MarketplaceAdapterRegistry({Marketplace.OZON: ProviderRegistration(
            capability=OZON_CAPABILITY, credential_factory=lambda: adapter, review_factory=lambda: adapter,
        )})
        service_type = _SQLiteExecutionService if worker.bind.dialect.name == "sqlite" else ReplyExecutionService
        result = await service_type(worker, registry=registry).execute_reply(reply_id=reply_id)
        assert (result.status, result.retryable, result.error_code) == ("failed", False, "authorization_revoked")
    assert requests == (["/v1/question/answer/list"] if stage == "preflight" else [])


@pytest.mark.parametrize("mode", ["auto", "semi_auto"])
@pytest.mark.parametrize("stage", ["queued", "preflight"])
@pytest.mark.parametrize("change", _REVOCATIONS)
async def test_reply_execution_rechecks_current_authority(
    automatic_db: async_sessionmaker[AsyncSession], mode: str, stage: str, change: str,
) -> None:
    await _assert_revoked_execution_is_blocked(automatic_db, mode=mode, stage=stage, change=change)


@pytest.mark.parametrize("mode", ["auto", "semi_auto"])
@pytest.mark.parametrize("change", _REVOCATIONS)
async def test_postgres_reply_execution_rechecks_authority_after_preflight(
    postgres_credits: async_sessionmaker[AsyncSession], mode: str, change: str,
) -> None:
    await _assert_revoked_execution_is_blocked(postgres_credits, mode=mode, stage="preflight", change=change)
