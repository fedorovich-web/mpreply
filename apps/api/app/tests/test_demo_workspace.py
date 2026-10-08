from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from cryptography.fernet import Fernet
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

import app.services.marketplace_account_service as marketplace_account_service
from app.core.config import get_settings
from app.db.session import get_db_session
from app.main import app
from app.models.base import Base
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.user import User
from app.services.demo_workspace_service import DEMO_EMAIL, ensure_demo_workspace


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_: JSONB, __: object, **___: object) -> str:
    return "JSON"


@pytest.fixture
async def demo_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_demo_workspace_seeds_one_read_only_tenant(demo_db: async_sessionmaker[AsyncSession]) -> None:
    async with demo_db() as session:
        first = await ensure_demo_workspace(session)
        await session.commit()
        assert first.status == "demo"

    async with demo_db() as session:
        second = await ensure_demo_workspace(session)
        await session.commit()
        assert second.id == first.id
        assert await session.scalar(select(func.count()).select_from(User).where(User.email == DEMO_EMAIL)) == 1
        assert await session.scalar(select(func.count()).select_from(Organization)) == 1
        assert await session.scalar(select(func.count()).select_from(MarketplaceAccount)) == 4
        assert await session.scalar(select(func.count()).select_from(CustomerMessage)) == 4
        membership = await session.scalar(select(OrganizationUser))
        assert membership is not None and membership.role == "viewer"
        accounts = (await session.scalars(select(MarketplaceAccount))).all()
        assert all(account.status == "disabled" and account.credentials_status == "revoked" for account in accounts)


@pytest.mark.asyncio
async def test_demo_session_reads_real_api_but_cannot_write(
    demo_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings().model_copy(update={"credentials_encryption_key": SecretStr(Fernet.generate_key().decode())})
    monkeypatch.setattr(marketplace_account_service, "get_settings", lambda: settings)
    async def override_db_session() -> AsyncIterator[AsyncSession]:
        async with demo_db() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            no_csrf = await client.post("/api/auth/demo")
            assert no_csrf.status_code == 403
            opened = await client.post("/api/auth/demo", headers={"X-CSRF-Token": "1"})
            assert opened.status_code == 200
            assert opened.json()["user"]["status"] == "demo"
            me = await client.get("/api/auth/me")
            assert me.status_code == 200
            organizations = await client.get("/api/organizations")
            assert organizations.status_code == 200
            assert organizations.json()[0]["current_user_role"] == "viewer"
            organization_id = organizations.json()[0]["id"]
            messages = await client.get("/api/messages", params={"organization_id": organization_id})
            assert messages.status_code == 200
            accounts = await client.get("/api/marketplace-accounts", params={"organization_id": organization_id})
            assert accounts.status_code == 200
            assert len(accounts.json()) == 4
            blocked = await client.post(
                "/api/organizations",
                headers={"X-CSRF-Token": "1"},
                json={"name": "My store"},
            )
            assert blocked.status_code == 403
            assert "read-only" in blocked.json()["detail"]
            key_attempt = await client.post(
                "/api/marketplace-accounts",
                headers={"X-CSRF-Token": "1"},
                json={
                    "organization_id": organization_id,
                    "marketplace": "wildberries",
                    "display_name": "My store",
                    "credentials": "secret-key-for-demo-test",
                },
            )
            assert key_attempt.status_code == 403
    finally:
        app.dependency_overrides.pop(get_db_session, None)
