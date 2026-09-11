from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.auth_tokens import digest_auth_token
from app.models.auth_session import AuthSession
from app.models.base import Base
from app.models.user import User
from app.services.session_service import SessionError, SessionService

SessionFixture = tuple[AsyncSession, User]


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


@pytest.fixture
async def session_fixture() -> AsyncIterator[SessionFixture]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync_connection: Base.metadata.create_all(
                sync_connection,
                tables=[
                    Base.metadata.tables["users"],
                    Base.metadata.tables["auth_sessions"],
                ],
            )
        )

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = User(
            email="roman@example.com",
            name="Roman",
            password_hash="unused-in-session-tests",
            status="active",
            email_verified_at=datetime(2026, 9, 11, 12, 0, tzinfo=UTC),
            auth_version=3,
        )
        session.add(user)
        await session.commit()
        yield session, user

    await engine.dispose()


@pytest.mark.asyncio
async def test_refresh_session_persists_only_digest_for_30_days(
    session_fixture: SessionFixture,
) -> None:
    session, user = session_fixture
    now = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)
    service = SessionService(session, now=lambda: now, ttl=timedelta(days=30))

    grant = await service.issue(user_id=user.id, auth_version=user.auth_version)
    await session.commit()

    persisted = (await session.execute(select(AuthSession))).scalar_one()
    assert grant.raw_token
    assert persisted.token_digest == digest_auth_token(grant.raw_token)
    assert persisted.token_digest != grant.raw_token
    assert persisted.auth_version == user.auth_version
    assert grant.expires_at == now + timedelta(days=30)


@pytest.mark.asyncio
async def test_refresh_rotation_revokes_old_token_and_rejects_replay(
    session_fixture: SessionFixture,
) -> None:
    session, user = session_fixture
    now = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)
    service = SessionService(session, now=lambda: now, ttl=timedelta(days=30))
    original = await service.issue(user_id=user.id, auth_version=user.auth_version)
    await session.commit()

    rotated = await service.rotate(original.raw_token)
    await session.commit()

    assert rotated.raw_token != original.raw_token
    sessions = (
        (await session.execute(select(AuthSession).order_by(AuthSession.created_at)))
        .scalars()
        .all()
    )
    assert len(sessions) == 2
    assert sessions[0].revoked_at is not None
    assert _utc(sessions[0].revoked_at) == now
    assert sessions[1].revoked_at is None

    with pytest.raises(SessionError, match="invalid_refresh_session"):
        await service.rotate(original.raw_token)


@pytest.mark.asyncio
async def test_refresh_rejects_auth_version_changed_after_password_change(
    session_fixture: SessionFixture,
) -> None:
    session, user = session_fixture
    now = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)
    service = SessionService(session, now=lambda: now, ttl=timedelta(days=30))
    grant = await service.issue(user_id=user.id, auth_version=user.auth_version)
    await session.commit()

    user.auth_version += 1
    await session.commit()

    with pytest.raises(SessionError, match="invalid_refresh_session"):
        await service.rotate(grant.raw_token)


@pytest.mark.asyncio
async def test_revoke_all_invalidates_every_refresh_session(
    session_fixture: SessionFixture,
) -> None:
    session, user = session_fixture
    now = datetime(2026, 9, 11, 12, 0, tzinfo=UTC)
    service = SessionService(session, now=lambda: now, ttl=timedelta(days=30))
    first = await service.issue(user_id=user.id, auth_version=user.auth_version)
    second = await service.issue(user_id=user.id, auth_version=user.auth_version)
    await session.commit()

    await service.revoke_all(user.id)
    await session.commit()

    with pytest.raises(SessionError, match="invalid_refresh_session"):
        await service.rotate(first.raw_token)
    with pytest.raises(SessionError, match="invalid_refresh_session"):
        await service.rotate(second.raw_token)
