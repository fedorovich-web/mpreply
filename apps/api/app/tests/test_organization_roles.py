from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.services.organization_service import OrganizationService
from app.tests.test_automatic_drafts import automatic_db

__all__ = ["automatic_db"]


async def seed_membership(session: AsyncSession, role: str) -> OrganizationUser:
    user = User(email=f"{uuid4()}@example.com", password_hash="synthetic", status="active")
    organization = Organization(name="Synthetic role test", slug=str(uuid4()), status="active")
    session.add_all([user, organization])
    await session.flush()
    membership = OrganizationUser(organization_id=organization.id, user_id=user.id, role=role, status="active")
    session.add(membership)
    await session.flush()
    return membership


async def test_organization_role_guard_allows_owner(automatic_db: async_sessionmaker[AsyncSession]) -> None:
    async with automatic_db() as session:
        membership = await seed_membership(session, "owner")
        allowed = await OrganizationService(session).require_membership_role(
            organization_id=membership.organization_id, user_id=membership.user_id, allowed_roles={"owner", "admin"},
        )
        assert allowed.id == membership.id


async def test_organization_role_guard_blocks_viewer(automatic_db: async_sessionmaker[AsyncSession]) -> None:
    async with automatic_db() as session:
        membership = await seed_membership(session, "viewer")
        with pytest.raises(HTTPException) as error:
            await OrganizationService(session).require_membership_role(
                organization_id=membership.organization_id, user_id=membership.user_id, allowed_roles={"owner", "admin"},
            )
        assert error.value.status_code == 403
