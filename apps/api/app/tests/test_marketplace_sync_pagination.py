from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from types import TracebackType
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy.dialects.postgresql.dml import Insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.adapters.base import AdapterResult, MarketplacePage
from app.adapters.capabilities import AVITO_CAPABILITY, WILDBERRIES_CAPABILITY, MarketplaceStream
from app.adapters.registry import MarketplaceAdapterRegistry
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.enums import Marketplace
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState, SyncStateStatus
from app.models.sync_job import SyncJob
from app.models.user import User
from app.services.marketplace_ingest_service import IngestStats, MarketplaceIngestService
from app.services.marketplace_sync_state_service import MarketplaceSyncStateService
from app.services.scheduled_sync_service import (
    MAX_PAGES_PER_RUN,
    ScheduledSyncService,
    StreamRunResult,
)
from app.services.sync_service import MarketplaceSyncService

NOW = datetime(2026, 9, 12, 12, 0, tzinfo=UTC)


class _Transaction:
    def __init__(self, session: _Session) -> None:
        self.session = session

    async def __aenter__(self) -> None:
        assert self.session.in_transaction is False
        self.session.in_transaction = True
        self.session.transaction_count += 1

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.session.in_transaction = False


class _Session:
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account
        self.in_transaction = False
        self.transaction_count = 0

    def begin(self) -> _Transaction:
        return _Transaction(self)

    async def scalar(self, _: object) -> MarketplaceAccount:
        assert self.in_transaction is True
        return self.account

    async def flush(self) -> None:
        return None


class _CredentialService:
    def __init__(self, session: _Session, states: _States, *, fail: bool = False) -> None:
        self.session = session
        self.states = states
        self.fail = fail
        self.decrypt_calls = 0

    def decrypt(self, encrypted: str) -> str:
        assert encrypted == "encrypted"
        assert self.states.acquired is True
        assert self.session.in_transaction is False
        self.decrypt_calls += 1
        if self.fail:
            raise CredentialEncryptionError("Unable to decrypt credential")
        return "synthetic-token"


class _Adapter:
    def __init__(
        self,
        session: _Session,
        pages: Sequence[AdapterResult[MarketplacePage[object]]],
    ) -> None:
        self.session = session
        self.pages = list(pages)
        self.calls: list[str | None] = []

    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[object]]:
        assert self.session.in_transaction is False
        assert credential == "synthetic-token"
        assert seller_id == "seller-label"
        assert stream is MarketplaceStream.REVIEWS
        self.calls.append(cursor)
        if not self.pages:
            raise AssertionError("unexpected provider page request")
        return self.pages.pop(0)


class _Registry:
    def __init__(self, adapter: _Adapter) -> None:
        self.adapter = adapter
        self.calls = 0

    def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> object:
        assert marketplace is Marketplace.WILDBERRIES
        assert stream is MarketplaceStream.REVIEWS
        self.calls += 1
        return self.adapter


class _States:
    def __init__(self, state: MarketplaceSyncState, session: _Session, *, acquire: bool = True) -> None:
        self.state = state
        self.session = session
        self.allow_acquire = acquire
        self.acquired = False
        self.completed: list[tuple[str | None, str | None]] = []
        self.failed: list[str] = []
        self.released = 0

    async def acquire(self, **_: object) -> MarketplaceSyncState | None:
        assert self.session.in_transaction is True
        if not self.allow_acquire:
            return None
        self.acquired = True
        return self.state

    async def complete_page(
        self,
        *,
        current_cursor: str | None,
        next_cursor: str | None,
        **_: object,
    ) -> MarketplaceSyncState:
        assert self.session.in_transaction is True
        self.completed.append((current_cursor, next_cursor))
        self.state.cursor = next_cursor
        return self.state

    async def release(self, *_: object, **__: object) -> MarketplaceSyncState:
        assert self.session.in_transaction is True
        self.released += 1
        self.state.status = SyncStateStatus.IDLE.value
        self.state.cursor = None
        return self.state

    async def fail(self, *_: object, error_code: str, **__: object) -> MarketplaceSyncState:
        assert self.session.in_transaction is True
        self.failed.append(error_code)
        self.state.status = SyncStateStatus.ERROR.value
        return self.state


