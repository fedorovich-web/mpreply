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


class _ContextCapturingAdapter(MarketplaceAdapter):
    marketplace = "ozon"

    def __init__(self, send_result: AdapterResult) -> None:
        self.send_result = send_result
        self.preflight_contexts: list[ProviderMessageContext | None] = []
        self.review_contexts: list[ProviderMessageContext | None] = []
        self.question_contexts: list[ProviderMessageContext | None] = []

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
        self.review_contexts.append(context)
        return self.send_result

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.question_contexts.append(context)
        return self.send_result

    @property
    def send_calls(self) -> int:
        return len(self.review_contexts) + len(self.question_contexts)

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.preflight_contexts.append(context)
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
        self.release_calls = 0
        self.reserve_calls = 0

    async def reserve_for_reply(self, **_: object) -> SimpleNamespace:
        self.reserve_calls += 1
        return SimpleNamespace(allowed=True, reason=None)

    async def release_for_reply(self, **_: object) -> None:
        self.release_calls += 1

    async def settle_for_reply(self, **_: object) -> None:
        return None


class _Audit:
    def __init__(self) -> None:
        self.actions: list[str] = []

    async def write(self, *, action: str, **_: object) -> None:
        self.actions.append(action)


class _Credentials:
    def decrypt(self, value: str) -> str:
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


def _reply() -> Reply:
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
            metadata_json={},
            created_by=None,
            sent_by=None,
            reply_text="Ответ",
        ),
    )


def _message(
    reply: Reply,
    *,
    marketplace: str = "ozon",
    message_type: str = "question",
) -> CustomerMessage:
    return cast(
        CustomerMessage,
        SimpleNamespace(
            id=reply.message_id,
            marketplace_account_id=uuid4(),
            marketplace=marketplace,
            type=message_type,
            external_id="question-1",
            status=MessageStatus.APPROVED.value,
            metadata_json={"ozon_sku": 646399170},
        ),
    )


def _account(message: CustomerMessage) -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=message.marketplace_account_id,
            marketplace=message.marketplace,
            seller_id="client-123",
            credentials_encrypted="credential",
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
async def test_non_yandex_execution_forwards_persisted_context_to_preflight_and_question_send(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _ContextCapturingAdapter(AdapterResult(ok=True, data={"marketplace_reply_id": "42"}))
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert reply.marketplace_reply_id == "42"
    assert adapter.preflight_contexts == [{"ozon_sku": 646399170}]
    assert adapter.question_contexts == [{"ozon_sku": 646399170}]


@pytest.mark.asyncio
async def test_execution_forwards_persisted_context_to_review_send(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply, message_type="review")
    adapter = _ContextCapturingAdapter(AdapterResult(ok=True, data={"marketplace_reply_id": "42"}))
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert reply.marketplace_reply_id == "42"
    assert adapter.preflight_contexts == [{"ozon_sku": 646399170}]
    assert adapter.review_contexts == [{"ozon_sku": 646399170}]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("marketplace", "message_type", "error_code"),
    [
        ("ozon", "question", "network_timeout"),
        ("ozon", "question", "network_error"),
        ("yandex_market", "review", "network_timeout"),
        ("yandex_market", "review", "network_error"),
    ],
)
async def test_ambiguous_send_requires_manual_review_without_resend(
    marketplace: str,
    message_type: str,
    error_code: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply, marketplace=marketplace, message_type=message_type)
    adapter = _ContextCapturingAdapter(AdapterResult(ok=False, error_code=error_code))
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)
    second_result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.retryable is False
    assert result.error_code == "outbound_send_ambiguous"
    assert reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert message.status == MessageStatus.NEEDS_MANUAL_CHECK.value
    assert service.entitlements.release_calls == 1
    marker = reply.metadata_json["outbound_send_ambiguity"]
    assert isinstance(marker, dict)
    assert marker["active"] is True
    assert marker["marketplace"] == marketplace
    assert marker["reason"] == error_code
    assert isinstance(marker["recorded_at"], str)
    assert service.integration_events[-1]["status"] == "blocked"
    assert service.audit.actions == ["manual_reply.outbound_send_ambiguous"]
    assert second_result.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_ozon_missing_stream_scope_blocks_before_entitlement_or_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply, message_type="question")
    account = _account(message)
    account.scopes_json = {"validated": True, "scopes": ["fetch_reviews", "send_review_reply"]}
    adapter = _ContextCapturingAdapter(AdapterResult(ok=True, data={"marketplace_reply_id": "answer-1"}))
    service = _ExecutionHarness(reply=reply, message=message, account=account)
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.BLOCKED.value
    assert result.error_code == "insufficient_scope"
    assert service.entitlements.reserve_calls == 0
    assert adapter.preflight_contexts == []
    assert adapter.send_calls == 0


@pytest.mark.asyncio
async def test_ozon_malformed_successful_send_response_requires_manual_review(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _ContextCapturingAdapter(AdapterResult(ok=False, error_code="malformed_payload"))
    service = _ExecutionHarness(reply=reply, message=message, account=_account(message))
    monkeypatch.setattr(reply_execution_service, "get_marketplace_adapter", _adapter_lookup(adapter))

    result = await service.execute_reply(reply_id=reply.id)

    assert result.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.retryable is False
    assert result.error_code == "outbound_send_ambiguous"
    assert adapter.send_calls == 1
