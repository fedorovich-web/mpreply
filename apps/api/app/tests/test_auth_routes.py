from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

import app.services.auth_service as auth_service_module
from app.core.auth import create_access_token, hash_password
from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.core.cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from app.db.session import get_db_session
from app.main import app
from app.models.audit_log import AuditLog
from app.models.auth_session import AuthSession
from app.models.auth_token import AuthToken
from app.models.base import Base
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.session_service import RefreshSessionGrant, SessionService
from app.services.transactional_email import EmailDeliveryError, ResendEmailClient, TransactionalEmail


@compiles(JSONB, "sqlite")
def compile_jsonb_for_sqlite(_: JSONB, __: object, **___: object) -> str:
    return "JSON"


@dataclass(slots=True)
class AuthRouteHarness:
    client: AsyncClient
    session_factory: async_sessionmaker[AsyncSession]
    delivered: list[TransactionalEmail]


def _action_token(message: TransactionalEmail) -> str:
    action_url = next(line for line in message.text.splitlines() if line.startswith("http"))
    return parse_qs(urlsplit(action_url).query)["token"][0]


def _set_client_cookie(client: AsyncClient, name: str, value: str, *, path: str) -> None:
    client.cookies.set(name, value, domain="testserver.local", path=path)


@pytest.fixture
async def auth_routes(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AuthRouteHarness]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync_connection: Base.metadata.create_all(
                sync_connection,
                tables=[
                    Base.metadata.tables["users"],
                    Base.metadata.tables["auth_tokens"],
                    Base.metadata.tables["auth_sessions"],
                    Base.metadata.tables["audit_logs"],
                ],
            )
        )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    delivered: list[TransactionalEmail] = []

    async def capture_email(_: ResendEmailClient, message: TransactionalEmail) -> None:
        delivered.append(message)

    app.dependency_overrides[get_db_session] = override_db_session
    monkeypatch.setattr(ResendEmailClient, "send", capture_email)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        ) as client:
            yield AuthRouteHarness(client=client, session_factory=session_factory, delivered=delivered)
    finally:
        app.dependency_overrides.pop(get_db_session, None)
        await engine.dispose()


async def _create_verified_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> tuple[UUID, RefreshSessionGrant]:
    async with session_factory() as session:
        user = User(
            email="csrf@example.com",
            name="CSRF Test",
            password_hash=hash_password("old-password-123"),
            status="active",
            email_verified_at=datetime.now(UTC),
            auth_version=0,
        )
        session.add(user)
        await session.flush()
        grant = await SessionService(session).issue(user_id=user.id, auth_version=user.auth_version)
        await session.commit()
        return user.id, grant


@pytest.mark.asyncio
async def test_public_session_status_checks_refresh_without_rotating(auth_routes: AuthRouteHarness) -> None:
    path = "/api/auth/session-status"
    guest = await auth_routes.client.get(path)
    assert guest.status_code == 200
    assert guest.json() == {"authenticated": False}
    assert guest.headers["cache-control"] == "private, no-store"
    user_id, grant = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, grant.raw_token, path="/api/auth")

    for _ in range(2):
        response = await auth_routes.client.get(path)
        assert response.status_code == 200
        assert response.json() == {"authenticated": True}
        assert response.headers["cache-control"] == "private, no-store"
        assert "set-cookie" not in response.headers

    async with auth_routes.session_factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.auth_version += 1
        await session.commit()

    assert (await auth_routes.client.get(path)).json() == {"authenticated": False}


@pytest.mark.asyncio
async def test_public_session_status_rejects_a_blocked_users_access_cookie(auth_routes: AuthRouteHarness) -> None:
    user_id, grant = await _create_verified_session(auth_routes.session_factory)
    access = create_access_token(user_id=user_id, auth_version=grant.auth_version)
    _set_client_cookie(auth_routes.client, ACCESS_COOKIE_NAME, access, path="/")
    path = "/api/auth/session-status"
    assert (await auth_routes.client.get(path)).json() == {"authenticated": True}

    async with auth_routes.session_factory() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.status = "blocked"
        await session.commit()

    assert (await auth_routes.client.get(path)).json() == {"authenticated": False}


