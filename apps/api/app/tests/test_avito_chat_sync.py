from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import ClassVar, cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.scheduled_sync_service as scheduled_module
from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.adapters.capabilities import MarketplaceCapability
from app.adapters.conversation import AvitoChat, AvitoMessage, ConversationAdapter
from app.core.config import Settings
from app.core.security import CredentialService
from app.models.enums import Marketplace, MarketplaceSyncStateStatus, MarketplaceSyncStream, MessageType
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.audit_service import AuditService
from app.services.avito_chat_ingest_service import AvitoChatIngestResult, AvitoChatIngestService
from app.services.avito_chat_sync_service import AvitoChatSyncResult, AvitoChatSyncService
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService


class _Session:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount] | None = None) -> None:
        self.row = row
        self.timeline: list[str] = []
        self.added: list[object] = []
        self.commit_count = 0
        self.fail_commit_at: int | None = None

    async def execute(self, _statement: object) -> _RowResult:
        if self.row is None:
            raise AssertionError("unexpected database query")
        return _RowResult(self.row)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.timeline.append("flush")

    async def commit(self) -> None:
        self.commit_count += 1
        self.timeline.append("commit")
        if self.fail_commit_at == self.commit_count:
            raise RuntimeError("synthetic commit failure")

    async def rollback(self) -> None:
        self.timeline.append("rollback")


class _RowResult:
    def __init__(self, row: tuple[MarketplaceSyncState, MarketplaceAccount]) -> None:
        self.row = row

    def first(self) -> tuple[MarketplaceSyncState, MarketplaceAccount]:
        return self.row


class _Adapter:
    def __init__(
        self,
        *,
        chat_pages: list[AdapterResult],
        message_pages: list[AdapterResult] | None = None,
        read_results: list[AdapterResult] | None = None,
        timeline: list[str] | None = None,
    ) -> None:
        self.chat_pages = list(chat_pages)
        self.message_pages = list(message_pages or [])
        self.read_results = list(read_results or [AdapterResult(ok=True, data={"ok": True})])
        self.chat_calls: list[tuple[bool, int, int]] = []
        self.message_calls: list[tuple[str, int, int]] = []
        self.read_calls = 0
        self.timeline = timeline

    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult:
        assert credential == "credential"
        assert user_id == "123456"
        self.chat_calls.append((unread_only, limit, offset))
        return self.chat_pages.pop(0)

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult:
        assert credential == "credential"
        assert user_id == "123456"
        self.message_calls.append((chat_id, limit, offset))
        return self.message_pages.pop(0)

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult:
        assert credential == "credential"
        assert user_id == "123456"
        assert chat_id
        self.read_calls += 1
        if self.timeline is not None:
            self.timeline.append("read")
        return self.read_results.pop(0)

    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult:
        raise AssertionError("not used by sync")

    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult:
        raise AssertionError("not used by sync")


class _Ingest:
    def __init__(self, results: list[AvitoChatIngestResult | Exception], timeline: list[str] | None = None) -> None:
        self.results = list(results)
        self.calls: list[tuple[AvitoChat, tuple[AvitoMessage, ...]]] = []
        self.timeline = timeline

    async def ingest_turn(
        self,
        *,
        account: MarketplaceAccount,
        chat: AvitoChat,
        messages: tuple[AvitoMessage, ...] | list[AvitoMessage],
    ) -> AvitoChatIngestResult:
        del account
        self.calls.append((chat, tuple(messages)))
        if self.timeline is not None:
            self.timeline.append("ingest")
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class _Audit:
    async def write(self, **_kwargs: object) -> None:
        return None


class _Credentials:
    def __init__(self) -> None:
        self.calls = 0

    def decrypt(self, _value: str) -> str:
        self.calls += 1
        return "credential"


def _account(*, status: str = "active", credentials_status: str = "valid") -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        display_name="Avito test",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        seller_id="123456",
        status=status,
        credentials_status=credentials_status,
        scopes_json={"validated": True, "scopes": ["fetch_chats"]},
        default_response_mode="inherit",
        error_count=0,
    )


def _state(account: MarketplaceAccount, metadata: dict[str, object] | None = None) -> MarketplaceSyncState:
    return MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream=MarketplaceSyncStream.CHATS.value,
        status=MarketplaceSyncStateStatus.LEASED.value,
        consecutive_failures=0,
        metadata_json=metadata or {},
    )


def _chat(chat_id: str = "chat-synthetic", *, updated: int = 1700000000) -> AvitoChat:
    return AvitoChat(
        id=chat_id,
        created_unix=1699999999,
        updated_unix=updated,
        chat_type="u2u",
        item_id=None,
        item_title=None,
        item_url=None,
        customer_id=42,
        customer_name="Synthetic buyer",
    )


