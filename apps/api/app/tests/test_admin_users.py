from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api import admin, auth, yandex_auth
from app.core.auth import create_access_token, hash_password
from app.core.cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from app.db.session import get_db_session
from app.models.audit_log import AuditLog
from app.models.auth_identity import AuthIdentity
from app.models.auth_session import AuthSession
from app.models.user import User
from app.providers.yandex_id import YandexProfile
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.session_service import SessionService
from app.tests.test_reply_credits import credit_session_factory
from app.tests.test_yandex_id_client import yandex_settings

USERS_PATH = "/api/admin/users"
CSRF = {"X-CSRF-Token": "1"}
PASSWORD = "test-password-123"
NOW = datetime.now(UTC)


@dataclass(slots=True)
class AdminHarness:
    client: AsyncClient
    database: async_sessionmaker[AsyncSession]


@pytest.fixture
async def admin_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.fixture
async def admin_routes(admin_db: async_sessionmaker[AsyncSession]) -> AsyncIterator[AdminHarness]:
    app = FastAPI()
    for module in (admin, auth, yandex_auth):
        app.include_router(module.router)

    async def database() -> AsyncIterator[AsyncSession]:
        async with admin_db() as session:
            yield session

    app.dependency_overrides[get_db_session] = database
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="https://api.mpreply.ru",
    ) as client:
        yield AdminHarness(client, admin_db)


def admin_cookie(client: AsyncClient, user: User) -> None:
    client.cookies.set(ACCESS_COOKIE_NAME, create_access_token(user_id=user.id), domain="api.mpreply.ru", path="/")


async def make_user(
    database: async_sessionmaker[AsyncSession],
    email: str,
    *,
    name: str | None = None,
    superadmin: bool = False,
    status: str = "active",
    with_password: bool = False,
    verified: bool = True,
    created_at: datetime = NOW,
) -> User:
    async with database() as session:
        user = User(
            email=email, name=name, status=status, is_superadmin=superadmin,
            password_hash=hash_password(PASSWORD) if with_password else None,
            email_verified_at=NOW if verified else None, created_at=created_at,
        )
        session.add(user)
        await session.commit()
        return user


def action_path(user_id: UUID) -> str:
    return f"{USERS_PATH}/{user_id}/actions"


async def test_user_list_authorization_pagination_and_literal_search(admin_routes: AdminHarness) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    jane = await make_user(database, "jane@example.com", name="Jane % Sales", with_password=True, created_at=NOW + timedelta(seconds=2))
    ann = await make_user(database, "ann@example.com", name="Jane Sales", verified=False, created_at=NOW + timedelta(seconds=1))
    assert (await client.get(USERS_PATH)).status_code == 401
    admin_cookie(client, jane)
    assert (await client.get(USERS_PATH)).status_code == 403

    admin_cookie(client, owner)
    first = await client.get(USERS_PATH, params={"q": " jAnE ", "limit": 1})
    second = await client.get(USERS_PATH, params={"q": "jane", "limit": 1, "offset": 1})
    assert first.status_code == second.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    assert first.json()["total"] == second.json()["total"] == 2
    assert first.json()["items"][0]["id"] == str(jane.id)
    assert second.json()["items"][0]["id"] == str(ann.id)
    assert second.json()["items"][0]["email_verified_at"] is None
    assert set(first.json()["items"][0]) == {"id", "email", "name", "status", "is_superadmin", "email_verified_at", "created_at"}
    exact = await client.get(USERS_PATH, params={"q": "%"})
    assert [item["email"] for item in exact.json()["items"]] == [jane.email]
    assert (await client.get(USERS_PATH, params={"limit": 101})).status_code == 422


@pytest.mark.parametrize("action", ["block", "unblock", "revoke_sessions"])
async def test_actions_require_superadmin_and_csrf_and_protect_internal_accounts(admin_routes: AdminHarness, action: str) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    peer = await make_user(database, "peer@example.com", superadmin=True)
    demo = await make_user(database, "public-demo@demo.mpreply.ru", status="demo")
    regular = await make_user(database, "regular@example.com")
    body = {"action": action}

    assert (await client.post(action_path(owner.id), headers=CSRF, json=body)).status_code == 401
    admin_cookie(client, regular)
    assert (await client.post(action_path(owner.id), headers=CSRF, json=body)).status_code == 403
    admin_cookie(client, owner)
    assert (await client.post(action_path(regular.id), json=body)).status_code == 403
    bearer = {"Authorization": f"Bearer {create_access_token(user_id=owner.id)}"}
    assert (await client.post(action_path(regular.id), headers=bearer, json=body)).status_code == 403
    for protected in (owner, peer, demo):
        assert (await client.post(action_path(protected.id), headers=CSRF, json=body)).status_code == 403
    assert (await client.post(action_path(uuid4()), headers=CSRF, json=body)).status_code == 404


