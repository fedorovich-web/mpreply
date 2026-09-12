from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Table, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import Update

import app.models
from app.adapters.capabilities import MarketplaceStream
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.services.marketplace_sync_state_service import LeaseOwnershipError, MarketplaceSyncStateService

NOW = datetime(2026, 9, 12, 12, 0, tzinfo=UTC)


class _ScalarResult:
    def __init__(self, value: MarketplaceSyncState | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> MarketplaceSyncState | None:
        return self._value


class _RecordingSession:
    def __init__(self, results: list[MarketplaceSyncState | None]) -> None:
        self._results = list(results)
        self.statements: list[Update] = []

    async def execute(self, statement: Update) -> _ScalarResult:
        self.statements.append(statement)
        return _ScalarResult(self._results.pop(0))


def _state(*, owner: str = "worker-a") -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        stream=MarketplaceStream.REVIEWS.value,
        status=SyncStateStatus.LEASED.value,
        cursor=None,
        metadata_json={},
        next_run_at=NOW,
        lease_owner=owner,
        lease_expires_at=NOW + timedelta(minutes=2),
        consecutive_failures=0,
    )


def _compiled(statement: Update) -> tuple[str, dict[str, object]]:
    compiled = statement.compile(dialect=postgresql.dialect())
    return str(compiled), cast(dict[str, object], compiled.params)


def test_sync_state_schema_enforces_closed_stream_status_and_lease_shape() -> None:
    table = cast(Table, MarketplaceSyncState.__table__)
    constraint_names = {constraint.name for constraint in table.constraints}

    assert app.models.MarketplaceSyncState is MarketplaceSyncState
    assert "uq_marketplace_sync_states_account_stream" in constraint_names
    assert "ck_marketplace_sync_states_stream" in constraint_names
    assert "ck_marketplace_sync_states_status" in constraint_names
    assert "ck_marketplace_sync_states_failures_nonnegative" in constraint_names
    assert "ck_marketplace_sync_states_lease_shape" in constraint_names
    assert "fk_marketplace_sync_states_account_tenant" in constraint_names
    assert sum(isinstance(constraint, UniqueConstraint) for constraint in table.constraints) == 1
    assert sum(isinstance(constraint, CheckConstraint) for constraint in table.constraints) == 4
    tenant_fk = next(
        constraint
        for constraint in table.constraints
        if isinstance(constraint, ForeignKeyConstraint) and constraint.name == "fk_marketplace_sync_states_account_tenant"
    )
    assert set(tenant_fk.column_keys) == {"marketplace_account_id", "organization_id"}
    account_table = cast(Table, MarketplaceAccount.__table__)
    assert any(
        isinstance(constraint, UniqueConstraint) and constraint.name == "uq_marketplace_accounts_id_organization_id" for constraint in account_table.constraints
    )
    assert set(table.c.keys()) >= {
        "organization_id",
        "marketplace_account_id",
        "stream",
        "status",
        "cursor",
        "metadata_json",
        "next_run_at",
        "lease_owner",
        "lease_expires_at",
        "consecutive_failures",
        "last_error_code",
        "last_attempt_at",
        "last_success_at",
    }


@pytest.mark.asyncio
async def test_acquire_is_atomic_and_allows_only_unleased_or_expired_state() -> None:
    acquired = _state()
    session = _RecordingSession([acquired])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))

    result = await service.acquire(
        state_id=acquired.id,
        owner="worker-a",
        now=NOW,
        lease_for=timedelta(minutes=2),
    )

    sql, params = _compiled(session.statements[0])
    assert result is acquired
    assert "UPDATE marketplace_sync_states" in sql
    assert "marketplace_sync_states.status IN" in sql
    assert "marketplace_sync_states.lease_expires_at <=" in sql
    assert "RETURNING" in sql
    assert "worker-a" in params.values()
    assert [SyncStateStatus.IDLE.value, SyncStateStatus.ERROR.value] in params.values()
    assert SyncStateStatus.LEASED.value in params.values()
    assert NOW + timedelta(minutes=2) in params.values()


@pytest.mark.asyncio
async def test_complete_page_rejects_stale_owner_and_guards_current_cursor() -> None:
    session = _RecordingSession([None])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))
    state_id = uuid4()

    with pytest.raises(LeaseOwnershipError):
        await service.complete_page(
            state_id=state_id,
            owner="stale-worker",
            current_cursor="page-1",
            next_cursor="page-2",
            metadata={"phase": "incremental"},
            now=NOW,
            lease_for=timedelta(minutes=2),
        )

    sql, params = _compiled(session.statements[0])
    assert "marketplace_sync_states.lease_owner =" in sql
    assert "marketplace_sync_states.cursor =" in sql
    assert "marketplace_sync_states.status =" in sql
    assert "stale-worker" in params.values()
    assert "page-1" in params.values()
    assert "page-2" in params.values()


