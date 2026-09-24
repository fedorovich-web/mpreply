from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import TracebackType
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplacePage
from app.adapters.conversation import (
    ConversationAdapter,
    ConversationMessage,
    ConversationParticipant,
    ConversationThread,
)
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.services.avito_chat_sync_service import AvitoChatSyncService
from app.services.marketplace_ingest_service import IngestStats, MarketplaceIngestService
from app.services.marketplace_sync_state_service import MarketplaceSyncStateService

NOW = datetime(2026, 9, 14, 12, tzinfo=UTC)


class _Transaction:
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None


class _Session:
    def begin(self) -> _Transaction:
        return _Transaction()


class _States:
    async def complete_page(
        self,
        *,
        state_id: object,
        metadata: dict[str, object],
        next_cursor: str | None,
        **_: object,
    ) -> MarketplaceSyncState:
        assert state_id == self.state.id
        self.state.metadata_json = metadata
        self.state.cursor = next_cursor
        return self.state

    def __init__(self, state: MarketplaceSyncState) -> None:
        self.state = state


class _Ingest:
    def __init__(self) -> None:
        self.ingested = False

    async def ingest_page(self, *_: object) -> IngestStats:
        self.ingested = True
        return IngestStats(created_messages=1)


class _Adapter:
    marketplace = "avito"

    def __init__(self, ingest: _Ingest, *, allow_read: bool = True) -> None:
        self.ingest = ingest
        self.allow_read = allow_read
        self.chat_calls = 0
        self.read_calls = 0

    async def fetch_chats(self, *_: object) -> AdapterResult[MarketplacePage[ConversationThread]]:
        self.chat_calls += 1
        if self.chat_calls > 1:
            return AdapterResult(True, MarketplacePage(items=(), next_cursor=None))
        return AdapterResult(
            True,
            MarketplacePage(
                items=(
                    ConversationThread(
                        external_id="chat-123",
                        created_unix=1_723_456_789,
                        updated_unix=1_723_456_790,
                        participants=(ConversationParticipant(external_id="42", name="Synthetic buyer"),),
                        product=None,
                        metadata={"chat_type": "user"},
                    ),
                ),
                next_cursor=None,
            ),
        )

    async def fetch_chat_messages(
        self,
        *_: object,
    ) -> AdapterResult[MarketplacePage[ConversationMessage]]:
        return AdapterResult(
            True,
            MarketplacePage(
                items=(
                    ConversationMessage(
                        external_id="message-123",
                        author_id="42",
                        created_unix=1_723_456_791,
                        direction="in",
                        is_read=False,
                        kind="text",
                        text="Synthetic text",
                    ),
                ),
                next_cursor=None,
            ),
        )

    async def mark_chat_read(self, *_: object) -> AdapterResult[None]:
        assert self.ingest.ingested is True
        self.read_calls += 1
        if not self.allow_read:
            return AdapterResult(False, error_code="network_error")
        return AdapterResult(True)


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="avito",
        seller_id="123456",
        display_name="Synthetic Avito",
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="f" * 64,
        credentials_status="valid",
        scopes_json={"scopes": ["chats:read", "chats:write"]},
    )


def _state(account: MarketplaceAccount) -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream="chats",
        status=SyncStateStatus.LEASED.value,
        cursor=None,
        metadata_json={},
        next_run_at=NOW,
        lease_owner="worker",
        lease_expires_at=NOW + timedelta(minutes=5),
        consecutive_failures=0,
    )


@pytest.mark.asyncio
async def test_avito_sync_commits_inbound_message_before_marking_chat_read() -> None:
    account = _account()
    state = _state(account)
    ingest = _Ingest()
    adapter = _Adapter(ingest)
    result = await AvitoChatSyncService(
        cast(AsyncSession, _Session()),
        adapter=cast(ConversationAdapter, adapter),
        states=cast(MarketplaceSyncStateService, _States(state)),
        ingest=cast(MarketplaceIngestService, ingest),
        clock=lambda: NOW,
    ).sync_batch(
        account=account,
        credential="synthetic-credential",
        state=state,
        owner="worker",
        lease_for=timedelta(minutes=5),
    )

    assert result.completed is True
    assert result.stats.created_messages == 1
    assert adapter.read_calls == 1
    assert "avito_chat_sync" not in result.state.metadata_json


@pytest.mark.asyncio
async def test_avito_read_failure_keeps_durable_message_for_idempotent_retry() -> None:
    account = _account()
    state = _state(account)
    ingest = _Ingest()
    adapter = _Adapter(ingest, allow_read=False)
    result = await AvitoChatSyncService(
        cast(AsyncSession, _Session()),
        adapter=cast(ConversationAdapter, adapter),
        states=cast(MarketplaceSyncStateService, _States(state)),
        ingest=cast(MarketplaceIngestService, ingest),
        clock=lambda: NOW,
    ).sync_batch(
        account=account,
        credential="synthetic-credential",
        state=state,
        owner="worker",
        lease_for=timedelta(minutes=5),
    )

    assert result.error_code == "network_error"
    assert result.stats.created_messages == 1
    assert "avito_chat_sync" not in result.state.metadata_json
