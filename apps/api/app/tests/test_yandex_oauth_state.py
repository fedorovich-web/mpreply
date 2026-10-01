from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.providers.yandex_id import YandexIDError
from app.services.oauth_state_service import OAuthStateService, safe_next_path
from app.tests.test_reply_credits import credit_session_factory
from app.tests.test_yandex_id_client import yandex_settings


@pytest.fixture
async def state_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.mark.parametrize("path", ["https://evil.example", "//evil.example", "/app/../../evil", "/app/\\evil", "/app/%2e%2e/evil", "/other"])
def test_external_or_traversal_next_falls_back_to_local_dashboard(path: str) -> None:
    assert safe_next_path(path, locale="ru", intent=None) == "/app/dashboard"


def test_locale_and_marketplace_intent_have_fixed_local_targets() -> None:
    assert safe_next_path(None, locale="en", intent="connect-marketplace") == "/en/app/integrations"
    assert safe_next_path("/en/app/billing", locale="en", intent=None) == "/en/app/billing"


@pytest.mark.asyncio
async def test_state_is_browser_bound_and_one_use(state_db: async_sessionmaker[AsyncSession]) -> None:
    settings = yandex_settings()
    async with state_db() as session:
        service = OAuthStateService(session, settings=settings)
        grant = await service.issue(browser_token="browser-token", mode="login", user=None, locale="ru", next_path="/app/billing", intent=None)
        assert "browser-token" not in grant.state and len(grant.state) >= 40
        with pytest.raises(YandexIDError):
            await service.consume(state=grant.state, browser_token="different-browser", now=datetime.now(UTC))
        attempt = await service.consume(state=grant.state, browser_token="browser-token", now=datetime.now(UTC))
        assert attempt.next_path == "/app/billing" and len(attempt.code_verifier) >= 43
        assert attempt.code_verifier not in repr(attempt)
        with pytest.raises(YandexIDError):
            await service.consume(state=grant.state, browser_token="browser-token", now=datetime.now(UTC))


@pytest.mark.asyncio
async def test_expired_state_does_not_allow_exchange(state_db: async_sessionmaker[AsyncSession]) -> None:
    async with state_db() as session:
        service = OAuthStateService(session, settings=yandex_settings())
        grant = await service.issue(browser_token="browser-token", mode="login", user=None, locale="ru", next_path=None, intent=None)
        with pytest.raises(YandexIDError) as failure:
            await service.consume(state=grant.state, browser_token="browser-token", now=datetime.now(UTC) + timedelta(minutes=11))
        assert failure.value.code == "oauth_expired"
