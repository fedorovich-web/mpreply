from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import create_access_token
from app.db.session import get_db_session
from app.main import app
from app.models.customer_message import CustomerMessage
from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.services.message_service import MessageService
from app.tests.test_automatic_drafts import automatic_db, seed

__all__ = ["automatic_db"]


async def seed_assignments(factory: async_sessionmaker[AsyncSession]) -> tuple[User, UUID, dict[str, UUID]]:
    async with factory() as session:
        own = await seed(session)
        foreign = await seed(session)
        organization = await session.get(Organization, own.organization_id)
        assert organization is not None
        actor = await session.get(User, organization.owner_user_id)
        assert actor is not None
        actor.email_verified_at = datetime.now(UTC)
        other_user = User(email=f"{uuid4()}@example.com", password_hash="synthetic", status="active")
        session.add(other_user)
        await session.flush()
        session.add_all([
            OrganizationUser(organization_id=own.organization_id, user_id=other_user.id, role="manager"),
            OrganizationUser(organization_id=foreign.organization_id, user_id=actor.id, role="manager"),
        ])
        await session.flush()
        own.assigned_to = actor.id
        foreign.assigned_to = actor.id
        additional = [CustomerMessage(
            organization_id=own.organization_id, marketplace_account_id=own.marketplace_account_id,
            marketplace="ozon", external_id=str(uuid4()), type="question", status="needs_reply", customer_text="Synthetic question",
            imported_at=own.imported_at, last_synced_at=own.last_synced_at, marketplace_created_at=own.marketplace_created_at,
            assigned_to=assignee,
        ) for assignee in (other_user.id, None)]
        session.add_all(additional)
        await session.commit()
        return actor, own.organization_id, {
            "mine": own.id, "other": additional[0].id, "unassigned": additional[1].id,
            "foreign": foreign.id, "other_user": other_user.id,
        }


@pytest.mark.parametrize("assignee,expected", [("mine", ["mine"]), ("other_user", ["other"]), (None, ["mine", "other", "unassigned"])])
async def test_message_assignment_filter_applies_to_rows_and_count_within_tenant(
    automatic_db: async_sessionmaker[AsyncSession], assignee: str | None, expected: list[str],
) -> None:
    actor, organization_id, ids = await seed_assignments(automatic_db)
    async with automatic_db() as session:
        rows, total = await MessageService(session).list_messages(
            actor=actor, organization_id=organization_id,
            assigned_to=actor.id if assignee == "mine" else ids[assignee] if assignee else None,
        )
    assert {message.id for message, _ in rows} == {ids[name] for name in expected}
    assert total == len(expected)


async def test_messages_api_forwards_assignment_filter_and_rejects_invalid_uuid(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor, organization_id, ids = await seed_assignments(automatic_db)

    async def session_override() -> AsyncIterator[AsyncSession]:
        async with automatic_db() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db_session, session_override)
    headers = {"Authorization": f"Bearer {create_access_token(user_id=actor.id)}"}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver", headers=headers) as client:
        response = await client.get("/api/messages", params={"organization_id": str(organization_id), "assigned_to": str(actor.id)})
        assert response.status_code == 200
        assert [message["id"] for message in response.json()["items"]] == [str(ids["mine"])]
        assert response.json()["total"] == 1
        invalid = await client.get("/api/messages", params={"organization_id": str(organization_id), "assigned_to": "invalid-user-id"})
        assert invalid.status_code == 422

    async with automatic_db() as session:
        assert await session.scalar(select(CustomerMessage.assigned_to).where(CustomerMessage.id == ids["foreign"])) == actor.id


async def test_message_pages_use_stable_order_for_equal_marketplace_timestamps(
    automatic_db: async_sessionmaker[AsyncSession],
) -> None:
    actor, organization_id, ids = await seed_assignments(automatic_db)
    async with automatic_db() as session:
        original = await session.get(CustomerMessage, ids["mine"])
        assert original is not None
        extra_ids = [uuid4() for _ in range(3)]
        session.add_all([CustomerMessage(
            id=message_id, organization_id=organization_id, marketplace_account_id=original.marketplace_account_id,
            marketplace="ozon", external_id=str(message_id), type="question", status="needs_reply", customer_text="Same-time question",
            imported_at=original.imported_at, last_synced_at=original.last_synced_at, marketplace_created_at=original.marketplace_created_at,
        ) for message_id in extra_ids])
        await session.commit()
    expected = sorted([ids["mine"], ids["other"], ids["unassigned"], *extra_ids], reverse=True)
    actual: list[UUID] = []
    for page in range(1, len(expected) + 1):
        async with automatic_db() as session:
            rows, total = await MessageService(session).list_messages(
                actor=actor, organization_id=organization_id, page=page, page_size=1,
            )
            assert total == len(expected)
            actual.extend(message.id for message, _ in rows)
    assert actual == expected
