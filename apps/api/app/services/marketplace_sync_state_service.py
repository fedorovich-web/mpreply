from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import Update

from app.adapters.base import MarketplaceErrorCode
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus

_MAX_CURSOR_LENGTH = 2048
_MAX_LEASE_OWNER_LENGTH = 128
_MIN_LEASE_SECONDS = 1
_MAX_LEASE_SECONDS = 30 * 60


class LeaseOwnershipError(RuntimeError):
    pass


class MarketplaceSyncStateService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def acquire(
        self,
        *,
        state_id: UUID,
        owner: str,
        now: datetime,
        lease_for: timedelta,
    ) -> MarketplaceSyncState | None:
        _validate_lease(owner, lease_for)
        _validate_aware_datetime(now, field_name="current time")
        statement = (
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                or_(
                    MarketplaceSyncState.status.in_((SyncStateStatus.IDLE.value, SyncStateStatus.ERROR.value)),
                    and_(
                        MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                        MarketplaceSyncState.lease_expires_at <= now,
                    ),
                ),
            )
            .values(
                status=SyncStateStatus.LEASED.value,
                lease_owner=owner,
                lease_expires_at=now + lease_for,
                last_attempt_at=now,
            )
            .returning(MarketplaceSyncState)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def renew(
        self,
        state_id: UUID,
        *,
        owner: str,
        now: datetime,
        lease_for: timedelta,
    ) -> MarketplaceSyncState:
        _validate_lease(owner, lease_for)
        _validate_aware_datetime(now, field_name="current time")
        statement = (
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner == owner,
                MarketplaceSyncState.lease_expires_at > now,
            )
            .values(lease_expires_at=now + lease_for)
            .returning(MarketplaceSyncState)
        )
        return await self._owned_result(statement)

    async def complete_page(
        self,
        *,
        state_id: UUID,
        owner: str,
        current_cursor: str | None,
        next_cursor: str | None,
        metadata: Mapping[str, object],
        now: datetime,
        lease_for: timedelta,
    ) -> MarketplaceSyncState:
        _validate_lease(owner, lease_for)
        _validate_aware_datetime(now, field_name="current time")
        _validate_cursor(current_cursor)
        _validate_cursor(next_cursor)
        cursor_guard = MarketplaceSyncState.cursor.is_(None) if current_cursor is None else MarketplaceSyncState.cursor == current_cursor
        statement = (
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner == owner,
                MarketplaceSyncState.lease_expires_at > now,
                cursor_guard,
            )
            .values(
                cursor=next_cursor,
                metadata_json=dict(metadata),
                lease_expires_at=now + lease_for,
                last_error_code=None,
            )
            .returning(MarketplaceSyncState)
        )
        return await self._owned_result(statement)

    async def release(
        self,
        state_id: UUID,
        *,
        owner: str,
        now: datetime,
        next_run_at: datetime,
    ) -> MarketplaceSyncState:
        _validate_owner(owner)
        _validate_aware_datetime(now, field_name="current time")
        _validate_aware_datetime(next_run_at, field_name="next run")
        statement = (
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner == owner,
            )
            .values(
                status=SyncStateStatus.IDLE.value,
                cursor=None,
                lease_owner=None,
                lease_expires_at=None,
                next_run_at=next_run_at,
                consecutive_failures=0,
                last_error_code=None,
                last_success_at=now,
            )
            .returning(MarketplaceSyncState)
        )
        return await self._owned_result(statement)

    async def fail(
        self,
        state_id: UUID,
        *,
        owner: str,
        error_code: MarketplaceErrorCode,
        next_run_at: datetime | None,
        pause: bool,
    ) -> MarketplaceSyncState:
        _validate_owner(owner)
        if not pause:
            if next_run_at is None:
                raise ValueError("marketplace sync next run is required after a retryable failure")
            _validate_aware_datetime(next_run_at, field_name="next run")
        status = SyncStateStatus.PAUSED.value if pause else SyncStateStatus.ERROR.value
        statement = (
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner == owner,
            )
            .values(
                status=status,
                lease_owner=None,
                lease_expires_at=None,
                next_run_at=None if pause else next_run_at,
                consecutive_failures=MarketplaceSyncState.consecutive_failures + 1,
                last_error_code=error_code,
            )
            .returning(MarketplaceSyncState)
        )
        return await self._owned_result(statement)

    async def _owned_result(self, statement: Update) -> MarketplaceSyncState:
        result = await self.session.execute(statement)
        state = result.scalar_one_or_none()
        if state is None:
            raise LeaseOwnershipError("marketplace sync lease is no longer owned by this worker")
        return state


def _validate_lease(owner: str, lease_for: timedelta) -> None:
    _validate_owner(owner)
    seconds = lease_for.total_seconds()
    if not _MIN_LEASE_SECONDS <= seconds <= _MAX_LEASE_SECONDS:
        raise ValueError("marketplace sync lease duration is outside safe bounds")


def _validate_owner(owner: str) -> None:
    if not owner or len(owner) > _MAX_LEASE_OWNER_LENGTH or any(ord(character) < 33 for character in owner):
        raise ValueError("marketplace sync lease owner is invalid")


def _validate_aware_datetime(value: datetime, *, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"marketplace sync {field_name} must be timezone-aware")


def _validate_cursor(cursor: str | None) -> None:
    if cursor is not None and (len(cursor) > _MAX_CURSOR_LENGTH or "\x00" in cursor):
        raise ValueError("marketplace cursor is outside safe bounds")
