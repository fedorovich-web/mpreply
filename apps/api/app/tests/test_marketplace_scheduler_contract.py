from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import TracebackType
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ClauseElement

from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.services.scheduled_sync_service import (
    claim_due_marketplace_streams,
    release_marketplace_dispatch_claim,
    take_claimed_marketplace_stream,
)

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


class _Scalars:
    def __init__(self, states: list[MarketplaceSyncState]) -> None:
        self.states = states

    def all(self) -> list[MarketplaceSyncState]:
        return self.states


class _Result:
    def __init__(self, states: list[MarketplaceSyncState]) -> None:
        self.states = states

    def scalars(self) -> _Scalars:
        return _Scalars(self.states)

    def scalar_one_or_none(self) -> MarketplaceSyncState | None:
        return self.states[0] if self.states else None


class _Session:
    def __init__(self, states: list[MarketplaceSyncState]) -> None:
        self.states = states
        self.statements: list[object] = []

    def begin(self) -> _Transaction:
        return _Transaction()

    async def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return _Result(self.states)


def _state() -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        stream="reviews",
        status=SyncStateStatus.IDLE.value,
        cursor=None,
        metadata_json={},
        next_run_at=NOW,
        consecutive_failures=0,
    )


@pytest.mark.asyncio
async def test_due_selection_is_bounded_and_uses_skip_locked() -> None:
    state = _state()
    session = _Session([state])
    selected = await claim_due_marketplace_streams(
        cast(AsyncSession, session),
        now=NOW,
        owner="scheduler:synthetic",
        limit=25,
    )

    sql = str(
        cast(ClauseElement, session.statements[0]).compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": False},
        )
    )
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert " LIMIT " in sql
    assert selected == [state]
    assert state.status == SyncStateStatus.LEASED.value
    assert state.lease_owner == "scheduler:synthetic"
    assert state.lease_expires_at == NOW + timedelta(minutes=5)


@pytest.mark.asyncio
async def test_worker_takeover_is_compare_and_swap_on_scheduler_lease() -> None:
    state = _state()
    state.status = SyncStateStatus.LEASED.value
    state.lease_owner = "scheduler:synthetic"
    state.lease_expires_at = NOW + timedelta(minutes=5)
    session = _Session([state])
    claimed = await take_claimed_marketplace_stream(
        cast(AsyncSession, session),
        state_id=state.id,
        now=NOW,
        owner="worker:synthetic",
    )

    sql = str(
        cast(ClauseElement, session.statements[0]).compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": False},
        )
    )
    assert "UPDATE marketplace_sync_states" in sql
    assert "lease_owner LIKE" in sql
    assert claimed is state


@pytest.mark.asyncio
async def test_failed_broker_dispatch_releases_only_the_exact_scheduler_claim() -> None:
    state = _state()
    state.status = SyncStateStatus.LEASED.value
    state.lease_owner = "scheduler:synthetic"
    state.lease_expires_at = NOW + timedelta(minutes=5)
    session = _Session([state])

    released = await release_marketplace_dispatch_claim(
        cast(AsyncSession, session),
        state_id=state.id,
        now=NOW,
        owner="scheduler:synthetic",
    )

    statement = cast(ClauseElement, session.statements[0])
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": False},
        )
    )
    parameters = statement.compile(dialect=postgresql.dialect()).params or {}
    assert released is True
    assert "UPDATE marketplace_sync_states" in sql
    assert "lease_owner =" in sql
    assert "lease_owner LIKE" not in sql
    assert "scheduler:synthetic" in parameters.values()


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, -1, 101, True])
async def test_due_selection_rejects_unbounded_limits_before_database(limit: int) -> None:
    session = _Session([])
    with pytest.raises(ValueError, match="outside safe bounds"):
        await claim_due_marketplace_streams(
            cast(AsyncSession, session),
            now=NOW,
            owner="scheduler:synthetic",
            limit=limit,
        )
    assert session.statements == []