class _Ingest:
    def __init__(self, session: _Session) -> None:
        self.session = session
        self.pages = 0

    async def ingest_page(self, *_: object) -> IngestStats:
        assert self.session.in_transaction is True
        self.pages += 1
        return IngestStats(created_messages=1)


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.WILDBERRIES.value,
        display_name="Synthetic Wildberries",
        seller_id="seller-label",
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        credentials_status="valid",
        scopes_json={
            "scopes": [
                "reviews:read",
                "reviews:write",
                "questions:read",
                "questions:write",
            ]
        },
    )


def _state(account: MarketplaceAccount) -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream=MarketplaceStream.REVIEWS.value,
        status=SyncStateStatus.IDLE.value,
        cursor=None,
        metadata_json={},
        consecutive_failures=0,
    )


def _page(next_cursor: str | None) -> AdapterResult[MarketplacePage[object]]:
    return AdapterResult(ok=True, data=MarketplacePage(items=(), next_cursor=next_cursor))


def _service(
    pages: Sequence[AdapterResult[MarketplacePage[object]]],
    *,
    acquire: bool = True,
    decrypt_failure: bool = False,
) -> tuple[ScheduledSyncService, _Adapter, _States, _CredentialService, _Ingest]:
    account = _account()
    state = _state(account)
    session = _Session(account)
    states = _States(state, session, acquire=acquire)
    adapter = _Adapter(session, pages)
    credentials = _CredentialService(session, states, fail=decrypt_failure)
    ingest = _Ingest(session)
    service = ScheduledSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _Registry(adapter)),
        states=cast(MarketplaceSyncStateService, states),
        ingest=cast(MarketplaceIngestService, ingest),
        credentials=cast(CredentialService, credentials),
    )
    return service, adapter, states, credentials, ingest


@pytest.mark.asyncio
async def test_stream_runner_paginates_and_checkpoints_each_complete_page() -> None:
    service, adapter, states, credentials, ingest = _service([_page("50"), _page(None)])

    result = await service.run_stream(states.state.id, "worker-a", NOW)

    assert result.acquired is True
    assert result.completed is True
    assert result.created_messages == 2
    assert result.error_code is None
    assert adapter.calls == [None, "50"]
    assert states.completed == [(None, "50"), ("50", None)]
    assert states.released == 1
    assert states.failed == []
    assert credentials.decrypt_calls == 1
    assert ingest.pages == 2


@pytest.mark.asyncio
async def test_stream_runner_rejects_a_repeated_cursor_before_another_request() -> None:
    service, adapter, states, _, ingest = _service([_page("50"), _page("50")])

    result = await service.run_stream(states.state.id, "worker-a", NOW)

    assert result.completed is False
    assert result.error_code == "malformed_payload"
    assert adapter.calls == [None, "50"]
    assert ingest.pages == 2
    assert states.failed == ["malformed_payload"]
    assert states.released == 0


@pytest.mark.asyncio
async def test_stream_runner_enforces_the_page_cap() -> None:
    service, adapter, states, _, ingest = _service([_page(str((index + 1) * 50)) for index in range(MAX_PAGES_PER_RUN)])

    result = await service.run_stream(states.state.id, "worker-a", NOW)

    assert result.completed is False
    assert result.error_code == "malformed_payload"
    assert len(adapter.calls) == MAX_PAGES_PER_RUN
    assert ingest.pages == MAX_PAGES_PER_RUN
    assert states.failed == ["malformed_payload"]


@pytest.mark.asyncio
async def test_stream_runner_does_not_decrypt_or_call_provider_without_a_lease() -> None:
    service, adapter, states, credentials, ingest = _service([], acquire=False)

    result = await service.run_stream(states.state.id, "worker-a", NOW)

    assert result.acquired is False
    assert result.completed is False
    assert adapter.calls == []
    assert credentials.decrypt_calls == 0
    assert ingest.pages == 0


@pytest.mark.asyncio
async def test_stream_runner_pauses_without_provider_io_when_stored_credential_cannot_decrypt() -> None:
    service, adapter, states, credentials, ingest = _service([], decrypt_failure=True)

    result = await service.run_stream(states.state.id, "worker-a", NOW)

    assert result.error_code == "invalid_credentials"
    assert adapter.calls == []
    assert credentials.decrypt_calls == 1
    assert ingest.pages == 0
    assert states.failed == ["invalid_credentials"]


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values


class _QueryResult:
    def __init__(self, value: object | None = None, values: list[object] | None = None) -> None:
        self.value = value
        self.values = values or []

    def scalar_one_or_none(self) -> object | None:
        return self.value

    def scalars(self) -> _Scalars:
        return _Scalars(self.values)


