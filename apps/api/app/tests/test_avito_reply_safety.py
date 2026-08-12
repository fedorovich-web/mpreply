from __future__ import annotations

from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.models.customer_message import CustomerMessage
from app.models.enums import MessageStatus, ReplyStatus, ResponseMode
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.services import reply_execution_service
from app.services.reply_execution_service import ReplyExecutionService


class _AvitoConversationAdapter(MarketplaceAdapter):
    marketplace = "avito"

    def __init__(
        self,
        *,
        preflight_result: AdapterResult,
        send_result: AdapterResult,
    ) -> None:
        self.preflight_result = preflight_result
        self.send_result = send_result
        self.events: list[str] = []
        self.preflight_calls: list[tuple[str, str, str, int]] = []
        self.send_calls: list[tuple[str, str, str, str]] = []

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise AssertionError("not used")

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        raise AssertionError("not used")

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        raise AssertionError("not used")

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        raise AssertionError("not used")

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        raise AssertionError("not used")

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise AssertionError("Avito chat must not use review send")

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise AssertionError("Avito chat must not use question send")

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        raise AssertionError("Avito chat must not use generic preflight")

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult:
        raise AssertionError("not used")

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult:
        raise AssertionError("not used")

    async def has_existing_chat_reply(
        self,
        credential: str,
        user_id: str,
        *,
        chat_id: str,
        inbound_created_unix: int,
    ) -> AdapterResult:
        self.events.append("preflight")
        self.preflight_calls.append((credential, user_id, chat_id, inbound_created_unix))
        return self.preflight_result

    async def send_chat_message(
        self,
        credential: str,
        user_id: str,
        *,
        chat_id: str,
        text: str,
    ) -> AdapterResult:
        self.events.append("send")
        self.send_calls.append((credential, user_id, chat_id, text))
        return self.send_result


class _LegacyAdapter(MarketplaceAdapter):
    def __init__(self, marketplace: str) -> None:
        self.marketplace = marketplace
        self.preflight_calls = 0
        self.review_calls = 0
        self.question_calls = 0

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise AssertionError("not used")

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        raise AssertionError("not used")

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        raise AssertionError("not used")

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        raise AssertionError("not used")

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        raise AssertionError("not used")

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        raise AssertionError("not used")

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.review_calls += 1
        return AdapterResult(ok=True, data={"marketplace_reply_id": "legacy-review"})

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.question_calls += 1
        return AdapterResult(ok=True, data={"marketplace_reply_id": "legacy-question"})

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.preflight_calls += 1
        return AdapterResult(ok=True, data={"answered": False})

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise AssertionError("not used")


class _Session:
    def __init__(self) -> None:
        self.commit_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1

    def add(self, _: object) -> None:
        return None


class _Entitlements:
    def __init__(self) -> None:
        self.reserve_calls = 0
        self.release_calls = 0
        self.settle_calls = 0

    async def reserve_for_reply(self, **_: object) -> SimpleNamespace:
        self.reserve_calls += 1
        return SimpleNamespace(allowed=True, reason=None)

    async def release_for_reply(self, **_: object) -> None:
        self.release_calls += 1

    async def settle_for_reply(self, **_: object) -> None:
        self.settle_calls += 1


class _Audit:
    def __init__(self) -> None:
        self.actions: list[str] = []

    async def write(self, *, action: str, **_: object) -> None:
        self.actions.append(action)


class _Credentials:
    def __init__(self) -> None:
        self.calls = 0

    def decrypt(self, value: str) -> str:
        self.calls += 1
        return value


class _ExecutionHarness(ReplyExecutionService):
    def __init__(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        account: MarketplaceAccount,
    ) -> None:
        self.reply = reply
        self.message = message
        self.account = account
        self.session = _Session()
        self.entitlements = _Entitlements()
        self.audit = _Audit()
        self.credentials = _Credentials()
        self.integration_events: list[dict[str, object]] = []

    async def _get_reply_for_update(self, reply_id: UUID) -> Reply:
        assert reply_id == self.reply.id
        return self.reply

    async def _get_message(self, message_id: UUID) -> CustomerMessage:
        assert message_id == self.message.id
        return self.message

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        assert account_id == self.message.marketplace_account_id
        return self.account

    async def _write_integration_event(self, **kwargs: object) -> None:
        self.integration_events.append(kwargs)


def _reply(*, metadata: dict[str, object] | None = None) -> Reply:
    identifier = uuid4()
    return cast(
        Reply,
        SimpleNamespace(
            id=identifier,
            organization_id=uuid4(),
            message_id=uuid4(),
            status=ReplyStatus.QUEUED.value,
            mode=ResponseMode.SEMI_AUTO.value,
            attempt_count=0,
            max_attempts=4,
            last_attempt_at=None,
            next_retry_at=None,
            error_code=None,
            failed_reason=None,
            metadata_json=metadata or {},
            created_by=None,
            sent_by=None,
            reply_text="Synthetic reply",
            marketplace_reply_id=None,
            sent_at=None,
        ),
    )


def _message(
    reply: Reply,
    *,
    marketplace: str = "avito",
    message_type: str = "chat",
    metadata: dict[str, object] | None = None,
) -> CustomerMessage:
    return cast(
        CustomerMessage,
        SimpleNamespace(
            id=reply.message_id,
            marketplace_account_id=uuid4(),
            marketplace=marketplace,
            type=message_type,
            external_id="inbound-123",
            status=MessageStatus.APPROVED.value,
            metadata_json=metadata
            if metadata is not None
            else {
                "avito_chat_id": "chat-123",
                "avito_inbound_created_unix": 1_700_000_000,
            },
        ),
    )


