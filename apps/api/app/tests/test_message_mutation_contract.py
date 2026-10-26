from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import create_access_token
from app.db.session import get_db_session
from app.main import app
from app.models.audit_log import AuditLog
from app.models.customer_message import CustomerMessage
from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.services.message_service import MessageService
from app.tests.test_automatic_drafts import automatic_db, seed

__all__ = ["automatic_db"]


async def seed_actor(session: AsyncSession) -> tuple[User, CustomerMessage]:
    message = await seed(session)
    organization = await session.get(Organization, message.organization_id)
    assert organization is not None and organization.owner_user_id is not None
    actor = await session.get(User, organization.owner_user_id)
    assert actor is not None
    actor.email_verified_at = datetime.now(UTC)
    message.assigned_to = actor.id
    await session.commit()
    return actor, message


@pytest.fixture
async def message_api(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[tuple[AsyncClient, UUID, UUID]]:
    async with automatic_db() as session:
        actor, message = await seed_actor(session)
        actor_id, message_id = actor.id, message.id

    async def session_override() -> AsyncIterator[AsyncSession]:
        async with automatic_db() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db_session, session_override)
    headers = {"Authorization": f"Bearer {create_access_token(user_id=actor_id)}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver", headers=headers) as client:
        yield client, message_id, actor_id


@pytest.mark.parametrize("status", [
    "approved", "sending", "answered", "auto_reply_sent", "auto_reply_pending", "waiting_review", "ai_draft_ready", "safety_blocked",
])
async def test_message_patch_cannot_fabricate_processing_or_delivery_status(
    message_api: tuple[AsyncClient, UUID, UUID], automatic_db: async_sessionmaker[AsyncSession], status: str,
) -> None:
    client, message_id, _ = message_api
    response = await client.patch(f"/api/messages/{message_id}", json={"status": status})
    assert response.status_code == 422
    async with automatic_db() as session:
        assert await session.scalar(select(CustomerMessage.status).where(CustomerMessage.id == message_id)) == "needs_reply"


@pytest.mark.parametrize("status", ["archived", "escalated"])
async def test_message_patch_preserves_supported_manual_actions(
    message_api: tuple[AsyncClient, UUID, UUID], status: str,
) -> None:
    client, message_id, actor_id = message_api
    response = await client.patch(f"/api/messages/{message_id}", json={"status": status, "priority": "urgent"})
    assert response.status_code == 200
    assert response.json()["status"] == status and response.json()["priority"] == "urgent"
    assert response.json()["assigned_to"] == str(actor_id)


async def test_explicit_null_unassigns_message_and_is_audited(
    message_api: tuple[AsyncClient, UUID, UUID], automatic_db: async_sessionmaker[AsyncSession],
) -> None:
    client, message_id, _ = message_api
    response = await client.patch(f"/api/messages/{message_id}", json={"assigned_to": None})
    assert response.status_code == 200 and response.json()["assigned_to"] is None
    async with automatic_db() as session:
        assert await session.scalar(select(CustomerMessage.assigned_to).where(CustomerMessage.id == message_id)) is None
        audit = await session.scalar(select(AuditLog).where(AuditLog.entity_id == str(message_id), AuditLog.action == "customer_message.updated"))
        assert audit is not None and audit.metadata_json["fields_changed"] == ["assigned_to"]


@pytest.mark.parametrize("field", ["status", "priority"])
async def test_message_patch_rejects_null_for_nonnullable_fields(message_api: tuple[AsyncClient, UUID, UUID], field: str) -> None:
    client, message_id, _ = message_api
    response = await client.patch(f"/api/messages/{message_id}", json={field: None})
    assert response.status_code == 422


@pytest.mark.parametrize("initial_status", ["approved", "auto_reply_pending", "sending", "answered", "auto_reply_sent"])
async def test_manual_status_action_does_not_override_reply_processing(
    message_api: tuple[AsyncClient, UUID, UUID], automatic_db: async_sessionmaker[AsyncSession], initial_status: str,
) -> None:
    client, message_id, _ = message_api
    async with automatic_db() as session:
        await session.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(status=initial_status))
        await session.commit()
    response = await client.patch(f"/api/messages/{message_id}", json={"status": "archived"})
    assert response.status_code == 409
    async with automatic_db() as session:
        assert await session.scalar(select(CustomerMessage.status).where(CustomerMessage.id == message_id)) == initial_status


async def test_service_cannot_bypass_manual_status_contract(automatic_db: async_sessionmaker[AsyncSession]) -> None:
    async with automatic_db() as session:
        actor, message = await seed_actor(session)
        with pytest.raises(HTTPException) as rejected:
            await MessageService(session).update_message(actor=actor, message_id=message.id, status="answered")
        assert rejected.value.status_code == 400


async def test_message_edit_rechecks_downgraded_role_despite_cached_membership(automatic_db: async_sessionmaker[AsyncSession]) -> None:
    async with automatic_db() as session:
        actor, message = await seed_actor(session)
        membership = await session.scalar(select(OrganizationUser).where(OrganizationUser.user_id == actor.id))
        assert membership is not None and membership.role == "owner"
        await session.commit()
        async with automatic_db() as writer:
            await writer.execute(update(OrganizationUser).where(OrganizationUser.id == membership.id).values(role="viewer"))
            await writer.commit()
        with pytest.raises(HTTPException) as rejected:
            await MessageService(session).update_message(actor=actor, message_id=message.id, priority="urgent")
        assert rejected.value.status_code == 403
    async with automatic_db() as observed:
        assert await observed.scalar(select(CustomerMessage.priority).where(CustomerMessage.id == message.id)) == "normal"


async def test_status_action_reloads_cached_message_before_guard(automatic_db: async_sessionmaker[AsyncSession]) -> None:
    async with automatic_db() as session:
        actor, message = await seed_actor(session)
        async with automatic_db() as writer:
            await writer.execute(update(CustomerMessage).where(CustomerMessage.id == message.id).values(status="sending"))
            await writer.commit()
        with pytest.raises(HTTPException) as rejected:
            await MessageService(session).update_message(actor=actor, message_id=message.id, status="archived")
        assert rejected.value.status_code == 409
    async with automatic_db() as observed:
        assert await observed.scalar(select(CustomerMessage.status).where(CustomerMessage.id == message.id)) == "sending"
