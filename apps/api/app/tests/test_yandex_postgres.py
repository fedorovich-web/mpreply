from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.auth_identity import AuthIdentity
from app.models.oauth_state import OAuthState
from app.models.user import User
from app.providers.yandex_id import YandexIDError, YandexProfile
from app.services.oauth_state_service import OAuthStateService
from app.services.yandex_auth_service import YandexAuthService
from app.tests.test_billing_orders_postgres import billing_db
from app.tests.test_yandex_auth import attempt
from app.tests.test_yandex_id_client import yandex_settings

identity_pg_db = billing_db


@pytest.mark.asyncio
async def test_concurrent_state_consumption_allows_only_one_exchange(identity_pg_db: async_sessionmaker[AsyncSession]) -> None:
    settings, browser = yandex_settings(), str(uuid4())
    async with identity_pg_db() as session:
        grant = await OAuthStateService(session, settings=settings).issue(browser_token=browser, mode="login", user=None,
                                                                          locale="ru", next_path="/app/dashboard", intent=None)
    async def consume() -> bool:
        async with identity_pg_db() as session:
            try:
                await OAuthStateService(session, settings=settings).consume(state=grant.state, browser_token=browser, now=datetime.now(UTC))
                return True
            except YandexIDError:
                await session.rollback()
                return False
    assert sum(await asyncio.gather(*(consume() for _ in range(20)))) == 1
    async with identity_pg_db() as session:
        count = await session.scalar(select(func.count()).select_from(OAuthState).where(OAuthState.verifier_encrypted == ""))
        assert count is not None and count >= 1


@pytest.mark.asyncio
async def test_concurrent_registration_creates_one_identity_and_user(identity_pg_db: async_sessionmaker[AsyncSession]) -> None:
    subject, email = str(uuid4()), f"{uuid4()}@example.com"
    async def register() -> object:
        async with identity_pg_db() as session:
            user = await YandexAuthService(session).resolve(profile=YandexProfile(subject, "client", email, "Buyer"), attempt=attempt(), now=datetime.now(UTC))
            await session.commit()
            return user.id
    users = await asyncio.gather(*(register() for _ in range(20)))
    assert len(set(users)) == 1
    async with identity_pg_db() as session:
        assert await session.scalar(select(func.count()).select_from(User).where(User.email == email)) == 1
        assert await session.scalar(select(func.count()).select_from(AuthIdentity).where(AuthIdentity.subject == subject)) == 1
        user = await session.get(User, users[0])
        assert user is not None and user.password_hash is None
        user.password_hash = "synthetic-test-downgrade-placeholder"
        await session.commit()


@pytest.mark.asyncio
async def test_registration_race_after_identity_lookup_still_reuses_same_subject(
    identity_pg_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    subject, email = str(uuid4()), f"{uuid4()}@example.com"
    original = cast(Callable[[YandexAuthService, str], Awaitable[User | None]], vars(YandexAuthService)["_identity_user"])
    looked_up, release = asyncio.Event(), asyncio.Event()
    first = True
    async def paused_lookup(self: YandexAuthService, value: str) -> User | None:
        nonlocal first
        user = await original(self, value)
        if first:
            first = False
            looked_up.set()
            await release.wait()
        return user
    monkeypatch.setattr(YandexAuthService, "_identity_user", paused_lookup)
    async def register() -> object:
        async with identity_pg_db() as session:
            user = await YandexAuthService(session).resolve(profile=YandexProfile(subject, "client", email, None), attempt=attempt(), now=datetime.now(UTC))
            await session.commit()
            return user.id
    pending = asyncio.create_task(register())
    await asyncio.wait_for(looked_up.wait(), timeout=5)
    try:
        winner = await register()
    finally:
        release.set()
    try:
        assert await pending == winner
    finally:
        async with identity_pg_db() as session:
            user = await session.get(User, winner)
            assert user is not None
            user.password_hash = "synthetic-test-downgrade-placeholder"
            await session.commit()