@pytest.mark.parametrize("path", ["/api/auth/refresh", "/api/auth/logout"])
@pytest.mark.asyncio
async def test_cookie_session_mutations_reject_missing_csrf_header(
    auth_routes: AuthRouteHarness,
    path: str,
) -> None:
    _, grant = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, grant.raw_token, path="/api/auth")

    response = await auth_routes.client.post(path)

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF validation failed"}


@pytest.mark.asyncio
async def test_change_password_rejects_cookie_auth_without_csrf_header(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(
        auth_routes.client,
        ACCESS_COOKIE_NAME,
        create_access_token(user_id=user_id),
        path="/",
    )

    response = await auth_routes.client.post(
        "/api/auth/change-password",
        json={"current_password": "old-password-123", "new_password": "new-password-456"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF validation failed"}


@pytest.mark.asyncio
async def test_change_password_allows_bearer_auth_without_csrf_header(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)

    response = await auth_routes.client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {create_access_token(user_id=user_id)}"},
        json={"current_password": "old-password-123", "new_password": "new-password-456"},
    )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_change_password_explicitly_revokes_all_refresh_sessions(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    async with auth_routes.session_factory() as session:
        await SessionService(session).issue(user_id=user_id, auth_version=0)
        await session.commit()
    _set_client_cookie(
        auth_routes.client,
        ACCESS_COOKIE_NAME,
        create_access_token(user_id=user_id),
        path="/",
    )

    response = await auth_routes.client.post(
        "/api/auth/change-password",
        headers={"X-CSRF-Token": "1"},
        json={"current_password": "old-password-123", "new_password": "new-password-456"},
    )

    assert response.status_code == 200
    async with auth_routes.session_factory() as session:
        sessions = (await session.execute(select(AuthSession))).scalars().all()
        assert len(sessions) == 2
        assert all(auth_session.revoked_at is not None for auth_session in sessions)


@pytest.mark.asyncio
async def test_password_reset_explicitly_revokes_all_refresh_sessions(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    async with auth_routes.session_factory() as session:
        user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
        reset_request = await AuthService(session).request_password_reset(email=user.email)
        assert reset_request is not None
        _, reset_grant = reset_request
        await session.commit()

    response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": reset_grant.raw_token, "new_password": "new-password-456"},
    )

    assert response.status_code == 200
    async with auth_routes.session_factory() as session:
        sessions = (await session.execute(select(AuthSession))).scalars().all()
        assert len(sessions) == 1
        assert sessions[0].revoked_at is not None


@pytest.mark.asyncio
async def test_registration_does_not_reveal_account_existence_when_email_delivery_fails(
    auth_routes: AuthRouteHarness,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await _create_verified_session(auth_routes.session_factory)

    async def fail_delivery(_: ResendEmailClient, __: TransactionalEmail) -> None:
        raise EmailDeliveryError("provider unavailable")

    monkeypatch.setattr(ResendEmailClient, "send", fail_delivery)
    existing_response = await auth_routes.client.post(
        "/api/auth/register",
        json={"email": "csrf@example.com", "password": "password-123"},
    )
    absent_response = await auth_routes.client.post(
        "/api/auth/register",
        json={"email": "absent@example.com", "password": "password-123"},
    )

    assert absent_response.status_code == existing_response.status_code == 202
    assert absent_response.json() == existing_response.json()


@pytest.mark.asyncio
async def test_auth_audit_metadata_omits_redundant_email(
    auth_routes: AuthRouteHarness,
) -> None:
    register_response = await auth_routes.client.post(
        "/api/auth/register",
        json={"email": "audit@example.com", "password": "password-123", "name": "Audit"},
    )
    assert register_response.status_code == 202
    verification_token = _action_token(auth_routes.delivered[-1])
    verify_response = await auth_routes.client.post(
        "/api/auth/verify-email",
        json={"token": verification_token},
    )
    assert verify_response.status_code == 200
    login_response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "audit@example.com", "password": "password-123"},
    )
    assert login_response.status_code == 200

    async with auth_routes.session_factory() as session:
        audit_rows = (
            (await session.execute(select(AuditLog).where(AuditLog.action.in_(["auth.user.registered", "auth.user.login"])).order_by(AuditLog.created_at)))
            .scalars()
            .all()
        )
        assert len(audit_rows) == 2
        assert all(row.actor_user_id is not None for row in audit_rows)
        assert all(row.entity_id is not None for row in audit_rows)
        assert all(row.metadata_json == {} for row in audit_rows)


@pytest.mark.asyncio
async def test_registration_verification_login_refresh_logout_lifecycle(
    auth_routes: AuthRouteHarness,
) -> None:
    register_response = await auth_routes.client.post(
        "/api/auth/register",
        json={"email": "lifecycle@example.com", "password": "old-password-123", "name": "Lifecycle"},
    )
    assert register_response.status_code == 202
    verification_token = _action_token(auth_routes.delivered[-1])

    unverified_login = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "lifecycle@example.com", "password": "old-password-123"},
    )
    assert unverified_login.status_code == 403

    verification_response = await auth_routes.client.post(
        "/api/auth/verify-email",
        json={"token": verification_token},
    )
    assert verification_response.status_code == 200
    verification_replay = await auth_routes.client.post(
        "/api/auth/verify-email",
        json={"token": verification_token},
    )
    assert verification_replay.status_code == 400

    login_response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "lifecycle@example.com", "password": "old-password-123"},
    )
    assert login_response.status_code == 200
    user_id = UUID(login_response.json()["user"]["id"])
    refresh_before = auth_routes.client.cookies.get(REFRESH_COOKIE_NAME)
    assert refresh_before is not None
    assert (await auth_routes.client.get("/api/auth/me")).status_code == 200

    auth_routes.client.cookies.clear()
    _set_client_cookie(
        auth_routes.client,
        ACCESS_COOKIE_NAME,
        create_access_token(user_id=user_id, expires_delta=timedelta(seconds=-1)),
        path="/",
    )
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, refresh_before, path="/api/auth")
    assert (await auth_routes.client.get("/api/auth/me")).status_code == 401

    refresh_response = await auth_routes.client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": "1"},
    )
    assert refresh_response.status_code == 200
    assert auth_routes.client.cookies.get(REFRESH_COOKIE_NAME) != refresh_before
    assert (await auth_routes.client.get("/api/auth/me")).status_code == 200

    logout_response = await auth_routes.client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": "1"},
    )
    assert logout_response.status_code == 200
    cleared_cookies = logout_response.headers.get_list("set-cookie")
    assert any(cookie.startswith('respio_access="";') and "Path=/" in cookie for cookie in cleared_cookies)
    assert any(cookie.startswith('respio_refresh="";') and "Path=/api/auth" in cookie for cookie in cleared_cookies)
    assert (await auth_routes.client.get("/api/auth/me")).status_code == 401
    assert (await auth_routes.client.post("/api/auth/refresh", headers={"X-CSRF-Token": "1"})).status_code == 401


