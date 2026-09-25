from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.scheduled_sync_service as scheduled_module
from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.capabilities import MarketplaceCapability
from app.adapters.ozon import OzonAdapter
from app.core.config import Settings
from app.core.security import CredentialService
from app.models.enums import Marketplace, MarketplaceSyncStateStatus, MarketplaceSyncStream, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.audit_service import AuditService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService, ScheduledSyncResult


class _Result:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount]) -> None:
        self._row = row

    def first(self) -> tuple[MarketplaceSyncState, MarketplaceAccount]:
        return self._row


class _Session:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount]) -> None:
        self._row = row
        self.added: list[object] = []

    async def execute(self, _statement: object) -> _Result:
        return _Result(self._row)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        return None


class _Audit:
    async def write(self, **_kwargs: object) -> None:
        return None


class _Credentials:
    def decrypt(self, _value: str) -> str:
        return "synthetic-api-key"


class _Ingest:
    async def upsert_normalized_message(
        self,
        _account: MarketplaceAccount,
        _normalized: dict[str, object],
    ) -> str:
        return "skipped"


class _OzonPages(OzonAdapter):
    def __init__(self, cursors: list[str | None]) -> None:
        super().__init__()
        self._cursors = list(cursors)
        self.calls: list[str | None] = []

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        del credential, seller_id
        self.calls.append(cursor)
        return AdapterResult(ok=True, data={"reviews": []}, next_cursor=self._cursors.pop(0))


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.OZON.value,
        display_name="Ozon test",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        status="active",
        credentials_status="valid",
        scopes_json={
            "validated": True,
            "scopes": ["fetch_reviews", "send_review_reply"],
        },
        default_response_mode="inherit",
        error_count=0,
    )


def _state(account: MarketplaceAccount) -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream=MarketplaceSyncStream.REVIEWS.value,
        status=MarketplaceSyncStateStatus.LEASED.value,
        consecutive_failures=0,
        metadata_json={},
    )


def _reviews_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=("validate", "fetch_reviews"),
        message_types=(MessageType.REVIEW,),
        polling_enabled=True,
        pagination_strategy="page_token",
        notes="test fixture",
    )


def _service(state: MarketplaceSyncState, account: MarketplaceAccount) -> ScheduledMarketplaceSyncService:
    service = object.__new__(ScheduledMarketplaceSyncService)
    service.session = cast(AsyncSession, _Session((state, account)))
    service.audit = cast(AuditService, _Audit())
    service.ingest = cast(MarketplaceMessageIngestService, _Ingest())
    service.settings = cast(Settings, SimpleNamespace(marketplace_sync_interval_seconds=300))
    service.credentials = cast(CredentialService, _Credentials())
    return service


async def _execute_page(
    service: ScheduledMarketplaceSyncService,
    state: MarketplaceSyncState,
) -> ScheduledSyncResult:
    lease_token = uuid4()
    state.status = MarketplaceSyncStateStatus.LEASED.value
    state.lease_token = lease_token
    state.lease_expires_at = datetime.now(UTC) + timedelta(minutes=5)
    return await service.execute(state_id=state.id, lease_token=lease_token)


def _get_reviews_capability(_marketplace: Marketplace | str) -> MarketplaceCapability:
    return _reviews_capability()


def _adapter_lookup(adapter: MarketplaceAdapter) -> Callable[[Marketplace | str], MarketplaceAdapter]:
    def get_adapter(_marketplace: Marketplace | str) -> MarketplaceAdapter:
        return adapter

    return get_adapter


@pytest.mark.asyncio
async def test_scheduled_ozon_sync_pauses_on_a_to_b_to_a_cursor_cycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    state = _state(account)
    adapter = _OzonPages(["A", "B", "A"])
    service = _service(state, account)
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _get_reviews_capability)
    monkeypatch.setattr(scheduled_module, "get_marketplace_adapter", _adapter_lookup(adapter))

    first = await _execute_page(service, state)
    assert state.metadata_json["ozon_pagination"] == {
        "schema_version": 1,
        "page_count": 1,
        "seen_cursors": ["A"],
    }
    second = await _execute_page(service, state)
    assert state.metadata_json["ozon_pagination"] == {
        "schema_version": 1,
        "page_count": 2,
        "seen_cursors": ["A", "B"],
    }
    third = await _execute_page(service, state)

    assert first.status == "success"
    assert second.status == "success"
    assert third.status == "paused"
    assert third.error_code == "sync_cursor_cycle"
    assert adapter.calls == [None, "A", "B"]
    assert state.status == MarketplaceSyncStateStatus.PAUSED.value
    assert state.next_run_at is None
    assert state.cycle_started_at is None
    assert "ozon_pagination" not in state.metadata_json


@pytest.mark.asyncio
async def test_scheduled_ozon_sync_pauses_when_advancing_cursors_exceed_persisted_page_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    state = _state(account)
    adapter = _OzonPages(["A", "B"])
    service = _service(state, account)
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _get_reviews_capability)
    monkeypatch.setattr(scheduled_module, "get_marketplace_adapter", _adapter_lookup(adapter))
    monkeypatch.setattr(scheduled_module, "_OZON_SCHEDULED_PAGE_LIMIT", 2)

    first = await _execute_page(service, state)
    second = await _execute_page(service, state)

    assert first.status == "success"
    assert second.status == "paused"
    assert second.error_code == "sync_page_limit_exceeded"
    assert adapter.calls == [None, "A"]


@pytest.mark.asyncio
async def test_scheduled_ozon_sync_allows_limit_page_only_when_it_completes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    state = _state(account)
    adapter = _OzonPages(["A", None])
    service = _service(state, account)
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _get_reviews_capability)
    monkeypatch.setattr(scheduled_module, "get_marketplace_adapter", _adapter_lookup(adapter))
    monkeypatch.setattr(scheduled_module, "_OZON_SCHEDULED_PAGE_LIMIT", 2)

    first = await _execute_page(service, state)
    second = await _execute_page(service, state)

    assert first.status == "success"
    assert second.status == "success"
    assert adapter.calls == [None, "A"]


@pytest.mark.asyncio
async def test_scheduled_ozon_sync_clears_tracking_when_a_cycle_completes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    state = _state(account)
    adapter = _OzonPages([None])
    service = _service(state, account)
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _get_reviews_capability)
    monkeypatch.setattr(scheduled_module, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await _execute_page(service, state)

    assert result.status == "success"
    assert state.cursor is None
    assert state.cycle_started_at is None
    assert "ozon_pagination" not in state.metadata_json