class _ManualSession:
    def __init__(self, account: MarketplaceAccount, states: list[MarketplaceSyncState]) -> None:
        self.account = account
        self.states = states
        self.added: list[object] = []
        self.commit_count = 0

    async def execute(self, statement: object) -> _QueryResult:
        descriptions = cast(Select[tuple[object]], statement).column_descriptions
        entity = descriptions[0].get("entity")
        if entity is MarketplaceAccount:
            return _QueryResult(self.account)
        if entity is MarketplaceSyncState:
            return _QueryResult(values=list(self.states))
        raise AssertionError(f"unexpected select entity: {entity}")

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        self.commit_count += 1


class _ManualRegistry:
    def capability(self, marketplace: Marketplace) -> object:
        assert marketplace is Marketplace.WILDBERRIES
        return WILDBERRIES_CAPABILITY

    def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> object:
        assert marketplace is Marketplace.WILDBERRIES
        assert stream in {MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}
        return object()


class _Runner:
    def __init__(self) -> None:
        self.calls: list[tuple[object, str]] = []

    async def run_stream(self, state_id: UUID, owner: str, now: datetime) -> StreamRunResult:
        self.calls.append((state_id, owner))
        stream = MarketplaceStream.REVIEWS if len(self.calls) == 1 else MarketplaceStream.QUESTIONS
        return StreamRunResult(
            state_id=state_id,
            stream=stream,
            acquired=True,
            completed=True,
            created_messages=1,
        )


class _ContendedRunner:
    def __init__(self, states: list[MarketplaceSyncState], *, every_stream: bool) -> None:
        self.calls: list[tuple[UUID, str]] = []
        self.stream_by_state_id = {state.id: MarketplaceStream(state.stream) for state in states}
        self.every_stream = every_stream

    async def run_stream(self, state_id: UUID, owner: str, now: datetime) -> StreamRunResult:
        skipped = self.every_stream or not self.calls
        self.calls.append((state_id, owner))
        return StreamRunResult(
            state_id=state_id,
            stream=None if skipped else self.stream_by_state_id[state_id],
            acquired=not skipped,
            completed=not skipped,
            created_messages=0 if skipped else 1,
        )


@pytest.mark.asyncio
async def test_manual_sync_routes_every_supported_stream_through_the_common_runner() -> None:
    account = _account()
    states = [
        MarketplaceSyncState(
            id=uuid4(),
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            stream=stream.value,
            status=SyncStateStatus.IDLE.value,
            metadata_json={},
            consecutive_failures=0,
        )
        for stream in (MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS)
    ]
    session = _ManualSession(account, states)
    runner = _Runner()
    service = MarketplaceSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _ManualRegistry()),
        runner=cast(ScheduledSyncService, runner),
    )
    actor = User(id=uuid4(), email="synthetic@example.com", password_hash="hash", status="active")

    result = await service.request_sync(
        actor=actor,
        account_id=account.id,
    )

    assert result.account is account
    assert result.stats.imported_reviews == 1
    assert result.stats.imported_questions == 1
    assert result.status == "success"
    assert result.error_code is None
    assert {call[0] for call in runner.calls} == {state.id for state in states}
    assert len({call[1] for call in runner.calls}) == 1
    assert session.commit_count >= 1


@pytest.mark.asyncio
@pytest.mark.parametrize("every_stream, expected_job_status", [(True, "skipped"), (False, "partial")])
async def test_manual_sync_does_not_report_a_lease_contended_stream_as_success(
    every_stream: bool,
    expected_job_status: str,
) -> None:
    account = _account()
    previous_success = NOW - timedelta(days=1)
    account.last_success_sync_at = previous_success
    account.error_count = 0
    states = [
        MarketplaceSyncState(
            id=uuid4(),
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            stream=stream.value,
            status=SyncStateStatus.IDLE.value,
            metadata_json={},
            consecutive_failures=0,
        )
        for stream in (MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS)
    ]
    session = _ManualSession(account, states)
    runner = _ContendedRunner(states, every_stream=every_stream)
    service = MarketplaceSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _ManualRegistry()),
        runner=cast(ScheduledSyncService, runner),
    )
    actor = User(id=uuid4(), email="synthetic@example.com", password_hash="hash", status="active")

    result = await service.request_sync(actor=actor, account_id=account.id)

    job = next(item for item in session.added if isinstance(item, SyncJob))
    events = [item for item in session.added if isinstance(item, IntegrationEvent)]
    assert result.status == "in_progress"
    assert result.error_code == "sync_in_progress"
    assert result.error_message_safe == "Another marketplace synchronization is already in progress"
    assert job.status == expected_job_status
    assert account.last_success_sync_at == previous_success
    assert account.last_error_sync_at is None
    assert account.error_count == 0
    assert result.stats.skipped == (2 if every_stream else 1)
    assert {(event.event_type, event.status) for event in events} == (
        {("sync.reviews", "skipped"), ("sync.questions", "skipped")}
        if every_stream
        else {("sync.questions", "skipped"), ("sync.reviews", "success")}
    )


