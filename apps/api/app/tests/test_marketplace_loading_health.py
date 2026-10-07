from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_account_service import MarketplaceAccountService
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits import credit_session_factory

__all__ = ["synthetic_encryption_key"]


@pytest.fixture
async def health_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.mark.parametrize("limited", [False, True])
async def test_account_health_uses_scheduler_streams_instead_of_stale_manual_error(
    health_db: async_sessionmaker[AsyncSession], limited: bool,
) -> None:
    async with health_db() as session:
        message = await seed(session)
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert account is not None
        now = datetime.now(UTC)
        account.last_error_sync_at = now - timedelta(days=1)
        for stream in ("reviews", "questions"):
            session.add(MarketplaceSyncState(
                organization_id=account.organization_id, marketplace_account_id=account.id, stream=stream,
                status="error" if limited and stream == "questions" else "idle",
                last_error_code="rate_limited" if limited and stream == "questions" else None,
                last_attempt_at=now, last_success_at=now - timedelta(minutes=5),
                next_run_at=now + timedelta(minutes=10),
            ))
        await session.commit()
        response = await MarketplaceAccountService(session).to_response(account)
        assert response.last_success_sync_at is not None
        assert response.last_success_sync_at.replace(tzinfo=UTC) == now - timedelta(minutes=5)
        assert response.sync_error_code == ("rate_limited" if limited else None)
        if limited:
            assert response.last_error_sync_at is not None and response.last_error_sync_at.replace(tzinfo=UTC) == now
            assert response.sync_next_retry_at is not None
        else:
            assert response.last_error_sync_at is not None
            assert response.last_error_sync_at < response.last_success_sync_at