@pytest.mark.asyncio
async def test_renew_requires_live_lease_owned_by_caller() -> None:
    session = _RecordingSession([None])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))

    with pytest.raises(LeaseOwnershipError):
        await service.renew(uuid4(), owner="worker-a", now=NOW, lease_for=timedelta(minutes=1))

    sql, _ = _compiled(session.statements[0])
    assert "marketplace_sync_states.lease_expires_at >" in sql
    assert "marketplace_sync_states.lease_owner =" in sql


@pytest.mark.asyncio
async def test_release_clears_lease_and_schedules_next_run() -> None:
    released = _state(owner="worker-a")
    session = _RecordingSession([released])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))
    next_run = NOW + timedelta(minutes=5)

    result = await service.release(
        released.id,
        owner="worker-a",
        now=NOW,
        next_run_at=next_run,
    )

    _, params = _compiled(session.statements[0])
    assert result is released
    assert SyncStateStatus.IDLE.value in params.values()
    assert next_run in params.values()
    assert NOW in params.values()
    assert None in params.values()


@pytest.mark.asyncio
async def test_failure_clears_lease_and_increments_failure_count_in_database() -> None:
    failed = _state(owner="worker-a")
    session = _RecordingSession([failed])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))

    result = await service.fail(
        failed.id,
        owner="worker-a",
        error_code="marketplace_unavailable",
        next_run_at=NOW + timedelta(minutes=1),
        pause=False,
    )

    sql, params = _compiled(session.statements[0])
    assert result is failed
    assert "consecutive_failures=(marketplace_sync_states.consecutive_failures +" in sql
    assert SyncStateStatus.ERROR.value in params.values()
    assert "marketplace_unavailable" in params.values()


@pytest.mark.asyncio
async def test_retryable_failure_requires_an_aware_next_run() -> None:
    service = MarketplaceSyncStateService(cast(AsyncSession, _RecordingSession([])))

    with pytest.raises(ValueError, match="next run"):
        await service.fail(
            UUID(int=1),
            owner="worker-a",
            error_code="network_timeout",
            next_run_at=None,
            pause=False,
        )

    with pytest.raises(ValueError, match="timezone-aware"):
        await service.fail(
            UUID(int=1),
            owner="worker-a",
            error_code="network_timeout",
            next_run_at=NOW.replace(tzinfo=None),
            pause=False,
        )


@pytest.mark.asyncio
async def test_paused_failure_is_never_scheduled() -> None:
    paused = _state(owner="worker-a")
    session = _RecordingSession([paused])
    service = MarketplaceSyncStateService(cast(AsyncSession, session))

    result = await service.fail(
        paused.id,
        owner="worker-a",
        error_code="invalid_credentials",
        next_run_at=NOW + timedelta(days=1),
        pause=True,
    )

    _, params = _compiled(session.statements[0])
    assert result is paused
    assert SyncStateStatus.PAUSED.value in params.values()
    assert NOW + timedelta(days=1) not in params.values()
    assert None in params.values()


@pytest.mark.parametrize("now", [NOW.replace(tzinfo=None)])
@pytest.mark.asyncio
async def test_lease_operations_reject_naive_current_time(now: datetime) -> None:
    service = MarketplaceSyncStateService(cast(AsyncSession, _RecordingSession([])))

    with pytest.raises(ValueError, match="timezone-aware"):
        await service.acquire(
            state_id=UUID(int=1),
            owner="worker-a",
            now=now,
            lease_for=timedelta(minutes=1),
        )


@pytest.mark.parametrize(
    ("now", "next_run_at"),
    [
        (NOW.replace(tzinfo=None), NOW + timedelta(minutes=5)),
        (NOW, (NOW + timedelta(minutes=5)).replace(tzinfo=None)),
    ],
)
@pytest.mark.asyncio
async def test_release_rejects_naive_timestamps(now: datetime, next_run_at: datetime) -> None:
    service = MarketplaceSyncStateService(cast(AsyncSession, _RecordingSession([])))

    with pytest.raises(ValueError, match="timezone-aware"):
        await service.release(
            UUID(int=1),
            owner="worker-a",
            now=now,
            next_run_at=next_run_at,
        )


@pytest.mark.parametrize(
    ("owner", "lease_for"),
    [
        ("", timedelta(minutes=1)),
        ("x" * 129, timedelta(minutes=1)),
        ("worker-a", timedelta(seconds=0)),
        ("worker-a", timedelta(minutes=31)),
    ],
)
@pytest.mark.asyncio
async def test_lease_input_is_bounded(owner: str, lease_for: timedelta) -> None:
    service = MarketplaceSyncStateService(cast(AsyncSession, _RecordingSession([])))

    with pytest.raises(ValueError):
        await service.acquire(state_id=UUID(int=1), owner=owner, now=NOW, lease_for=lease_for)