@pytest.mark.asyncio
async def test_forgot_reset_revoke_and_new_password_lifecycle(
    auth_routes: AuthRouteHarness,
) -> None:
    await _create_verified_session(auth_routes.session_factory)
    login_response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "csrf@example.com", "password": "old-password-123"},
    )
    assert login_response.status_code == 200

    forgot_response = await auth_routes.client.post(
        "/api/auth/forgot-password",
        json={"email": "csrf@example.com"},
    )
    unknown_response = await auth_routes.client.post(
        "/api/auth/forgot-password",
        json={"email": "unknown@example.com"},
    )
    assert forgot_response.status_code == unknown_response.status_code == 202
    assert forgot_response.json() == unknown_response.json()
    reset_token = _action_token(auth_routes.delivered[-1])

    reset_response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": "new-password-456"},
    )
    assert reset_response.status_code == 200
    assert (await auth_routes.client.get("/api/auth/me")).status_code == 401
    assert (await auth_routes.client.post("/api/auth/refresh", headers={"X-CSRF-Token": "1"})).status_code == 401
    assert (
        await auth_routes.client.post(
            "/api/auth/login",
            json={"email": "csrf@example.com", "password": "old-password-123"},
        )
    ).status_code == 401
    assert (
        await auth_routes.client.post(
            "/api/auth/login",
            json={"email": "csrf@example.com", "password": "new-password-456"},
        )
    ).status_code == 200
    assert (
        await auth_routes.client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "new_password": "third-password-789"},
        )
    ).status_code == 400