def _message(index: int = 1, *, kind: str = "text") -> AvitoMessage:
    return AvitoMessage(
        id=f"message-{index}",
        author_id=42,
        created_unix=1700000000 + index,
        direction="in",
        is_read=False,
        read_unix=None,
        kind=kind,
        text="Synthetic text" if kind == "text" else None,
    )


def _service(
    session: _Session,
    adapter: _Adapter,
    ingest: _Ingest,
) -> AvitoChatSyncService:
    return AvitoChatSyncService(
        cast(AsyncSession, session),
        adapter=cast(ConversationAdapter, adapter),
        ingest=cast(AvitoChatIngestService, ingest),
    )


@pytest.mark.asyncio
async def test_message_pagination_uses_exact_offsets_and_fails_closed_at_documented_cap() -> None:
    account = _account()
    state = _state(account)
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat()])],
        message_pages=[AdapterResult(ok=True, data=[_message(i) for i in range(100)]) for _ in range(11)],
    )
    service = _service(_Session(), adapter, _Ingest([]))

    result = await service.sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result == AvitoChatSyncResult(
        status="paused",
        error_code="sync_page_limit_exceeded",
        retryable=False,
    )
    assert [offset for _chat_id, limit, offset in adapter.message_calls if limit == 100] == list(
        range(0, 1001, 100)
    )
    assert adapter.read_calls == 0


@pytest.mark.asyncio
async def test_ingestion_commits_before_read_and_resets_offset_after_successful_mutation() -> None:
    account = _account()
    state = _state(
        account,
        {
            "unrelated": {"keep": True},
            "avito_chat_sync": {"schema_version": 1, "chat_offset": 7, "skipped_chat_versions": {}},
        },
    )
    timeline: list[str] = []
    session = _Session()
    session.timeline = timeline
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat()])],
        message_pages=[
            AdapterResult(ok=True, data=[_message(i) for i in range(100)]),
            AdapterResult(ok=True, data=[_message(101)]),
        ],
        timeline=timeline,
    )
    ingest = _Ingest(
        [AvitoChatIngestResult(outcome="created", message_id=uuid4(), can_mark_read=True)],
        timeline,
    )

    result = await _service(session, adapter, ingest).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result == AvitoChatSyncResult(status="success", created=1, has_more=True)
    assert adapter.chat_calls == [(True, 100, 7)]
    assert [offset for _chat_id, _limit, offset in adapter.message_calls] == [0, 100]
    assert timeline.index("ingest") < timeline.index("commit") < timeline.index("read")
    assert state.metadata_json == {
        "unrelated": {"keep": True},
        "avito_chat_sync": {"schema_version": 1, "chat_offset": 0, "skipped_chat_versions": {}},
    }


@pytest.mark.asyncio
async def test_commit_failure_prevents_provider_read() -> None:
    account = _account()
    state = _state(account)
    session = _Session()
    session.fail_commit_at = 1
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat()])],
        message_pages=[AdapterResult(ok=True, data=[_message()])],
    )
    ingest = _Ingest([AvitoChatIngestResult(outcome="created", message_id=uuid4(), can_mark_read=True)])

    result = await _service(session, adapter, ingest).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result.status == "failed"
    assert result.error_code == "sync_commit_failed"
    assert result.retryable is True
    assert adapter.read_calls == 0
    assert session.timeline[-1] == "rollback"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("message_result", "ingest_result", "expected_code"),
    [
        (AdapterResult(ok=False, error_code="malformed_payload"), None, "malformed_payload"),
        (AdapterResult(ok=True, data=[_message()]), RuntimeError("synthetic ingest failure"), "sync_ingest_failed"),
    ],
)
async def test_malformed_or_failed_ingestion_never_marks_read(
    message_result: AdapterResult,
    ingest_result: Exception | None,
    expected_code: str,
) -> None:
    account = _account()
    state = _state(account)
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat()])],
        message_pages=[message_result],
    )
    ingest = _Ingest([] if ingest_result is None else [ingest_result])

    result = await _service(_Session(), adapter, ingest).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result.status == "failed"
    assert result.error_code == expected_code
    assert adapter.read_calls == 0