def _account(
    message: CustomerMessage,
    *,
    status: str = "active",
    credentials_status: str = "valid",
) -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=message.marketplace_account_id,
            marketplace=message.marketplace,
            seller_id="123456",
            credentials_encrypted="synthetic-access-token",
            status=status,
            credentials_status=credentials_status,
            scopes_json={
                "validated": True,
                "scopes": [
                    "fetch_reviews",
                    "send_review_reply",
                    "fetch_questions",
                    "send_question_reply",
                ],
            },
        ),
    )


def _adapter_lookup(adapter: MarketplaceAdapter):
    def lookup(_: str) -> MarketplaceAdapter:
        return adapter

    return lookup


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "credentials_status"),
    [("disabled", "valid"), ("active", "revoked")],
)
async def test_avito_account_must_be_active_and_valid_before_entitlement_or_provider(
    status: str,
    credentials_status: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    account = _account(message, status=status, credentials_status=credentials_status)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "out-1"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=account)
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.BLOCKED.value
    assert result.error_code == "invalid_credentials"
    assert service.entitlements.reserve_calls == 0
    assert service.credentials.calls == 0
    assert adapter.events == []


@pytest.mark.asyncio
async def test_avito_preflight_precedes_send_and_provider_id_is_persisted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    original_metadata = dict(message.metadata_json)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "outbound-123"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert adapter.events == ["preflight", "send"]
    assert adapter.preflight_calls == [
        ("synthetic-access-token", "123456", "chat-123", 1_700_000_000)
    ]
    assert adapter.send_calls == [
        ("synthetic-access-token", "123456", "chat-123", "Synthetic reply")
    ]
    assert message.metadata_json == original_metadata
    assert reply.marketplace_reply_id == "outbound-123"
    assert service.entitlements.settle_calls == 1


@pytest.mark.asyncio
async def test_avito_later_outbound_message_blocks_send_without_settling_entitlement(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": True}),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "must-not-send"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.externally_already_answered is True
    assert reply.status == ReplyStatus.SENT.value
    assert adapter.events == ["preflight"]
    assert service.entitlements.release_calls == 1
    assert service.entitlements.settle_calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("metadata", [{}, {"avito_chat_id": "chat-123"}, {"avito_chat_id": "chat-123", "avito_inbound_created_unix": True}])
async def test_avito_missing_or_malformed_reply_metadata_fails_closed(
    metadata: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply, metadata=metadata)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "must-not-send"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.retryable is False
    assert result.error_code == "invalid_chat_context"
    assert adapter.events == []
    assert service.entitlements.settle_calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("error_code", ["network_timeout", "network_error", "malformed_payload"])
async def test_avito_ambiguous_post_send_outcome_requires_manual_review_without_resend(
    error_code: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=False, error_code=error_code),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    first = await service.execute_reply(reply_id=reply.id)
    second = await service.execute_reply(reply_id=reply.id)

    assert first.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert first.retryable is False
    assert first.error_code == "outbound_send_ambiguous"
    assert second.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert len(adapter.send_calls) == 1
    assert service.entitlements.release_calls == 1
    marker = reply.metadata_json["outbound_send_ambiguity"]
    assert isinstance(marker, dict)
    assert marker["active"] is True
    assert marker["marketplace"] == "avito"
    assert marker["reason"] == error_code


@pytest.mark.asyncio
async def test_active_avito_ambiguity_marker_blocks_requeued_execution_before_entitlement_or_send(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply(
        metadata={
            "outbound_send_ambiguity": {
                "active": True,
                "marketplace": "avito",
                "reason": "network_timeout",
            }
        }
    )
    message = _message(reply)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "must-not-send"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.error_code == "outbound_send_ambiguous"
    assert service.entitlements.reserve_calls == 0
    assert adapter.events == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("error_code", "expected_status"),
    [
        ("marketplace_validation_error", ReplyStatus.FAILED.value),
        ("invalid_credentials", ReplyStatus.BLOCKED.value),
        ("payment_required", ReplyStatus.FAILED.value),
        ("insufficient_scope", ReplyStatus.BLOCKED.value),
        ("marketplace_not_found", ReplyStatus.FAILED.value),
    ],
)
async def test_avito_deterministic_send_failures_are_terminal(
    error_code: str,
    expected_status: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=True, data={"answered": False}),
        send_result=AdapterResult(ok=False, error_code=error_code),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == expected_status
    assert result.retryable is False
    assert len(adapter.send_calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("error_code", ["rate_limited", "marketplace_unavailable"])
async def test_avito_retryable_read_only_preflight_failure_never_sends(
    error_code: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _AvitoConversationAdapter(
        preflight_result=AdapterResult(ok=False, error_code=error_code),
        send_result=AdapterResult(ok=True, data={"marketplace_reply_id": "must-not-send"}),
    )
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.RETRY_PENDING.value
    assert result.retryable is True
    assert adapter.events == ["preflight"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("marketplace", "message_type", "expected_review_calls", "expected_question_calls"),
    [
        ("wildberries", "review", 1, 0),
        ("ozon", "question", 0, 1),
        ("yandex_market", "review", 1, 0),
    ],
)
async def test_non_avito_dispatch_remains_on_existing_reply_methods(
    marketplace: str,
    message_type: str,
    expected_review_calls: int,
    expected_question_calls: int,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply, marketplace=marketplace, message_type=message_type, metadata={})
    adapter = _LegacyAdapter(marketplace)
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert adapter.preflight_calls == 1
    assert adapter.review_calls == expected_review_calls
    assert adapter.question_calls == expected_question_calls
