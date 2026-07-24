from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.marketplace_scheduler_service as scheduler_module
import app.services.scheduled_sync_service as scheduled_sync_module
from app.adapters.base import MarketplaceOperation
from app.adapters.capabilities import MarketplaceCapability
from app.models.enums import Marketplace, MarketplaceSyncStateStatus, MarketplaceSyncStream, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_scheduler_service import MarketplaceSchedulerService
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def all(self) -> list[object]:
        return self._values


class _Result:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def scalars(self) -> _Scalars:
        return _Scalars(self._values)


class _FakeSession:
    def __init__(self, values: list[object] | None = None) -> None:
        self.values = values or []
        self.added: list[object] = []
        self.flush_count = 0

    async def execute(self, _statement: object) -> _Result:
        return _Result(self.values)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


class _ScheduledResult:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount]) -> None:
        self._row = row

    def first(self) -> tuple[MarketplaceSyncState, MarketplaceAccount]:
        return self._row


class _ScheduledSession:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount]) -> None:
        self.row = row
        self.flush_count = 0

    async def execute(self, _statement: object) -> _ScheduledResult:
        return _ScheduledResult(self.row)

    async def flush(self) -> None:
        self.flush_count += 1


def _account(marketplace: Marketplace = Marketplace.OZON) -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=marketplace.value,
        display_name="Test account",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        status="active",
        credentials_status="valid",
        scopes_json={},
        default_response_mode="inherit",
        error_count=0,
    )


def _capability(*operations: str) -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=cast(tuple[MarketplaceOperation, ...], operations),
        message_types=(MessageType.REVIEW,),
        polling_enabled=True,
        pagination_strategy="page_token",
        notes="test fixture",
    )


@pytest.mark.parametrize(
    ("operations", "expected"),
    [
        (("validate", "fetch_reviews"), (MarketplaceSyncStream.REVIEWS,)),
        (("validate", "fetch_questions"), (MarketplaceSyncStream.QUESTIONS,)),
        (
            ("validate", "fetch_reviews", "fetch_questions"),
            (MarketplaceSyncStream.REVIEWS, MarketplaceSyncStream.QUESTIONS),
        ),
        (("validate",), ()),
    ],
)
def test_capability_derives_sync_streams_from_operations(
    operations: tuple[str, ...],
    expected: tuple[MarketplaceSyncStream, ...],
) -> None:
    capability = _capability(*operations)

    assert capability.sync_streams == expected
    assert capability.scheduler_enabled is bool(expected)


@pytest.mark.asyncio
async def test_scheduler_creates_only_capability_supported_streams(monkeypatch: pytest.MonkeyPatch) -> None:
    capability = _capability("validate", "fetch_reviews")

    def get_capability(_marketplace: Marketplace | str) -> MarketplaceCapability:
        return capability

    monkeypatch.setattr(scheduler_module, "get_marketplace_capability", get_capability)
    session = _FakeSession()
    service = MarketplaceSchedulerService(cast(AsyncSession, session))
    now = datetime(2026, 7, 24, 12, 0, tzinfo=UTC)

    states = await service.ensure_account_states(account=_account(), activate=True, now=now)

    assert [state.stream for state in states] == [MarketplaceSyncStream.REVIEWS.value]
    assert states[0].status == MarketplaceSyncStateStatus.IDLE.value
    assert states[0].next_run_at == now
    assert session.added == states
    assert session.flush_count == 1


@pytest.mark.asyncio
async def test_scheduled_execution_pauses_stream_removed_from_capability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    capability = _capability("validate", "fetch_reviews")

    def get_capability(_marketplace: Marketplace | str) -> MarketplaceCapability:
        return capability

    monkeypatch.setattr(scheduled_sync_module, "get_marketplace_capability", get_capability)
    account = _account()
    lease_token = uuid4()
    state = MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream=MarketplaceSyncStream.QUESTIONS.value,
        status=MarketplaceSyncStateStatus.LEASED.value,
        next_run_at=datetime(2026, 7, 24, 12, 0, tzinfo=UTC),
        lease_token=lease_token,
        lease_expires_at=datetime.now(UTC) + timedelta(minutes=5),
        consecutive_failures=0,
        metadata_json={},
    )
    session = _ScheduledSession((state, account))
    service = object.__new__(ScheduledMarketplaceSyncService)
    service.session = cast(AsyncSession, session)

    result = await service.execute(state_id=state.id, lease_token=lease_token)

    assert result.status == "paused"
    assert state.status == MarketplaceSyncStateStatus.PAUSED.value
    assert state.next_run_at is None
    assert state.lease_token is None
    assert state.lease_expires_at is None
    assert session.flush_count == 1