@pytest.mark.asyncio
async def test_unsupported_unread_content_is_checkpointed_without_read_and_changed_version_retries() -> None:
    account = _account()
    state = _state(account)
    unsupported = AvitoChatIngestResult(outcome="skipped", message_id=None, can_mark_read=False)
    first_adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat(updated=1700000000)])],
        message_pages=[AdapterResult(ok=True, data=[_message(kind="image")])],
    )

    first = await _service(_Session(), first_adapter, _Ingest([unsupported])).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert first == AvitoChatSyncResult(status="success", skipped=1, has_more=True)
    assert first_adapter.read_calls == 0
    assert state.metadata_json["avito_chat_sync"] == {
        "schema_version": 1,
        "chat_offset": 0,
        "skipped_chat_versions": {"chat-synthetic": 1700000000},
    }

    state.metadata_json = {
        "avito_chat_sync": {
            "schema_version": 1,
            "chat_offset": 0,
            "skipped_chat_versions": {"chat-synthetic": 1700000000},
        }
    }
    changed_adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat(updated=1700000001)])],
        message_pages=[AdapterResult(ok=True, data=[_message()])],
    )
    changed = await _service(
        _Session(),
        changed_adapter,
        _Ingest([AvitoChatIngestResult(outcome="updated", message_id=uuid4(), can_mark_read=True)]),
    ).sync_batch(account=account, credential="credential", state=state, max_chats=1)

    assert changed.status == "success"
    assert changed.updated == 1
    assert changed_adapter.message_calls == [("chat-synthetic", 100, 0)]
    assert changed_adapter.read_calls == 1


@pytest.mark.asyncio
async def test_known_unsupported_version_is_skipped_without_message_fetch_or_read() -> None:
    account = _account()
    state = _state(
        account,
        {
            "avito_chat_sync": {
                "schema_version": 1,
                "chat_offset": 0,
                "skipped_chat_versions": {"chat-synthetic": 1700000000},
            }
        },
    )
    adapter = _Adapter(chat_pages=[AdapterResult(ok=True, data=[_chat()])])

    result = await _service(_Session(), adapter, _Ingest([])).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result.skipped == 1
    assert adapter.message_calls == []
    assert adapter.read_calls == 0


@pytest.mark.asyncio
async def test_read_failure_keeps_durable_target_and_retryable_checkpoint() -> None:
    account = _account()
    state = _state(account, {"unrelated": "keep"})
    session = _Session()
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=[_chat()])],
        message_pages=[AdapterResult(ok=True, data=[_message()])],
        read_results=[AdapterResult(ok=False, error_code="network_error", error_message_safe="Network error")],
    )
    result = await _service(
        session,
        adapter,
        _Ingest([AvitoChatIngestResult(outcome="created", message_id=uuid4(), can_mark_read=True)]),
    ).sync_batch(account=account, credential="credential", state=state, max_chats=1)

    assert result.status == "failed"
    assert result.error_code == "network_error"
    assert result.retryable is True
    assert session.commit_count == 1
    assert state.metadata_json == {
        "unrelated": "keep",
        "avito_chat_sync": {"schema_version": 1, "chat_offset": 0, "skipped_chat_versions": {}},
    }


@pytest.mark.asyncio
async def test_invalid_checkpoint_pauses_without_provider_calls() -> None:
    account = _account()
    state = _state(
        account,
        {"avito_chat_sync": {"schema_version": 1, "chat_offset": True, "skipped_chat_versions": {}}},
    )
    adapter = _Adapter(chat_pages=[])

    result = await _service(_Session(), adapter, _Ingest([])).sync_batch(
        account=account, credential="credential", state=state, max_chats=1
    )

    assert result == AvitoChatSyncResult(
        status="paused",
        error_code="sync_pagination_checkpoint_invalid",
        retryable=False,
    )
    assert adapter.chat_calls == []


@pytest.mark.asyncio
async def test_completion_clears_only_avito_checkpoint() -> None:
    account = _account()
    state = _state(
        account,
        {
            "unrelated": {"keep": True},
            "avito_chat_sync": {"schema_version": 1, "chat_offset": 3, "skipped_chat_versions": {}},
        },
    )
    adapter = _Adapter(chat_pages=[AdapterResult(ok=True, data=[])])

    result = await _service(_Session(), adapter, _Ingest([])).sync_batch(
        account=account, credential="credential", state=state, max_chats=25
    )

    assert result == AvitoChatSyncResult(status="success")
    assert state.metadata_json == {"unrelated": {"keep": True}}


