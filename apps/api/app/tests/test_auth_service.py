from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import hash_password, verify_password
from app.core.auth_tokens import digest_auth_token
from app.models.auth_token import AuthToken
from app.models.user import User
from app.services.auth_service import RESET_PASSWORD_PURPOSE, VERIFY_EMAIL_PURPOSE, AuthService
from app.tests.test_reply_credits import credit_session_factory


@pytest.fixture
async def auth_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


async def seed_auth_user(factory: async_sessionmaker[AsyncSession], *, verified: bool = True) -> UUID:
    async with factory() as session:
        user = User(email=f"{uuid4()}@example.test", password_hash=hash_password("original-password-123"), status="active",
                    email_verified_at=datetime.now(UTC) if verified else None, auth_version=0)
        session.add(user)
        await session.commit()
        return user.id


@pytest.mark.asyncio
@pytest.mark.parametrize("use_current_password", [False, True])
async def test_password_change_refreshes_cached_hash_and_auth_version(
    auth_db: async_sessionmaker[AsyncSession], use_current_password: bool,
) -> None:
    user_id = await seed_auth_user(auth_db)
    async with auth_db() as stale, auth_db() as other:
        cached_user = await stale.get(User, user_id)
        latest_user = await other.get(User, user_id)
        assert cached_user is not None and latest_user is not None
        await AuthService(other).change_password(user=latest_user, current_password="original-password-123", new_password="first-password-456")
        await other.commit()
        if use_current_password:
            changed = await AuthService(stale).change_password(user=cached_user, current_password="first-password-456", new_password="second-password-789")
            assert changed.auth_version == 2
            await stale.commit()
        else:
            with pytest.raises(HTTPException) as error:
                await AuthService(stale).change_password(user=cached_user, current_password="original-password-123", new_password="second-password-789")
            assert error.value.status_code == 400
            await stale.rollback()
    async with auth_db() as session:
        stored = await session.get(User, user_id)
        assert stored is not None and stored.password_hash is not None
        assert stored.auth_version == (2 if use_current_password else 1)
        assert verify_password("second-password-789" if use_current_password else "first-password-456", stored.password_hash)


@pytest.mark.asyncio
@pytest.mark.parametrize("purpose", [VERIFY_EMAIL_PURPOSE, RESET_PASSWORD_PURPOSE])
async def test_action_token_replay_reloads_cached_consumption_state(
    auth_db: async_sessionmaker[AsyncSession], purpose: str,
) -> None:
    user_id = await seed_auth_user(auth_db, verified=purpose == RESET_PASSWORD_PURPOSE)
    async with auth_db() as session:
        user = await session.get(User, user_id)
        assert user is not None
        service = AuthService(session)
        if purpose == RESET_PASSWORD_PURPOSE:
            request = await service.request_password_reset(email=user.email)
            assert request is not None
            grant = request[1]
        else:
            grant = await service.issue_verification_token(user)
        assert grant is not None
        await session.commit()
    async with auth_db() as stale, auth_db() as other:
        cached_token = await stale.scalar(select(AuthToken).where(AuthToken.token_digest == digest_auth_token(grant.raw_token)))
        assert cached_token is not None and cached_token.consumed_at is None
        if purpose == RESET_PASSWORD_PURPOSE:
            await AuthService(other).reset_password(raw_token=grant.raw_token, new_password="first-password-456")
        else:
            await AuthService(other).verify_email(raw_token=grant.raw_token)
        await other.commit()
        with pytest.raises(HTTPException) as error:
            if purpose == RESET_PASSWORD_PURPOSE:
                await AuthService(stale).reset_password(raw_token=grant.raw_token, new_password="second-password-789")
            else:
                await AuthService(stale).verify_email(raw_token=grant.raw_token)
        assert error.value.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize("purpose", [VERIFY_EMAIL_PURPOSE, RESET_PASSWORD_PURPOSE])
async def test_action_token_issuance_rechecks_cached_account_eligibility(
    auth_db: async_sessionmaker[AsyncSession], purpose: str,
) -> None:
    user_id = await seed_auth_user(auth_db, verified=purpose == RESET_PASSWORD_PURPOSE)
    async with auth_db() as stale, auth_db() as other:
        cached_user = await stale.get(User, user_id)
        latest_user = await other.get(User, user_id)
        assert cached_user is not None and latest_user is not None
        if purpose == RESET_PASSWORD_PURPOSE:
            latest_user.status = "disabled"
        else:
            latest_user.email_verified_at = datetime.now(UTC)
        await other.commit()
        service = AuthService(stale)
        if purpose == RESET_PASSWORD_PURPOSE:
            result = await service.request_password_reset(email=cached_user.email)
        else:
            result = await service.issue_verification_token(cached_user)
        assert result is None
        assert not (await stale.scalars(select(AuthToken).where(AuthToken.user_id == user_id))).all()
