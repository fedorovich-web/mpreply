from __future__ import annotations

from collections.abc import Callable
from types import SimpleNamespace
from typing import ClassVar, cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import app.services.sync_service as sync_module
from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.adapters.capabilities import MarketplaceCapability
from app.adapters.conversation import ConversationAdapter
from app.core.security import CredentialService
from app.models.enums import Marketplace, MarketplaceSyncStream, MessageType
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.avito_chat_sync_service import AvitoChatSyncResult
from app.services.marketplace_ingest_service import MarketplaceMessageIngestService
from app.services.organization_service import OrganizationService
from app.services.sync_service import MarketplaceSyncService, StreamSyncOutcome, SyncStats


class _FakeAdapter(MarketplaceAdapter):
    marketplace = "ozon"

    def __init__(self, *, review_pages: list[AdapterResult], question_pages: list[AdapterResult] | None = None) -> None:
        self.review_pages = list(review_pages)
        self.question_pages = list(question_pages or [])
        self.calls: list[tuple[str, str | None]] = []

    async def validate_credentials(
        self, credential: str, seller_id: str | None = None
    ) -> AdapterResult:
        return AdapterResult(ok=True)

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        self.calls.append(("reviews", cursor))
        return self.review_pages.pop(0)

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        self.calls.append(("questions", cursor))
        if not self.question_pages:
            raise AssertionError("questions stream must not be called")
        return self.question_pages.pop(0)

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return cast(list[dict[str, object]], payload or [])

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return cast(list[dict[str, object]], payload or [])

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    async def get_review(self, credential: str, external_id: str) -> AdapterResult:
        return AdapterResult(ok=True)

    async def get_question(self, credential: str, external_id: str) -> AdapterResult:
        return AdapterResult(ok=True)

    def is_already_answered(self, payload: object) -> bool:
        return False

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        return AdapterResult(ok=True)

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        return AdapterResult(ok=True)

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        return AdapterResult(ok=True, data={"answered": False})

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        return AdapterResult(ok=False, error_code="mapped")


class _FakeIngest:
    def __init__(self) -> None:
        self.external_ids: list[str] = []

    async def upsert_normalized_message(
        self,
        _account: MarketplaceAccount,
        normalized: dict[str, object],
    ) -> str:
        self.external_ids.append(cast(str, normalized["external_id"]))
        return "created"


class _FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.flush_count = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1

    async def commit(self) -> None:
        return None


class _FakeAudit:
    async def write(self, **_kwargs: object) -> None:
        return None


class _FakeOrganizationService:
    async def require_membership_role(self, **_kwargs: object) -> None:
        return None


class _ManagerOrganizationService:
    async def require_membership_role(self, *, allowed_roles: set[str], **_kwargs: object) -> None:
        if "manager" not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action")


class _FakeCredentials:
    def __init__(self) -> None:
        self.calls = 0

    def decrypt(self, value: str) -> str:
        self.calls += 1
        assert value == "encrypted"
        return "credential"


class _SyncHarness(MarketplaceSyncService):
    def __init__(
        self,
        *,
        account: MarketplaceAccount,
        adapter: MarketplaceAdapter,
        chat_state: MarketplaceSyncState | None = None,
    ) -> None:
        self.session = cast(AsyncSession, _FakeSession())
        self.organization_service = cast(OrganizationService, _FakeOrganizationService())
        self.audit = cast(AuditService, _FakeAudit())
        self.ingest = cast(MarketplaceMessageIngestService, _FakeIngest())
        self.credentials = cast(CredentialService, _FakeCredentials())
        self._account = account
        self._adapter = adapter
        self._chat_state = chat_state
        self.events: list[dict[str, object]] = []

    @property
    def account(self) -> MarketplaceAccount:
        return self._account

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        del account_id
        return self._account

    def _adapter_for(self, marketplace: str) -> MarketplaceAdapter:
        del marketplace
        return self._adapter

    async def _get_chat_sync_state(self, account: MarketplaceAccount) -> MarketplaceSyncState:
        assert self._chat_state is not None
        assert account is self._account
        return self._chat_state

    async def sync_stream_pages_for_test(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        stream: MarketplaceSyncStream,
        stats: SyncStats,
    ) -> StreamSyncOutcome:
        return await self._sync_stream_pages(
            account=self._account,
            adapter=adapter,
            credential=credential,
            stream=stream,
            stats=stats,
        )

    async def _write_integration_event(
        self,
        *,
        account: MarketplaceAccount,
        event_type: str,
        status: str,
        error_code: str | None = None,
        error_message_safe: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> IntegrationEvent:
        self.events.append(
            {
                "account": account,
                "event_type": event_type,
                "status": status,
                "error_code": error_code,
                "error_message_safe": error_message_safe,
                "metadata": metadata,
            }
        )
        return cast(IntegrationEvent, SimpleNamespace())


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
            "scopes": [
                "fetch_reviews",
                "send_review_reply",
                "fetch_questions",
                "send_question_reply",
            ],
        },
        default_response_mode="inherit",
        error_count=0,
    )