@pytest.mark.asyncio
async def test_manual_batch_processes_at_most_twenty_five_chats() -> None:
    account = _account()
    state = _state(account)
    chats = [_chat(f"chat-{index}", updated=1700000000 + index) for index in range(30)]
    adapter = _Adapter(
        chat_pages=[AdapterResult(ok=True, data=chats)],
        message_pages=[AdapterResult(ok=True, data=[_message(index, kind="image")]) for index in range(25)],
    )
    ingest = _Ingest(
        [AvitoChatIngestResult(outcome="skipped", message_id=None, can_mark_read=False) for _ in range(25)]
    )

    result = await _service(_Session(), adapter, ingest).sync_batch(
        account=account, credential="credential", state=state, max_chats=25
    )

    assert result.skipped == 25
    assert result.has_more is True
    assert len(ingest.calls) == 25
    checkpoint = cast(dict[str, object], state.metadata_json["avito_chat_sync"])
    assert checkpoint["chat_offset"] == 0


def _chats_capability(_marketplace: Marketplace | str) -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.AVITO,
        integration_status="enabled",
        operations=("validate", "fetch_chats"),
        message_types=(MessageType.CHAT,),
        polling_enabled=True,
        pagination_strategy="offset",
        notes="test fixture",
    )


def _adapter_lookup(
    adapter: MarketplaceAdapter,
) -> Callable[[Marketplace | str], MarketplaceAdapter]:
    def get_adapter(_marketplace: Marketplace | str) -> MarketplaceAdapter:
        return adapter

    return get_adapter


class _ScheduledChatSync:
    calls: ClassVar[list[int]] = []
    result: ClassVar[AvitoChatSyncResult] = AvitoChatSyncResult(
        status="success", created=1, has_more=True
    )

    def __init__(self, _session: AsyncSession, *, adapter: ConversationAdapter) -> None:
        del adapter

    async def sync_batch(self, **kwargs: object) -> AvitoChatSyncResult:
        self.calls.append(cast(int, kwargs["max_chats"]))
        return self.result


def _scheduled_service(
    session: _Session,
    credentials: _Credentials | None = None,
) -> ScheduledMarketplaceSyncService:
    service = object.__new__(ScheduledMarketplaceSyncService)
    service.session = cast(AsyncSession, session)
    service.audit = cast(AuditService, _Audit())
    service.ingest = cast(MarketplaceMessageIngestService, SimpleNamespace())
    service.settings = cast(Settings, SimpleNamespace(marketplace_sync_interval_seconds=300))
    service.credentials = cast(CredentialService, credentials or _Credentials())
    return service


@pytest.mark.asyncio
async def test_scheduled_chat_sync_processes_one_chat_and_schedules_one_second_continuation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    state = _state(account)
    lease_token = uuid4()
    state.lease_token = lease_token
    state.lease_expires_at = datetime.now(UTC) + timedelta(minutes=5)
    session = _Session((state, account))
    adapter = cast(MarketplaceAdapter, _Adapter(chat_pages=[]))
    _ScheduledChatSync.calls = []
    _ScheduledChatSync.result = AvitoChatSyncResult(status="success", created=1, has_more=True)
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _chats_capability)
    monkeypatch.setattr(scheduled_module, "get_marketplace_adapter", _adapter_lookup(adapter))
    monkeypatch.setattr(scheduled_module, "AvitoChatSyncService", _ScheduledChatSync)
    before = datetime.now(UTC)

    result = await _scheduled_service(session).execute(state_id=state.id, lease_token=lease_token)

    assert result.status == "success"
    assert _ScheduledChatSync.calls == [1]
    assert state.status == MarketplaceSyncStateStatus.IDLE.value
    assert state.lease_token is None
    assert state.next_run_at is not None
    assert before + timedelta(seconds=1) <= state.next_run_at <= datetime.now(UTC) + timedelta(seconds=1)
    safe_metadata = [
        value.metadata_json
        for value in session.added
        if isinstance(value, IntegrationEvent)
    ]
    assert safe_metadata
    assert all("chat" not in str(metadata).lower() and "message" not in str(metadata).lower() for metadata in safe_metadata)


@pytest.mark.asyncio
@pytest.mark.parametrize(("status", "credentials_status"), [("disabled", "valid"), ("active", "revoked")])
async def test_scheduled_chat_sync_pauses_before_decrypt_for_invalid_account(
    status: str,
    credentials_status: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account(status=status, credentials_status=credentials_status)
    state = _state(account)
    lease_token = uuid4()
    state.lease_token = lease_token
    state.lease_expires_at = datetime.now(UTC) + timedelta(minutes=5)
    credentials = _Credentials()
    monkeypatch.setattr(scheduled_module, "get_marketplace_capability", _chats_capability)

    result = await _scheduled_service(_Session((state, account)), credentials).execute(
        state_id=state.id, lease_token=lease_token
    )

    assert result.status == "paused"
    assert credentials.calls == 0
