from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.yandex_auth import router
from app.core.config import Settings
from app.db.session import get_db_session
from app.models.auth_identity import AuthIdentity
from app.models.auth_session import AuthSession
from app.providers.yandex_id import YandexProfile
from app.tests.test_reply_credits import credit_session_factory
from app.tests.test_yandex_id_client import yandex_settings


def database_dependency(factory: async_sessionmaker[AsyncSession]):
    async def dependency() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session
    return dependency


@pytest.mark.asyncio
async def test_disabled_provider_is_not_advertised(monkeypatch: pytest.MonkeyPatch) -> None:
    app = FastAPI()
    app.include_router(router)
    monkeypatch.setattr("app.api.yandex_auth.get_settings", lambda: Settings.model_validate({"yandex_oauth_enabled": False}))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as http:
        assert (await http.get("/api/auth/providers")).json() == {"yandex": False}


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
        # Signature-free dependency wrapper avoids exposing a factory as a query field.
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