class _IncompleteRunner(_ContendedRunner):
    def __init__(self, states: list[MarketplaceSyncState]) -> None:
        super().__init__(states, every_stream=False)

    async def run_stream(self, state_id: UUID, owner: str, now: datetime) -> StreamRunResult:
        self.calls.append((state_id, owner))
        return StreamRunResult(
            state_id=state_id,
            stream=self.stream_by_state_id[state_id],
            acquired=True,
            completed=len(self.calls) > 1,
            created_messages=1,
        )


@pytest.mark.asyncio
async def test_manual_sync_preserves_success_timestamp_when_a_stream_needs_another_batch() -> None:
    account = _account()
    previous_success = NOW - timedelta(days=1)
    account.last_success_sync_at = previous_success
    states = [
        MarketplaceSyncState(
            id=uuid4(),
            organization_id=account.organization_id,
            marketplace_account_id=account.id,
            stream=stream.value,
            status=SyncStateStatus.IDLE.value,
            metadata_json={},
            consecutive_failures=0,
        )
        for stream in (MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS)
    ]
    session = _ManualSession(account, states)
    runner = _IncompleteRunner(states)
    service = MarketplaceSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _ManualRegistry()),
        runner=cast(ScheduledSyncService, runner),
    )
    actor = User(id=uuid4(), email="synthetic@example.com", password_hash="hash", status="active")

    result = await service.request_sync(actor=actor, account_id=account.id)

    job = next(item for item in session.added if isinstance(item, SyncJob))
    events = [item for item in session.added if isinstance(item, IntegrationEvent)]
    assert result.status == "partial"
    assert result.error_code is None
    assert result.stats.imported_reviews == 1
    assert result.stats.imported_questions == 1
    assert job.status == "partial"
    assert account.last_success_sync_at == previous_success
    assert {(event.event_type, event.status) for event in events} == {
        ("sync.questions", "partial"),
        ("sync.reviews", "success"),
    }


class _AvitoReviewOnlySession(_ManualSession):
    def __init__(self, account: MarketplaceAccount) -> None:
        super().__init__(account, [])
        self.inserted_streams: list[str] = []

    async def execute(self, statement: object) -> _QueryResult:
        if isinstance(statement, Insert):
            params = statement.compile().params
            stream = params["stream"]
            assert isinstance(stream, str)
            self.inserted_streams.append(stream)
            state = _state(self.account)
            state.stream = stream
            self.states.append(state)
            return _QueryResult()
        return await super().execute(statement)


class _AvitoRegistry:
    def capability(self, marketplace: Marketplace) -> object:
        assert marketplace is Marketplace.AVITO
        return AVITO_CAPABILITY

    def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> object:
        assert marketplace is Marketplace.AVITO
        assert stream is MarketplaceStream.REVIEWS
        return object()

    def conversations(self, marketplace: Marketplace) -> object:
        assert marketplace is Marketplace.AVITO
        return object()


@pytest.mark.asyncio
async def test_avito_reviews_only_manual_sync_creates_no_chat_state() -> None:
    account = _account()
    account.marketplace = Marketplace.AVITO.value
    account.seller_id = None
    account.scopes_json = {"scopes": ["reviews:read", "reviews:write"], "write_verification": "not_probed"}
    session = _AvitoReviewOnlySession(account)
    runner = _Runner()
    service = MarketplaceSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _AvitoRegistry()),
        runner=cast(ScheduledSyncService, runner),
    )
    actor = User(id=uuid4(), email="synthetic@example.com", password_hash="hash", status="active")

    result = await service.request_sync(actor=actor, account_id=account.id)

    assert result.error_code is None
    assert result.stats.imported_reviews == 1
    assert result.stats.imported_chats == 0
    assert session.inserted_streams == ["reviews"]
    assert [state.stream for state in session.states] == ["reviews"]
    assert len(runner.calls) == 1