async def test_block_unblock_revokes_existing_access_and_refresh_and_leaves_audit(admin_routes: AdminHarness) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    user = await make_user(database, "user@example.com", with_password=True)
    token = create_access_token(user_id=user.id)
    bearer = {"Authorization": f"Bearer {token}"}
    async with database() as session:
        grants = [await SessionService(session).issue(user_id=user.id, auth_version=0) for _ in range(2)]
        reset = await AuthService(session).request_password_reset(email=user.email)
        assert reset is not None
        await session.commit()

    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 200
    admin_cookie(client, owner)
    for _ in range(2):
        blocked = await client.post(action_path(user.id), headers=CSRF, json={"action": "block"})
        assert blocked.status_code == 200
        assert blocked.json()["status"] == "blocked"
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 401
    password_request = {"email": user.email, "password": PASSWORD}
    assert (await client.post("/api/auth/login", json=password_request)).status_code == 401
    async with database() as session:
        with pytest.raises(HTTPException) as denied:
            await AuthService(session).reset_password(raw_token=reset[1].raw_token, new_password="new-password-456")
        assert denied.value.status_code == 400
    assert (await client.post(action_path(user.id), headers=CSRF, json={"action": "unblock"})).json()["status"] == "active"
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 401
    for grant in grants:
        client.cookies.set(REFRESH_COOKIE_NAME, grant.raw_token, domain="api.mpreply.ru", path="/api/auth")
        assert (await client.post("/api/auth/refresh", headers=CSRF)).status_code == 401
    assert (await client.post("/api/auth/login", json=password_request)).status_code == 200
    assert (await client.get("/api/auth/me")).json()["id"] == str(user.id)

    async with database() as session:
        events = (await session.scalars(select(AuditLog).where(AuditLog.actor_user_id == owner.id).order_by(AuditLog.created_at))).all()
        assert [event.action for event in events] == ["admin.user.blocked", "admin.user.unblocked"]
        assert all(event.entity_type == "user" and event.entity_id == str(user.id) for event in events)
        revoked = (await session.scalars(select(AuthSession).where(AuthSession.user_id == user.id, AuthSession.auth_version == 0))).all()
        assert len(revoked) == 2 and all(item.revoked_at is not None for item in revoked)


async def test_revoke_action_ends_access_but_keeps_the_account_active(admin_routes: AdminHarness) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    user = await make_user(database, "user@example.com")
    async with database() as session:
        grant = await SessionService(session).issue(user_id=user.id, auth_version=0)
        await session.commit()
    bearer = {"Authorization": f"Bearer {create_access_token(user_id=user.id)}"}
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 200

    admin_cookie(client, owner)
    revoked = await client.post(action_path(user.id), headers=CSRF, json={"action": "revoke_sessions"})
    assert revoked.status_code == 200 and revoked.json()["status"] == "active"
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 401
    client.cookies.set(REFRESH_COOKIE_NAME, grant.raw_token, domain="api.mpreply.ru", path="/api/auth")
    assert (await client.post("/api/auth/refresh", headers=CSRF)).status_code == 401
    async with database() as session:
        event = await session.scalar(select(AuditLog).where(AuditLog.actor_user_id == owner.id))
        assert event is not None and event.action == "admin.user.sessions_revoked" and event.entity_id == str(user.id)


async def test_unblock_cannot_restore_sessions_of_a_previously_blocked_user(admin_routes: AdminHarness) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    user = await make_user(database, "blocked-before-feature@example.com", status="blocked")
    async with database() as session:
        grant = await SessionService(session).issue(user_id=user.id, auth_version=0)
        await session.commit()

    bearer = {"Authorization": f"Bearer {create_access_token(user_id=user.id)}"}
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 401
    admin_cookie(client, owner)
    assert (await client.post(action_path(user.id), headers=CSRF, json={"action": "unblock"})).status_code == 200
    assert (await client.get("/api/auth/me", headers=bearer)).status_code == 401
    client.cookies.set(REFRESH_COOKIE_NAME, grant.raw_token, domain="api.mpreply.ru", path="/api/auth")
    assert (await client.post("/api/auth/refresh", headers=CSRF)).status_code == 401


async def test_audit_failure_rolls_back_status_and_revocation(admin_routes: AdminHarness, monkeypatch: pytest.MonkeyPatch) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    user = await make_user(database, "user@example.com")
    async with database() as session:
        await SessionService(session).issue(user_id=user.id, auth_version=0)
        await session.commit()

    async def failed_audit(_: AuditService, **__: object) -> AuditLog:
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(AuditService, "write", failed_audit)
    admin_cookie(client, owner)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        await client.post(action_path(user.id), headers=CSRF, json={"action": "block"})
    async with database() as session:
        stored = await session.get(User, user.id)
        assert stored is not None and stored.status == "active" and stored.auth_version == 0
        refresh = await session.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
        assert refresh is not None and refresh.revoked_at is None


async def test_linked_yandex_identity_cannot_sign_in_until_unblocked(admin_routes: AdminHarness, monkeypatch: pytest.MonkeyPatch) -> None:
    client, database = admin_routes.client, admin_routes.database
    owner = await make_user(database, "owner@example.com", superadmin=True)
    user = await make_user(database, "user@example.com")
    settings = yandex_settings(auth_cookie_secure=True)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: settings)

    async def profile(_: object, *, code: str, code_verifier: str) -> YandexProfile:
        return YandexProfile("test-subject", settings.yandex_oauth_client_id, user.email, None)

    monkeypatch.setattr("app.api.yandex_auth.YandexIDClient.exchange_and_profile", profile)
    async with database() as session:
        session.add(AuthIdentity(provider="yandex", subject="test-subject", user_id=user.id))
        await session.commit()

    async def callback() -> str:
        start = await client.get("/api/auth/yandex/start")
        state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]
        result = await client.get("/api/auth/yandex/callback", params={"state": state, "code": "synthetic"})
        return result.headers["location"]

    admin_cookie(client, owner)
    assert (await client.post(action_path(user.id), headers=CSRF, json={"action": "block"})).status_code == 200
    assert "oauth_error=oauth_account_unavailable" in await callback()
    assert (await client.post(action_path(user.id), headers=CSRF, json={"action": "unblock"})).status_code == 200
    assert await callback() == "https://app.mpreply.ru/app/dashboard"
    assert (await client.get("/api/auth/me")).json()["id"] == str(user.id)
