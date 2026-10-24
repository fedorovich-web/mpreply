from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import Update

from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.adapters.registry import MarketplaceAdapterRegistry
from app.adapters.yandex_market import YandexMarketAdapter
from app.core.security import CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_ingest_service import IngestStats
from app.services.scheduled_sync_service import ScheduledSyncService, StreamRunResult
from app.tests.marketplace_fixtures import SequenceTransport, response
from app.tests.test_marketplace_sync_pagination import PaginationSession, pagination_account, pagination_state

NOW = datetime(2026, 1, 1, tzinfo=UTC)


class _Result:
    def __init__(self, rows: list[object]) -> None:
        self.rows = rows

    def scalars(self) -> _Result:
        return self

    def all(self) -> list[object]:
        return self.rows

    def scalar_one_or_none(self) -> object | None:
        return self.rows[0] if self.rows else None


class _ReconciliationSession(PaginationSession):
    state: MarketplaceSyncState
    updates: list[Update]
    message: CustomerMessage

    async def execute(self, statement: object) -> _Result:
        if isinstance(statement, Update):
            self.updates.append(statement)
            return _Result([self.state])
        return _Result([self.message])

    async def commit(self) -> None:
        return None


class _ReconciliationService(ScheduledSyncService):
    async def complete_reconciliation(
        self, state: MarketplaceSyncState, account: MarketplaceAccount, adapter: YandexMarketAdapter,
    ) -> StreamRunResult:
        return await self._complete_cycle(
            state, MarketplaceStream.QUESTIONS, "worker-a", NOW, IngestStats(created_messages=2),
            account=account, adapter=adapter, credential="synthetic-token",
        )


@pytest.mark.parametrize("status,retry_after,expected_error,delay", [(429, "120", "rate_limited", 120), (401, None, "invalid_credentials", None)])
@pytest.mark.asyncio
async def test_failed_yandex_reconciliation_uses_provider_failure_policy(
    status: int, retry_after: str | None, expected_error: str, delay: int | None,
) -> None:
    account = pagination_account()
    account.marketplace = Marketplace.YANDEX_MARKET.value
    account.seller_id = "42"
    state = pagination_state(account)
    state.stream = MarketplaceStream.QUESTIONS.value
    session = _ReconciliationSession(account)
    session.state = state
    session.updates = []
    session.message = CustomerMessage(
        id=uuid4(), external_id="123", marketplace_created_at=NOW,
        type=MessageType.QUESTION.value, status=MessageStatus.NEEDS_REPLY.value, metadata_json={},
    )
    service = _ReconciliationService(
        cast(AsyncSession, session), registry=MarketplaceAdapterRegistry({}),
        credentials=cast(CredentialService, object()), clock=lambda: NOW,
    )
    transport = SequenceTransport([response(status, headers={} if retry_after is None else {"Retry-After": retry_after})])
    async with httpx.AsyncClient(base_url="https://api.partner.market.yandex.ru", transport=transport.mock()) as client:
        result = await service.complete_reconciliation(
            state, account, YandexMarketAdapter(client, read_retry_policy=ReadRetryPolicy(max_attempts=1)),
        )

    assert result.completed is False
    assert result.error_code == expected_error
    assert result.created_messages == 2
    assert len(session.updates) == 1
    params = session.updates[0].compile(dialect=postgresql.dialect()).params
    assert params["next_run_at"] == (None if delay is None else NOW + timedelta(seconds=delay))
    assert params["status"] == ("paused" if delay is None else "error")
    assert "last_success_at" not in params
    assert session.message.status == MessageStatus.NEEDS_REPLY.value
    transport.assert_exhausted()