def _review(external_id: str) -> dict[str, object]:
    return {
        "external_id": external_id,
        "type": MessageType.REVIEW.value,
        "status": "needs_reply",
        "customer_text": "text",
        "marketplace_created_at": None,
        "product": {"external_id": f"product-{external_id}"},
    }


@pytest.mark.asyncio
async def test_manual_avito_sync_rejects_manager_before_credential_decrypt() -> None:
    account = _account()
    account.marketplace = Marketplace.AVITO.value
    service = _SyncHarness(account=account, adapter=_FakeConversationAdapter())
    service.organization_service = cast(OrganizationService, _ManagerOrganizationService())
    actor = cast(User, SimpleNamespace(id=uuid4()))

    with pytest.raises(HTTPException) as exc_info:
        await service.sync_account(actor=actor, account_id=account.id)

    assert exc_info.value.status_code == 403
    assert cast(_FakeCredentials, service.credentials).calls == 0
    assert cast(_FakeSession, service.session).added == []


def _capability_lookup(
    capability: MarketplaceCapability,
) -> Callable[[Marketplace | str], MarketplaceCapability]:
    def get_capability(_marketplace: Marketplace | str) -> MarketplaceCapability:
        return capability

    return get_capability


def _reviews_only_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=("validate", "fetch_reviews", "send_review_reply"),
        message_types=(MessageType.REVIEW,),
        polling_enabled=True,
        pagination_strategy="page_token",
        notes="test fixture",
    )


@pytest.mark.asyncio
async def test_manual_sync_follows_all_pages_and_skips_unsupported_stream(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter = _FakeAdapter(
        review_pages=[
            AdapterResult(ok=True, data=[_review("r1")], next_cursor="page-2"),
            AdapterResult(ok=True, data=[_review("r2")], next_cursor=None),
        ]
    )
    account = _account()
    service = _SyncHarness(account=account, adapter=adapter)
    monkeypatch.setattr(sync_module, "get_marketplace_capability", _capability_lookup(_reviews_only_capability()))
    actor = cast(User, SimpleNamespace(id=uuid4()))

    result_account, stats, error_code, error_message = await service.sync_account(actor=actor, account_id=account.id)

    assert result_account is account
    assert error_code is None
    assert error_message is None
    assert adapter.calls == [("reviews", None), ("reviews", "page-2")]
    assert stats.imported_reviews == 2
    assert cast(_FakeIngest, service.ingest).external_ids == ["r1", "r2"]
    assert service.events[-1]["event_type"] == "sync.feedbacks"
    assert service.events[-1]["status"] == "success"
    assert service.events[-1]["metadata"] == {"count": 2, "pages_processed": 2}


@pytest.mark.asyncio
async def test_manual_sync_fails_closed_on_repeated_cursor() -> None:
    adapter = _FakeAdapter(
        review_pages=[
            AdapterResult(ok=True, data=[_review("r1")], next_cursor="page-2"),
            AdapterResult(ok=True, data=[_review("r2")], next_cursor="page-2"),
        ]
    )
    service = _SyncHarness(account=_account(), adapter=adapter)
    stats = SyncStats()

    outcome = await service.sync_stream_pages_for_test(
        adapter=adapter,
        credential="credential",
        stream=MarketplaceSyncStream.REVIEWS,
        stats=stats,
    )

    assert outcome == StreamSyncOutcome(
        error_code="sync_cursor_cycle",
        error_message_safe="Marketplace pagination cursor repeated",
    )
    assert adapter.calls == [("reviews", None), ("reviews", "page-2")]
    assert stats.imported_reviews == 2
    assert service.events[-1]["status"] == "failed"
    assert service.events[-1]["error_code"] == "sync_cursor_cycle"


@pytest.mark.asyncio
async def test_manual_sync_fails_closed_at_safe_page_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sync_module, "_MAX_MANUAL_SYNC_PAGES_PER_STREAM", 2)
    adapter = _FakeAdapter(
        review_pages=[
            AdapterResult(ok=True, data=[_review("r1")], next_cursor="page-2"),
            AdapterResult(ok=True, data=[_review("r2")], next_cursor="page-3"),
        ]
    )
    service = _SyncHarness(account=_account(), adapter=adapter)

    outcome = await service.sync_stream_pages_for_test(
        adapter=adapter,
        credential="credential",
        stream=MarketplaceSyncStream.REVIEWS,
        stats=SyncStats(),
    )

    assert outcome.error_code == "sync_page_limit_exceeded"
    assert adapter.calls == [("reviews", None), ("reviews", "page-2")]
    assert service.events[-1]["metadata"] == {"pages_processed": 2, "cursor": "page-3"}


