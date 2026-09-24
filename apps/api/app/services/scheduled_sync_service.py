from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import (
    AdapterResult,
    MarketplaceErrorCode,
    ProviderMessageContext,
    ReviewQuestionAdapter,
)
from app.adapters.capabilities import MarketplaceStream, read_scope_for_stream, validated_scope_names
from app.adapters.conversation import ConversationAdapter
from app.adapters.registry import MarketplaceAdapterRegistry, UnsupportedCapabilityError
from app.adapters.yandex_market import YandexMarketAdapter
from app.core.config import get_settings
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.services.avito_chat_sync_service import AvitoChatSyncService
from app.services.marketplace_ingest_service import IngestStats, MarketplaceIngestService
from app.services.marketplace_sync_state_service import MarketplaceSyncStateService
from app.services.yandex_question_policy import (
    YandexQuestionCheckpoint,
    advance_window,
    load_checkpoint,
    record_page,
    store_checkpoint,
)

MAX_PAGES_PER_RUN = 100
_LEASE_DURATION = timedelta(minutes=5)
_SUCCESS_INTERVAL = timedelta(minutes=5)
_MAX_BACKOFF_SECONDS = 60 * 60
_PAUSE_ERRORS = frozenset({"invalid_credentials", "insufficient_scope"})
_MAX_DUE_STREAMS = 100


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

    async def claim_due(
        self,
        *,
        now: datetime,
        owner: str,
        limit: int,
    ) -> list[MarketplaceSyncState]:
        return await claim_due_marketplace_streams(
            self.session,
            now=now,
            owner=owner,
            limit=limit,
        )

    async def run_stream(
        self,
        state_id: UUID,
        owner: str,
        now: datetime,
        *,
        preacquired: bool = False,
    ) -> StreamRunResult:
        async with self.session.begin():
            if preacquired:
                state = await self.session.scalar(
                    select(MarketplaceSyncState).where(
                        MarketplaceSyncState.id == state_id,
                        MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                        MarketplaceSyncState.lease_owner == owner,
                        MarketplaceSyncState.lease_expires_at > now,
                    )
                )
            else:
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
                if stream is MarketplaceStream.CHATS:
                    adapter: ReviewQuestionAdapter | ConversationAdapter = self.registry.conversations(marketplace)
                else:
                    adapter = self.registry.review_questions(marketplace, stream)
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

            required_scope = read_scope_for_stream(stream)
            scopes = validated_scope_names(account.scopes_json or {})
            if account.status != "active" or account.credentials_status != "valid" or required_scope not in scopes:
                await self.states.fail(
                    state.id,
                    owner=owner,
                    error_code="insufficient_scope",
                    next_run_at=None,
                    pause=True,
                )
                return StreamRunResult(
                    state_id=state.id,
                    stream=stream,
                    acquired=True,
                    completed=False,
                    error_code="insufficient_scope",
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

        if isinstance(adapter, ConversationAdapter):
            return await self._run_conversation_batch(
                state=state,
                account=account,
                adapter=adapter,
                credential=credential,
                stream=stream,
                owner=owner,
            )

        if marketplace is Marketplace.YANDEX_MARKET and stream is MarketplaceStream.QUESTIONS and isinstance(adapter, YandexMarketAdapter):
            try:
                checkpoint = load_checkpoint(
                    state.metadata_json or {},
                    self._now().date(),
                )
            except ValueError:
                return await self._fail(
                    state,
                    stream,
                    owner,
                    "malformed_payload",
                    self._now(),
                    totals,
                )
            if not checkpoint.completed:
                return await self._run_yandex_question_backfill(
                    state=state,
                    account=account,
                    adapter=adapter,
                    credential=credential,
                    stream=stream,
                    owner=owner,
                    checkpoint=checkpoint,
                )

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
                        **(state.metadata_json or {}),
                        "pages_completed": page_number,
                        "items_completed": totals.created_messages + totals.updated_messages + page_stats.created_messages + page_stats.updated_messages,
                    },
                    now=page_completed_at,
                    lease_for=_LEASE_DURATION,
                )
            totals = _add_stats(totals, page_stats)
            cursor = page.next_cursor
            if cursor is None:
                return await self._complete_cycle(
                    state,
                    stream,
                    owner,
                    self._now(),
                    totals,
                    account=account,
                    adapter=adapter,
                    credential=credential,
                )

        return await self._fail(state, stream, owner, "malformed_payload", self._now(), totals)

    async def _run_conversation_batch(
        self,
        *,
        state: MarketplaceSyncState,
        account: MarketplaceAccount,
        adapter: ConversationAdapter,
        credential: str,
        stream: MarketplaceStream,
        owner: str,
    ) -> StreamRunResult:
        result = await AvitoChatSyncService(
            self.session,
            adapter=adapter,
            states=self.states,
            ingest=self.ingest,
            clock=self.clock,
        ).sync_batch(
            account=account,
            credential=credential,
            state=state,
            owner=owner,
            lease_for=_LEASE_DURATION,
        )
        if result.error_code is not None:
            return await self._record_adapter_failure(
                result.state,
                stream,
                owner,
                AdapterResult(
                    False,
                    error_code=result.error_code,
                    error_message_safe="Marketplace conversation synchronization failed",
                    retry_after_seconds=result.retry_after_seconds,
                ),
                self._now(),
                result.stats,
            )
        release_at = self._now()
        next_run_at = release_at + (timedelta(seconds=1) if result.has_more else _SUCCESS_INTERVAL)
        async with self.session.begin():
            await self.states.release(
                result.state.id,
                owner=owner,
                now=release_at,
                next_run_at=next_run_at,
            )
        return _result(
            result.state.id,
            stream,
            result.stats,
            completed=result.completed,
        )

    async def _run_yandex_question_backfill(
        self,
        *,
        state: MarketplaceSyncState,
        account: MarketplaceAccount,
        adapter: YandexMarketAdapter,
        credential: str,
        stream: MarketplaceStream,
        owner: str,
        checkpoint: YandexQuestionCheckpoint,
    ) -> StreamRunResult:
        totals = IngestStats()
        for page_number in range(1, MAX_PAGES_PER_RUN + 1):
            fetched = await adapter.fetch_questions_window(
                credential,
                account.seller_id,
                date_from=checkpoint.date_from,
                date_to=checkpoint.date_to,
                cursor=checkpoint.page_token,
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
            try:
                next_checkpoint = record_page(checkpoint, page.next_cursor)
                if page.next_cursor is None:
                    next_checkpoint = advance_window(next_checkpoint)
            except ValueError:
                return await self._fail(
                    state,
                    stream,
                    owner,
                    "malformed_payload",
                    self._now(),
                    totals,
                )
            completed_at = self._now()
            async with self.session.begin():
                page_stats = await self.ingest.ingest_page(account, page, completed_at)
                state = await self.states.complete_page(
                    state_id=state.id,
                    owner=owner,
                    current_cursor=state.cursor,
                    next_cursor=state.cursor,
                    metadata=store_checkpoint(
                        {
                            **(state.metadata_json or {}),
                            "pages_completed": page_number,
                            "items_completed": totals.created_messages + totals.updated_messages + page_stats.created_messages + page_stats.updated_messages,
                        },
                        next_checkpoint,
                    ),
                    now=completed_at,
                    lease_for=_LEASE_DURATION,
                )
            totals = _add_stats(totals, page_stats)
            checkpoint = next_checkpoint
            if checkpoint.completed:
                return await self._complete_cycle(
                    state,
                    stream,
                    owner,
                    self._now(),
                    totals,
                    account=account,
                    adapter=adapter,
                    credential=credential,
                )

        release_at = self._now()
        async with self.session.begin():
            await self.states.release(
                state.id,
                owner=owner,
                now=release_at,
                next_run_at=release_at + timedelta(seconds=1),
            )
        return _result(state.id, stream, totals, completed=False)

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
        *,
        account: MarketplaceAccount,
        adapter: ReviewQuestionAdapter,
        credential: str,
    ) -> StreamRunResult:
        if stream is MarketplaceStream.QUESTIONS and account.marketplace == Marketplace.YANDEX_MARKET.value and isinstance(adapter, YandexMarketAdapter):
            reconciliation_error = await self._reconcile_yandex_questions(
                account=account,
                adapter=adapter,
                credential=credential,
            )
            if reconciliation_error is not None:
                return await self._fail(
                    state,
                    stream,
                    owner,
                    reconciliation_error,
                    now,
                    totals,
                )
        async with self.session.begin():
            await self.states.release(
                state.id,
                owner=owner,
                now=now,
                next_run_at=now + _SUCCESS_INTERVAL,
            )
        return _result(state.id, stream, totals, completed=True)

    async def _reconcile_yandex_questions(
        self,
        *,
        account: MarketplaceAccount,
        adapter: YandexMarketAdapter,
        credential: str,
    ) -> MarketplaceErrorCode | None:
        result = await self.session.execute(
            select(CustomerMessage)
            .where(
                CustomerMessage.organization_id == account.organization_id,
                CustomerMessage.marketplace_account_id == account.id,
                CustomerMessage.marketplace == Marketplace.YANDEX_MARKET.value,
                CustomerMessage.type == MessageType.QUESTION.value,
                CustomerMessage.status == MessageStatus.NEEDS_REPLY.value,
            )
            .order_by(CustomerMessage.marketplace_created_at.asc(), CustomerMessage.id.asc())
            .limit(25)
        )
        candidates = [
            (
                message.id,
                message.external_id,
                message.marketplace_created_at,
                dict(message.metadata_json or {}),
            )
            for message in result.scalars().all()
        ]
        organization_id = account.organization_id
        account_id = account.id
        seller_id = account.seller_id
        await self.session.commit()
        published_ids: list[UUID] = []
        for message_id, external_id, marketplace_created_at, metadata in candidates:
            reconciliation = await adapter.find_existing_reply(
                credential,
                seller_id,
                ProviderMessageContext(
                    message_type=MessageType.QUESTION,
                    external_id=external_id,
                    marketplace_created_at=marketplace_created_at,
                    metadata=metadata,
                ),
            )
            if not reconciliation.ok or reconciliation.data is None:
                return reconciliation.error_code or "malformed_payload"
            if reconciliation.data.exists and reconciliation.data.provider_state == "published":
                published_ids.append(message_id)
        if published_ids:
            async with self.session.begin():
                await self.session.execute(
                    update(CustomerMessage)
                    .where(
                        CustomerMessage.id.in_(published_ids),
                        CustomerMessage.organization_id == organization_id,
                        CustomerMessage.marketplace_account_id == account_id,
                        CustomerMessage.status == MessageStatus.NEEDS_REPLY.value,
                    )
                    .values(status=MessageStatus.ANSWERED.value)
                )
                self.session.add(
                    IntegrationEvent(
                        organization_id=organization_id,
                        marketplace_account_id=account_id,
                        marketplace=Marketplace.YANDEX_MARKET.value,
                        event_type="questions.reconcile",
                        status="success",
                        metadata_json={"published_messages": len(published_ids)},
                    )
                )
        return None

    async def _record_adapter_failure(
        self,
        state: MarketplaceSyncState,
        stream: MarketplaceStream,
        owner: str,
        result: AdapterResult[object],
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


async def claim_due_marketplace_streams(
    session: AsyncSession,
    *,
    now: datetime,
    owner: str,
    limit: int,
) -> list[MarketplaceSyncState]:
    _validate_scheduler_input(now, owner, limit)
    async with session.begin():
        result = await session.execute(
            select(MarketplaceSyncState)
            .where(
                or_(
                    and_(
                        MarketplaceSyncState.status.in_((SyncStateStatus.IDLE.value, SyncStateStatus.ERROR.value)),
                        MarketplaceSyncState.next_run_at.is_not(None),
                        MarketplaceSyncState.next_run_at <= now,
                    ),
                    and_(
                        MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                        MarketplaceSyncState.lease_expires_at <= now,
                    ),
                )
            )
            .order_by(
                MarketplaceSyncState.next_run_at.asc().nullsfirst(),
                MarketplaceSyncState.id.asc(),
            )
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        states = list(result.scalars().all())
        lease_expires_at = now + _LEASE_DURATION
        for state in states:
            state.status = SyncStateStatus.LEASED.value
            state.lease_owner = owner
            state.lease_expires_at = lease_expires_at
            state.last_attempt_at = now
    return states


async def take_claimed_marketplace_stream(
    session: AsyncSession,
    *,
    state_id: UUID,
    now: datetime,
    owner: str,
) -> MarketplaceSyncState | None:
    _validate_scheduler_input(now, owner, 1)
    async with session.begin():
        result = await session.execute(
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner.startswith("scheduler:"),
                MarketplaceSyncState.lease_expires_at > now,
            )
            .values(
                lease_owner=owner,
                lease_expires_at=now + _LEASE_DURATION,
                last_attempt_at=now,
            )
            .returning(MarketplaceSyncState)
        )
        return result.scalar_one_or_none()


async def release_marketplace_dispatch_claim(
    session: AsyncSession,
    *,
    state_id: UUID,
    now: datetime,
    owner: str,
) -> bool:
    """Requeue a scheduler claim when the worker message was not published."""
    _validate_scheduler_input(now, owner, 1)
    if not owner.startswith("scheduler:"):
        raise ValueError("marketplace dispatch owner must be a scheduler")

    async with session.begin():
        result = await session.execute(
            update(MarketplaceSyncState)
            .where(
                MarketplaceSyncState.id == state_id,
                MarketplaceSyncState.status == SyncStateStatus.LEASED.value,
                MarketplaceSyncState.lease_owner == owner,
            )
            .values(
                status=SyncStateStatus.IDLE.value,
                lease_owner=None,
                lease_expires_at=None,
                next_run_at=now,
            )
            .returning(MarketplaceSyncState.id)
        )
        return result.scalar_one_or_none() is not None


def _validate_scheduler_input(now: datetime, owner: str, limit: int) -> None:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("marketplace scheduler time must be timezone-aware")
    if not owner or len(owner) > 128 or any(ord(character) < 33 for character in owner):
        raise ValueError("marketplace scheduler owner is invalid")
    if type(limit) is not int or not 1 <= limit <= _MAX_DUE_STREAMS:
        raise ValueError("marketplace scheduler limit is outside safe bounds")