@pytest.mark.asyncio
async def test_refresh_replay_revokes_the_rotated_session_family(
    auth_routes: AuthRouteHarness,
) -> None:
    _, original = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, original.raw_token, path="/api/auth")
    first_refresh = await auth_routes.client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": "1"},
    )
    assert first_refresh.status_code == 200
    rotated_token = auth_routes.client.cookies.get(REFRESH_COOKIE_NAME)
    assert rotated_token is not None

    auth_routes.client.cookies.clear()
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, original.raw_token, path="/api/auth")
    replay_response = await auth_routes.client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": "1"},
    )

    assert replay_response.status_code == 401
    async with auth_routes.session_factory() as session:
        rotated_session = (await session.execute(select(AuthSession).where(AuthSession.token_digest == digest_auth_token(rotated_token)))).scalar_one()
        assert rotated_session.revoked_at is not None


@pytest.mark.parametrize("refresh_state", ["missing", "unknown", "reused"])
@pytest.mark.asyncio
async def test_rejected_refresh_clears_browser_session_cookies(
    auth_routes: AuthRouteHarness,
    refresh_state: str,
) -> None:
    user_id, original = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, ACCESS_COOKIE_NAME, create_access_token(user_id=user_id), path="/")
    if refresh_state == "unknown":
        _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, "unknown-refresh-session", path="/api/auth")
    elif refresh_state == "reused":
        async with auth_routes.session_factory() as session:
            await SessionService(session).rotate(original.raw_token)
            await session.commit()
        _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, original.raw_token, path="/api/auth")

    response = await auth_routes.client.post("/api/auth/refresh", headers={"X-CSRF-Token": "1"})

    assert response.status_code == 401
    cleared_cookies = response.headers.get_list("set-cookie")
    assert any(cookie.startswith('respio_access="";') and "Max-Age=0" in cookie and "Path=/;" in cookie for cookie in cleared_cookies)
    assert any(cookie.startswith('respio_refresh="";') and "Max-Age=0" in cookie and "Path=/api/auth;" in cookie for cookie in cleared_cookies)
    assert auth_routes.client.cookies.get(ACCESS_COOKIE_NAME) is None
    assert auth_routes.client.cookies.get(REFRESH_COOKIE_NAME) is None


@pytest.mark.asyncio
async def test_immediate_resend_respects_cooldown_without_datetime_failure(
    auth_routes: AuthRouteHarness,
) -> None:
    register_response = await auth_routes.client.post(
        "/api/auth/register",
        json={"email": "resend@example.com", "password": "password-123"},
    )
    assert register_response.status_code == 202
    assert len(auth_routes.delivered) == 1

    resend_response = await auth_routes.client.post(
        "/api/auth/resend-verification",
        json={"email": "resend@example.com"},
    )

    assert resend_response.status_code == 202
    assert len(auth_routes.delivered) == 1


