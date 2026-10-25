from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.auth import verify_password
from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.models.auth_token import AuthToken
from app.models.user import User
from app.services.auth_service import RESET_PASSWORD_PURPOSE, VERIFY_EMAIL_PURPOSE, AuthService
from app.tests.test_auth_service import seed_auth_user
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits"]


async def wait_for_database_block_or_completion(
    factory: async_sessionmaker[AsyncSession], *, pid: int, finished: Callable[[], bool],
) -> None:
    async with asyncio.timeout(5), factory() as observer:
        while not finished():
            if await observer.scalar(text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": pid}):
                return
            await asyncio.sleep(0.01)


@pytest.mark.asyncio
@pytest.mark.parametrize("purpose", [VERIFY_EMAIL_PURPOSE, RESET_PASSWORD_PURPOSE])
async def test_postgres_action_token_issuance_serializes_cooldown_and_active_token(
    postgres_credits: async_sessionmaker[AsyncSession], purpose: str,
) -> None:
    user_id = await seed_auth_user(postgres_credits, verified=purpose == RESET_PASSWORD_PURPOSE)
    async with postgres_credits() as first, postgres_credits() as second:
        first_user = await first.get(User, user_id)
        second_user = await second.get(User, user_id)
        assert first_user is not None and second_user is not None
        pid = await second.scalar(select(func.pg_backend_pid()))
        assert isinstance(pid, int)
        async def issue(session: AsyncSession, user: User) -> bool:
            service = AuthService(session)
            if purpose == RESET_PASSWORD_PURPOSE:
                result = await service.request_password_reset(email=user.email)
            else:
                result = await service.issue_verification_token(user)
            return result is not None
        assert await issue(first, first_user)
        async def finish_second() -> bool:
            issued = await issue(second, second_user)
            await second.commit()
            return issued
        task = asyncio.create_task(finish_second())
        try:
            await wait_for_database_block_or_completion(postgres_credits, pid=pid, finished=task.done)
            await first.commit()
            async with asyncio.timeout(5):
                assert not await task
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    async with postgres_credits() as session:
        active = (await session.scalars(select(AuthToken).where(AuthToken.user_id == user_id, AuthToken.consumed_at.is_(None)))).all()
        assert len(active) == 1


@pytest.mark.asyncio
async def test_postgres_concurrent_password_changes_accept_old_password_only_once(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    user_id = await seed_auth_user(postgres_credits)
    async with postgres_credits() as first, postgres_credits() as second:
        first_user = await first.get(User, user_id)
        second_user = await second.get(User, user_id)
        assert first_user is not None and second_user is not None
        pid = await second.scalar(select(func.pg_backend_pid()))
        assert isinstance(pid, int)
        await AuthService(first).change_password(user=first_user, current_password="original-password-123", new_password="first-password-456")
        async def finish_second() -> bool:
            try:
                await AuthService(second).change_password(user=second_user, current_password="original-password-123", new_password="second-password-789")
            except HTTPException as error:
                assert error.status_code == 400
                await second.rollback()
                return False
            await second.commit()
            return True
        task = asyncio.create_task(finish_second())
        try:
            await wait_for_database_block_or_completion(postgres_credits, pid=pid, finished=task.done)
            await first.commit()
            async with asyncio.timeout(5):
                assert not await task
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
    async with postgres_credits() as session:
        user = await session.get(User, user_id)
        assert user is not None and user.password_hash is not None and user.auth_version == 1
        assert verify_password("first-password-456", user.password_hash)


@pytest.mark.asyncio
async def test_postgres_distinct_reset_tokens_serialize_without_deadlock_and_grant_once(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    user_id = await seed_auth_user(postgres_credits)
    tokens = [new_auth_token(), new_auth_token()]
    async with postgres_credits() as session:
        session.add_all([AuthToken(user_id=user_id, purpose=RESET_PASSWORD_PURPOSE, token_digest=digest_auth_token(token),
                                   expires_at=datetime.now(UTC) + timedelta(minutes=30)) for token in tokens])
        await session.commit()
    barrier = asyncio.Barrier(2)
    class SynchronizedAuthService(AuthService):
        async def _get_user(self, user_id: UUID) -> User:
            await barrier.wait()
            return await super()._get_user(user_id)
    async def reset(token: str) -> bool:
        async with postgres_credits() as session:
            try:
                await SynchronizedAuthService(session).reset_password(raw_token=token, new_password="reset-password-456")
            except HTTPException as error:
                assert error.status_code == 400
                await session.rollback()
                return False
            await session.commit()
            return True
    async with asyncio.timeout(8):
        outcomes = await asyncio.gather(*(reset(token) for token in tokens))
    assert sorted(outcomes) == [False, True]
    async with postgres_credits() as session:
        user = await session.get(User, user_id)
        assert user is not None and user.password_hash is not None and user.auth_version == 1
        assert verify_password("reset-password-456", user.password_hash)
        assert not (await session.scalars(select(AuthToken).where(AuthToken.user_id == user_id, AuthToken.consumed_at.is_(None)))).all()