def _questions_only_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=("validate", "fetch_questions", "send_question_reply"),
        message_types=(MessageType.QUESTION,),
        polling_enabled=True,
        pagination_strategy="page_token",
        notes="test fixture",
    )


def _reviews_and_questions_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=("validate", "fetch_reviews", "fetch_questions"),
        message_types=(MessageType.REVIEW, MessageType.QUESTION),
        polling_enabled=True,
        pagination_strategy="page_token",
        notes="test fixture",
    )


def _question(external_id: str) -> dict[str, object]:
    return {
        "external_id": external_id,
        "type": MessageType.QUESTION.value,
        "status": "needs_reply",
        "customer_text": "question",
        "marketplace_created_at": None,
        "product": {"external_id": f"product-{external_id}"},
    }


@pytest.mark.asyncio
async def test_manual_sync_dispatches_questions_only_capability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter = _FakeAdapter(
        review_pages=[],
        question_pages=[AdapterResult(ok=True, data=[_question("q1")], next_cursor=None)],
    )
    account = _account()
    service = _SyncHarness(account=account, adapter=adapter)
    monkeypatch.setattr(sync_module, "get_marketplace_capability", _capability_lookup(_questions_only_capability()))
    actor = cast(User, SimpleNamespace(id=uuid4()))

    _result_account, stats, error_code, error_message = await service.sync_account(actor=actor, account_id=account.id)

    assert error_code is None
    assert error_message is None
    assert adapter.calls == [("questions", None)]
    assert stats.imported_questions == 1
    assert cast(_FakeIngest, service.ingest).external_ids == ["q1"]
    assert service.events[-1]["event_type"] == "sync.questions"
    assert service.events[-1]["status"] == "success"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("scopes", "review_pages", "question_pages", "expected_calls"),
    [
        (
            ["fetch_reviews", "send_review_reply"],
            [AdapterResult(ok=True, data=[_review("r1")], next_cursor=None)],
            [],
            [("reviews", None)],
        ),
        (
            ["fetch_questions", "send_question_reply"],
            [],
            [AdapterResult(ok=True, data=[_question("q1")], next_cursor=None)],
            [("questions", None)],
        ),
    ],
)
async def test_manual_sync_ozon_uses_only_validated_account_streams(
    scopes: list[str],
    review_pages: list[AdapterResult],
    question_pages: list[AdapterResult],
    expected_calls: list[tuple[str, None]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    account.scopes_json = {"validated": True, "scopes": scopes}
    adapter = _FakeAdapter(review_pages=review_pages, question_pages=question_pages)
    service = _SyncHarness(account=account, adapter=adapter)
    monkeypatch.setattr(
        sync_module,
        "get_marketplace_capability",
        _capability_lookup(_reviews_and_questions_capability()),
    )

    _result_account, _stats, error_code, error_message = await service.sync_account(
        actor=cast(User, SimpleNamespace(id=uuid4())),
        account_id=account.id,
    )

    assert error_code is None
    assert error_message is None
    assert adapter.calls == expected_calls


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "scopes_json",
    [
        {},
        {"validated": True, "scopes": ["fetch_reviews"]},
    ],
)
async def test_manual_sync_ozon_rejects_unvalidated_or_unsupported_stream_before_decrypt(
    scopes_json: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    account.scopes_json = scopes_json
    adapter = _FakeAdapter(review_pages=[])
    service = _SyncHarness(account=account, adapter=adapter)
    monkeypatch.setattr(
        sync_module,
        "get_marketplace_capability",
        _capability_lookup(_reviews_and_questions_capability()),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.sync_account(actor=cast(User, SimpleNamespace(id=uuid4())), account_id=account.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Marketplace account does not have a validated message sync stream"
    assert cast(_FakeCredentials, service.credentials).calls == 0
    assert adapter.calls == []
    assert cast(_FakeSession, service.session).added == []


@pytest.mark.asyncio
async def test_manual_sync_preserves_successful_stream_when_other_stream_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter = _FakeAdapter(
        review_pages=[
            AdapterResult(
                ok=False,
                error_code="rate_limited",
                error_message_safe="Marketplace rate limit reached",
            )
        ],
        question_pages=[AdapterResult(ok=True, data=[_question("q1")], next_cursor=None)],
    )
    account = _account()
    service = _SyncHarness(account=account, adapter=adapter)
    monkeypatch.setattr(
        sync_module,
        "get_marketplace_capability",
        _capability_lookup(_reviews_and_questions_capability()),
    )
    actor = cast(User, SimpleNamespace(id=uuid4()))

    _result_account, stats, error_code, error_message = await service.sync_account(actor=actor, account_id=account.id)

    assert adapter.calls == [("reviews", None), ("questions", None)]
    assert stats.imported_reviews == 0
    assert stats.imported_questions == 1
    assert error_code == "rate_limited"
    assert error_message == "Marketplace rate limit reached"
    assert [event["status"] for event in service.events[-2:]] == ["failed", "success"]
    assert cast(_FakeIngest, service.ingest).external_ids == ["q1"]


def _validation_only_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.OZON,
        integration_status="enabled",
        operations=("validate",),
        message_types=(),
        polling_enabled=True,
        pagination_strategy="none",
        notes="test fixture",
    )


@pytest.mark.asyncio
async def test_manual_sync_rejects_capability_without_sync_streams(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    service = _SyncHarness(account=account, adapter=_FakeAdapter(review_pages=[]))
    monkeypatch.setattr(sync_module, "get_marketplace_capability", _capability_lookup(_validation_only_capability()))
    actor = cast(User, SimpleNamespace(id=uuid4()))

    with pytest.raises(HTTPException) as exc_info:
        await service.sync_account(actor=actor, account_id=account.id)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Marketplace does not support message sync"
    assert cast(_FakeSession, service.session).added == []


class _FakeConversationAdapter(_FakeAdapter):
    marketplace = "avito"

    def __init__(self) -> None:
        super().__init__(review_pages=[])

    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult:
        raise AssertionError("dedicated chat sync service owns polling")

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult:
        raise AssertionError("dedicated chat sync service owns polling")

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult:
        raise AssertionError("dedicated chat sync service owns read state")

    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult:
        raise AssertionError("not used by inbound sync")

    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult:
        raise AssertionError("not used by inbound sync")


class _ManualChatSync:
    calls: ClassVar[list[dict[str, object]]] = []

    def __init__(self, _session: AsyncSession, *, adapter: ConversationAdapter) -> None:
        assert isinstance(adapter, ConversationAdapter)

    async def sync_batch(self, **kwargs: object) -> AvitoChatSyncResult:
        self.calls.append(kwargs)
        return AvitoChatSyncResult(status="success", created=2, updated=1, skipped=3)


def _avito_chat_capability() -> MarketplaceCapability:
    return MarketplaceCapability(
        marketplace=Marketplace.AVITO,
        integration_status="enabled",
        operations=("validate", "fetch_chats"),
        message_types=(MessageType.CHAT,),
        polling_enabled=True,
        pagination_strategy="offset",
        notes="test fixture",
    )


@pytest.mark.asyncio
async def test_manual_avito_sync_dispatches_only_to_chat_service_with_twenty_five_chat_cap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    account.marketplace = Marketplace.AVITO.value
    account.seller_id = "123456"
    account.scopes_json = {"validated": True, "scopes": ["fetch_chats"]}
    state = MarketplaceSyncState(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        stream=MarketplaceSyncStream.CHATS.value,
        status="idle",
        consecutive_failures=0,
        metadata_json={},
    )
    adapter = _FakeConversationAdapter()
    service = _SyncHarness(account=account, adapter=adapter, chat_state=state)
    _ManualChatSync.calls = []
    monkeypatch.setattr(
        sync_module,
        "get_marketplace_capability",
        _capability_lookup(_avito_chat_capability()),
    )
    monkeypatch.setattr(sync_module, "AvitoChatSyncService", _ManualChatSync)

    _account_result, stats, error_code, error_message = await service.sync_account(
        actor=cast(User, SimpleNamespace(id=uuid4())),
        account_id=account.id,
    )

    assert error_code is None
    assert error_message is None
    assert len(_ManualChatSync.calls) == 1
    assert _ManualChatSync.calls[0]["max_chats"] == 25
    assert _ManualChatSync.calls[0]["state"] is state
    assert adapter.calls == []
    assert stats.imported_chats == 2
    assert stats.updated_chats == 1
    assert stats.skipped == 3
