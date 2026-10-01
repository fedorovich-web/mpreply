from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import hash_password
from app.models.auth_identity import AuthIdentity
from app.models.auth_session import AuthSession
from app.models.user import User
from app.providers.yandex_id import YandexIDError, YandexProfile
from app.services.auth_service import AuthService
from app.services.oauth_state_service import OAuthAttempt
from app.services.session_service import SessionService
from app.services.yandex_auth_service import YandexAuthService
from app.tests.test_reply_credits import credit_session_factory

NOW = datetime.now(UTC)


@pytest.fixture
async def identity_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


def attempt(*, user: User | None = None) -> OAuthAttempt:
    return OAuthAttempt("link" if user else "login", user.id if user else None, user.auth_version if user else None,
                        "ru", "/app/dashboard", None, "v" * 64)


@pytest.mark.asyncio
async def test_new_identity_has_no_fake_password_and_reuses_stable_subject(identity_db: async_sessionmaker[AsyncSession]) -> None:
    async with identity_db() as session:
        service = YandexAuthService(session)
        profile = YandexProfile("subject", "client", "buyer@example.com", "Buyer")
        user = await service.resolve(profile=profile, attempt=attempt(), now=NOW)
        await session.commit()
        assert user.password_hash is None and user.email_verified_at == NOW
        assert (await service.resolve(profile=YandexProfile("subject", "client", "changed@example.com", None), attempt=attempt(), now=NOW)).id == user.id
        assert user.email == "buyer@example.com"
        assert await session.scalar(select(func.count()).select_from(User)) == 1
        with pytest.raises(HTTPException) as failure:
            await AuthService(session).authenticate_user(email=user.email, password="arbitrary")
        assert failure.value.status_code == 401


@pytest.mark.asyncio
async def test_existing_email_never_auto_links(identity_db: async_sessionmaker[AsyncSession]) -> None:
    async with identity_db() as session:
        user = User(email="existing@example.com", password_hash=hash_password("long-secret-password"), status="active", email_verified_at=NOW)
        session.add(user)
        await session.commit()
        with pytest.raises(YandexIDError) as failure:
            await YandexAuthService(session).resolve(profile=YandexProfile("subject", "client", user.email, None), attempt=attempt(), now=NOW)
        assert failure.value.code == "account_link_required"
        assert await session.scalar(select(func.count()).select_from(AuthIdentity)) == 0
        linked = await YandexAuthService(session).resolve(profile=YandexProfile("subject", "client", user.email, None),
                                                        attempt=attempt(user=user), link_user=user, now=NOW)
        assert linked.id == user.id


@pytest.mark.asyncio
async def test_stale_link_auth_version_is_rejected(identity_db: async_sessionmaker[AsyncSession]) -> None:
    async with identity_db() as session:
        user = User(email=f"{uuid4()}@example.com", password_hash="test", status="active", email_verified_at=NOW, auth_version=0)
        session.add(user)
        await session.commit()
        started = attempt(user=user)
        user.auth_version = 1
        await session.commit()
        with pytest.raises(YandexIDError):
            await YandexAuthService(session).resolve(profile=YandexProfile("subject", "client", user.email, None),
                                                     attempt=started, link_user=user, now=NOW)
        assert await session.scalar(select(func.count()).select_from(AuthIdentity)) == 0


@pytest.mark.asyncio
async def test_missing_email_never_creates_fake_user(identity_db: async_sessionmaker[AsyncSession]) -> None:
    async with identity_db() as session:
        with pytest.raises(YandexIDError) as failure:
            await YandexAuthService(session).resolve(profile=YandexProfile("subject", "client", None, None), attempt=attempt(), now=NOW)
        assert failure.value.code == "email_required"
        assert await session.scalar(select(func.count()).select_from(User)) == 0


@pytest.mark.asyncio
async def test_passwordless_user_can_set_password_only_with_reset_proof(identity_db: async_sessionmaker[AsyncSession]) -> None:
    async with identity_db() as session:
        user = await YandexAuthService(session).resolve(profile=YandexProfile("reset-subject", "client", "reset@example.com", None), attempt=attempt(), now=NOW)
        await SessionService(session).issue(user_id=user.id, auth_version=user.auth_version)
        grant = await AuthService(session).request_password_reset(email=user.email)
        assert grant is not None
        await session.commit()
        await AuthService(session).reset_password(raw_token=grant[1].raw_token, new_password="strong-reset-password-123")
        await session.commit()
        assert user.password_hash is not None and user.auth_version == 1
        assert (await AuthService(session).authenticate_user(email=user.email, password="strong-reset-password-123")).id == user.id
        assert await session.scalar(select(func.count()).select_from(AuthSession).where(AuthSession.revoked_at.is_(None))) == 0
        with pytest.raises(HTTPException):
            await AuthService(session).reset_password(raw_token=grant[1].raw_token, new_password="different-password-456")


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["blocked", "demo"])
async def test_existing_unavailable_identity_cannot_login(identity_db: async_sessionmaker[AsyncSession], status: str) -> None:
    async with identity_db() as session:
        profile = YandexProfile("inactive-subject", "client", "inactive@example.com", None)
        user = await YandexAuthService(session).resolve(profile=profile, attempt=attempt(), now=NOW)
        user.status = status
        await session.commit()
        with pytest.raises(YandexIDError) as failure:
            await YandexAuthService(session).resolve(profile=profile, attempt=attempt(), now=NOW)
        assert failure.value.code == "oauth_account_unavailable"