@pytest.mark.asyncio
async def test_expired_and_malformed_action_tokens_are_rejected(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    async with auth_routes.session_factory() as session:
        user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
        reset_request = await AuthService(session).request_password_reset(email=user.email)
        assert reset_request is not None
        _, reset_grant = reset_request
        await session.commit()

    async with auth_routes.session_factory() as session:
        reset_token = (await session.execute(select(AuthToken).where(AuthToken.token_digest == digest_auth_token(reset_grant.raw_token)))).scalar_one()
        reset_token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    expired_response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": reset_grant.raw_token, "new_password": "new-password-456"},
    )
    unknown_response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": new_auth_token(), "new_password": "new-password-456"},
    )
    malformed_response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": "short", "new_password": "new-password-456"},
    )

    assert expired_response.status_code == 400
    assert unknown_response.status_code == 400
    assert malformed_response.status_code == 422


@pytest.mark.asyncio
async def test_login_rejects_injection_shaped_credentials_and_replaces_fixed_cookies(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    fixed_access = create_access_token(user_id=user_id, expires_delta=timedelta(days=1))
    _set_client_cookie(auth_routes.client, ACCESS_COOKIE_NAME, fixed_access, path="/")
    _set_client_cookie(auth_routes.client, REFRESH_COOKIE_NAME, "attacker-fixed-refresh", path="/api/auth")

    email_injection_response = await auth_routes.client.post(
        "/api/auth/login",
        json={
            "email": "roman'+OR+'1'='1@example.com",
            "password": "old-password-123",
        },
    )
    password_injection_response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "csrf@example.com", "password": "' OR '1'='1"},
    )
    login_response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "csrf@example.com", "password": "old-password-123"},
    )

    assert email_injection_response.status_code == 401
    assert password_injection_response.status_code == 401
    assert login_response.status_code == 200
    assert (
        auth_routes.client.cookies.get(
            ACCESS_COOKIE_NAME,
            domain="testserver.local",
            path="/",
        )
        != fixed_access
    )
    assert (
        auth_routes.client.cookies.get(
            REFRESH_COOKIE_NAME,
            domain="testserver.local",
            path="/api/auth",
        )
        != "attacker-fixed-refresh"
    )


@pytest.mark.asyncio
async def test_action_token_lookup_rejects_sql_injection_shaped_token(
    auth_routes: AuthRouteHarness,
) -> None:
    injection_token = "' OR '1'='1 -- " + ("x" * 32)

    response = await auth_routes.client.post(
        "/api/auth/reset-password",
        json={"token": injection_token, "new_password": "new-password-456"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or expired token"}


@pytest.mark.asyncio
async def test_invalid_bearer_does_not_fall_back_to_cookie_auth(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, ACCESS_COOKIE_NAME, create_access_token(user_id=user_id), path="/")

    response = await auth_routes.client.post(
        "/api/auth/change-password",
        headers={"Authorization": "Bearer invalid-token"},
        json={"current_password": "old-password-123", "new_password": "new-password-456"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_non_auth_cookie_mutation_rejects_missing_csrf_header(
    auth_routes: AuthRouteHarness,
) -> None:
    user_id, _ = await _create_verified_session(auth_routes.session_factory)
    _set_client_cookie(auth_routes.client, ACCESS_COOKIE_NAME, create_access_token(user_id=user_id), path="/")

    response = await auth_routes.client.post(
        "/api/organizations",
        json={"name": "Protected workspace", "slug": "protected-workspace"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF validation failed"}


@pytest.mark.asyncio
async def test_unknown_login_still_performs_password_hash_verification(
    auth_routes: AuthRouteHarness,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    verified_hashes: list[str] = []

    def record_verification(_: str, password_hash: str) -> bool:
        verified_hashes.append(password_hash)
        return False

    monkeypatch.setattr(auth_service_module, "verify_password", record_verification)

    response = await auth_routes.client.post(
        "/api/auth/login",
        json={"email": "absent@example.com", "password": "attempted-password"},
    )

    assert response.status_code == 401
    assert len(verified_hashes) == 1
