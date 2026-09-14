from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, MarketplaceErrorCode, MarketplacePage, NormalizedMessage
from app.adapters.capabilities import MarketplaceStream
from app.adapters.registry import MarketplaceAdapterRegistry, UnsupportedCapabilityError
from app.core.config import get_settings
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_ingest_service import IngestStats, MarketplaceIngestService
from app.services.marketplace_sync_state_service import MarketplaceSyncStateService

MAX_PAGES_PER_RUN = 100
_LEASE_DURATION = timedelta(minutes=5)
_SUCCESS_INTERVAL = timedelta(minutes=5)
_MAX_BACKOFF_SECONDS = 60 * 60
_PAUSE_ERRORS = frozenset({"invalid_credentials", "insufficient_scope"})


@dataclass(frozen=True, slots=True)
class StreamRunResult:
    state_id: UUID
    stream: MarketplaceStream | None
    acquired: bool
    completed: bool
    created_messages: int = 0
    updated_messages: int = 0
    created_products: int = 0
    updated_products: int = 0
    error_code: MarketplaceErrorCode | None = None


class ScheduledSyncService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        registry: MarketplaceAdapterRegistry,
        states: MarketplaceSyncStateService | None = None,
        ingest: MarketplaceIngestService | None = None,
        credentials: CredentialService | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session = session
        self.registry = registry
        self.states = states or MarketplaceSyncStateService(session)
        self.ingest = ingest or MarketplaceIngestService(session)
        if credentials is None:
            settings = get_settings()
            credentials = CredentialService(settings.credentials_encryption_key.get_secret_value())
        self.credentials = credentials
        self.clock = clock or _utc_now

    async def run_stream(self, state_id: UUID, owner: str, now: datetime) -> StreamRunResult:
        async with self.session.begin():
            state = await self.states.acquire(
                state_id=state_id,
                owner=owner,
                now=now,
                lease_for=_LEASE_DURATION,
            )
            if state is None:
                return StreamRunResult(
                    state_id=state_id,
                    stream=None,
                    acquired=False,
                    completed=False,
                )
            account = await self.session.scalar(
                select(MarketplaceAccount).where(
                    MarketplaceAccount.id == state.marketplace_account_id,
                    MarketplaceAccount.organization_id == state.organization_id,
                )
            )
            if account is None:
                raise RuntimeError("marketplace sync state account was not found")
            try:
                marketplace = Marketplace(account.marketplace)
                stream = MarketplaceStream(state.stream)
                adapter = self.registry.review_questions(marketplace)
            except (ValueError, UnsupportedCapabilityError):
                await self.states.fail(
                    state.id,
                    owner=owner,
                    error_code="unsupported_capability",
                    next_run_at=None,
                    pause=True,
                )
                return StreamRunResult(
                    state_id=state.id,
                    stream=None,
                    acquired=True,
                    completed=False,
                    error_code="unsupported_capability",
                )

        try:
            credential = self.credentials.decrypt(account.credentials_encrypted)
        except CredentialEncryptionError:
            return await self._record_adapter_failure(
                state,
                stream,
                owner,
                AdapterResult(
                    False,
                    error_code="invalid_credentials",
                    error_message_safe="Stored marketplace credential is invalid",
                ),
                self._now(),
                IngestStats(),
            )
        seen: set[str | None] = set()
        cursor = state.cursor
        totals = IngestStats()

        for page_number in range(1, MAX_PAGES_PER_RUN + 1):
            if cursor in seen:
                return await self._fail(
                    state,
                    stream,
                    owner,
                    "malformed_payload",
                    self._now(),
                    totals,
                )
            seen.add(cursor)
            fetched = await adapter.fetch_page(
                credential,
                account.seller_id,
                stream,
                cursor,
            )
            if not fetched.ok or fetched.data is None:
                return await self._record_adapter_failure(
                    state,
                    stream,
                    owner,
                    fetched,
                    self._now(),
                    totals,
                )
            page = fetched.data
            page_completed_at = self._now()
            async with self.session.begin():
                page_stats = await self.ingest.ingest_page(account, page, page_completed_at)
                state = await self.states.complete_page(
                    state_id=state.id,
                    owner=owner,
                    current_cursor=cursor,
                    next_cursor=page.next_cursor,
                    metadata={
                        "pages_completed": page_number,
                        "items_completed": totals.created_messages
                        + totals.updated_messages
                        + page_stats.created_messages
                        + page_stats.updated_messages,
                    },
                    now=page_completed_at,
                    lease_for=_LEASE_DURATION,
                )
            totals = _add_stats(totals, page_stats)
            cursor = page.next_cursor
            if cursor is None:
                return await self._complete_cycle(state, stream, owner, self._now(), totals)

        return await self._fail(state, stream, owner, "malformed_payload", self._now(), totals)

    def _now(self) -> datetime:
        current = self.clock()
        if current.tzinfo is None or current.utcoffset() is None:
            raise ValueError("marketplace sync clock must return a timezone-aware datetime")
        return current

    async def _complete_cycle(
        self,
        state: MarketplaceSyncState,
        stream: MarketplaceStream,
        owner: str,
        now: datetime,
        totals: IngestStats,
    ) -> StreamRunResult:
        async with self.session.begin():
            await self.states.release(
                state.id,
                owner=owner,
                now=now,
                next_run_at=now + _SUCCESS_INTERVAL,
            )
        return _result(state.id, stream, totals, completed=True)

    async def _record_adapter_failure(
        self,
        state: MarketplaceSyncState,
        stream: MarketplaceStream,
        owner: str,
        result: AdapterResult[MarketplacePage[NormalizedMessage]],
        now: datetime,
        totals: IngestStats,
    ) -> StreamRunResult:
        error_code = result.error_code or "malformed_payload"
        pause = error_code in _PAUSE_ERRORS
        retry_after = result.retry_after_seconds or 0
        delay = max(retry_after, min(2 ** min(state.consecutive_failures, 12), _MAX_BACKOFF_SECONDS))
        async with self.session.begin():
            await self.states.fail(
                state.id,
                owner=owner,
                error_code=error_code,
                next_run_at=None if pause else now + timedelta(seconds=delay),
                pause=pause,
            )
        return _result(state.id, stream, totals, completed=False, error_code=error_code)

    async def _fail(
        self,
        state: MarketplaceSyncState,
        stream: MarketplaceStream,
        owner: str,
        error_code: MarketplaceErrorCode,
        now: datetime,
        totals: IngestStats,
    ) -> StreamRunResult:
        async with self.session.begin():
            await self.states.fail(
                state.id,
                owner=owner,
                error_code=error_code,
                next_run_at=now + timedelta(seconds=1),
                pause=False,
            )
        return _result(state.id, stream, totals, completed=False, error_code=error_code)


def _add_stats(left: IngestStats, right: IngestStats) -> IngestStats:
    return IngestStats(
        created_messages=left.created_messages + right.created_messages,
        updated_messages=left.updated_messages + right.updated_messages,
        created_products=left.created_products + right.created_products,
        updated_products=left.updated_products + right.updated_products,
    )


def _result(
    state_id: UUID,
    stream: MarketplaceStream,
    stats: IngestStats,
    *,
    completed: bool,
    error_code: MarketplaceErrorCode | None = None,
) -> StreamRunResult:
    return StreamRunResult(
        state_id=state_id,
        stream=stream,
        acquired=True,
        completed=completed,
        created_messages=stats.created_messages,
        updated_messages=stats.updated_messages,
        created_products=stats.created_products,
        updated_products=stats.updated_products,
        error_code=error_code,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)
