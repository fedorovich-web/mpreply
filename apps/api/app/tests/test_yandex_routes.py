from collections.abc import AsyncIterator
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.yandex_auth import router
from app.core.auth import create_access_token
from app.core.config import Settings
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.auth_identity import AuthIdentity
from app.models.auth_session import AuthSession
from app.models.user import User
from app.providers.yandex_id import YandexProfile
from app.tests.test_reply_credits import credit_session_factory
from app.tests.test_yandex_id_client import yandex_settings


def database_dependency(factory: async_sessionmaker[AsyncSession]):
    async def dependency() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session
    return dependency


def user_dependency(user: User):
    async def dependency() -> User:
        return user
    return dependency


@pytest.mark.asyncio
async def test_disabled_provider_is_not_advertised(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: Settings.model_validate({"yandex_oauth_enabled": False}))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as http:
        assert (await http.get("/api/auth/providers")).json() == {"yandex": False}


@pytest.mark.asyncio
async def test_existing_email_pending_link_completes_only_after_matching_account_authentication(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    settings = yandex_settings(auth_cookie_secure=True)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: settings)
    async def profile(_self: object, *, code: str, code_verifier: str) -> YandexProfile:
        return YandexProfile("pending-subject", settings.yandex_oauth_client_id, "existing@example.com", None)
    monkeypatch.setattr("app.api.yandex_auth.YandexIDClient.exchange_and_profile", profile)
    async for factory in credit_session_factory():
        app.dependency_overrides[get_db_session] = database_dependency(factory)
        async with factory() as session:
            owner = User(email="existing@example.com", password_hash="synthetic", status="active", email_verified_at=datetime.now(UTC), auth_version=0)
            other = User(email="other@example.com", password_hash="synthetic", status="active", email_verified_at=datetime.now(UTC), auth_version=0)
            session.add_all([owner, other])
            await session.commit()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://api.mpreply.ru") as http:
            start = await http.get("/api/auth/yandex/start")
            state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]
            callback = await http.get("/api/auth/yandex/callback", params={"state": state, "code": "synthetic"})
            assert "account_link_required" in callback.headers["location"]
            assert "mpreply_yandex_pending" in http.cookies
            assert "pending-subject" not in str(callback.headers) and "existing@example.com" not in str(callback.headers)
            async with factory() as session:
                assert await session.scalar(select(func.count()).select_from(AuthIdentity)) == 0
            app.dependency_overrides[get_current_user] = user_dependency(other)
            assert (await http.post("/api/auth/yandex/link/complete")).status_code == 409
            app.dependency_overrides[get_current_user] = user_dependency(owner)
            result = await http.post("/api/auth/yandex/link/complete")
            assert result.status_code == 200
            assert "mpreply_yandex_pending" not in http.cookies
            async with factory() as session:
                identity = await session.scalar(select(AuthIdentity))
                assert identity is not None and identity.user_id == owner.id and identity.subject == "pending-subject"


@pytest.mark.asyncio
async def test_existing_authenticated_owner_links_in_callback_without_password_detour(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    settings = yandex_settings(auth_cookie_secure=True)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: settings)
    monkeypatch.setattr("app.core.cookies.get_settings", lambda: settings)
    monkeypatch.setattr("app.core.auth.get_settings", lambda: settings)
    async for factory in credit_session_factory():
        app.dependency_overrides[get_db_session] = database_dependency(factory)
        async with factory() as session:
            owner = User(email="owner@example.com", password_hash="synthetic", status="active", email_verified_at=datetime.now(UTC), auth_version=0)
            session.add(owner)
            await session.commit()
        async def profile(_self: object, *, code: str, code_verifier: str) -> YandexProfile:
            return YandexProfile("authenticated-subject", settings.yandex_oauth_client_id, "owner@example.com", None)
        monkeypatch.setattr("app.api.yandex_auth.YandexIDClient.exchange_and_profile", profile)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://api.mpreply.ru") as http:
            http.cookies.set("respio_access", create_access_token(user_id=owner.id, auth_version=0), domain="api.mpreply.ru", path="/")
            start = await http.get("/api/auth/yandex/start")
            state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]
            result = await http.get("/api/auth/yandex/callback", params={"state": state, "code": "synthetic"})
            assert result.headers["location"] == "https://app.mpreply.ru/app/dashboard"
            assert "mpreply_yandex_pending" not in http.cookies
        async with factory() as session:
            identity = await session.scalar(select(AuthIdentity))
            assert identity is not None and identity.user_id == owner.id


@pytest.mark.asyncio
async def test_callback_without_browser_binding_redirects_to_safe_error(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    settings = yandex_settings()
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: settings)
    async for factory in credit_session_factory():
        async def database(db_factory: async_sessionmaker[AsyncSession] = factory) -> AsyncIterator[AsyncSession]:
            async with db_factory() as session:
                yield session
        async def dependency() -> AsyncIterator[AsyncSession]:
            async for session in database():
                yield session
        app.dependency_overrides[get_db_session] = dependency
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://api.mpreply.ru") as http:
            result = await http.get("/api/auth/yandex/callback?state=other&code=secret-code")
        assert result.status_code == 303
        assert result.headers["location"] == "https://app.mpreply.ru/auth/login?oauth_error=oauth_expired"
        assert "secret-code" not in str(result.headers)


@pytest.mark.asyncio
async def test_complete_callback_issues_cookie_session_once(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    settings = yandex_settings(auth_cookie_secure=True)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: settings)
    monkeypatch.setattr("app.core.cookies.get_settings", lambda: settings)
    calls = 0
    async def profile(_self: object, *, code: str, code_verifier: str) -> YandexProfile:
        nonlocal calls
        calls += 1
        assert code == "synthetic-code" and len(code_verifier) >= 43
        return YandexProfile("callback-subject", settings.yandex_oauth_client_id, "callback@example.com", "Buyer")
    monkeypatch.setattr("app.api.yandex_auth.YandexIDClient.exchange_and_profile", profile)
    async for factory in credit_session_factory():
        app.dependency_overrides[get_db_session] = database_dependency(factory)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://api.mpreply.ru") as http:
            start = await http.get("/api/auth/yandex/start?locale=en&next=/en/app/integrations&intent=connect-marketplace")
            state = parse_qs(urlsplit(start.headers["location"]).query)["state"][0]
            saved_browser = http.cookies.get("mpreply_yandex_state")
            assert saved_browser is not None
            callback = await http.get("/api/auth/yandex/callback", params={"state": state, "code": "synthetic-code"})
            assert callback.status_code == 303
            assert callback.headers["location"] == "https://app.mpreply.ru/en/app/integrations"
            cookies = callback.headers.get_list("set-cookie")
            assert any("respio_access=" in value and "HttpOnly" in value and "Secure" in value for value in cookies)
            assert any("respio_refresh=" in value and "Path=/api/auth" in value for value in cookies)
            assert "synthetic-code" not in str(callback.headers)
            assert callback.headers["Cache-Control"] == "no-store"
            http.cookies.set("mpreply_yandex_state", saved_browser, domain="api.mpreply.ru", path="/api/auth/yandex")
            replay = await http.get("/api/auth/yandex/callback", params={"state": state, "code": "synthetic-code"})
            assert "oauth_expired" in replay.headers["location"]
        assert calls == 1
        async with factory() as session:
            assert await session.scalar(select(func.count()).select_from(AuthIdentity)) == 1
            assert await session.scalar(select(func.count()).select_from(AuthSession)) == 1
