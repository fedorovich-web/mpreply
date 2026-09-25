from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import TracebackType
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.adapters.base import (
    AdapterResult,
    ExistingReplyResult,
    ProviderMessageContext,
    ProviderWriteReceipt,
)
from app.adapters.capabilities import MarketplaceStream
from app.adapters.registry import MarketplaceAdapterRegistry
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus, ResponseMode
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.services.reply_execution_service import ReplyExecutionService

NOW = datetime(2026, 9, 12, 12, 0, tzinfo=UTC)


class _ScalarResult:
    def __init__(self, value: object | None) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object | None:
        return self.value


class _SharedRows:
    def __init__(self, reply: Reply, message: CustomerMessage, account: MarketplaceAccount) -> None:
        self.reply = reply
        self.message = message
        self.account = account
        self.lock = asyncio.Lock()


class _Transaction:
    def __init__(self, session: _Session) -> None:
        self.session = session

    async def __aenter__(self) -> None:
        assert self.session.in_transaction is False
        self.session.in_transaction = True

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.session.in_transaction = False
        self.session.release_lock()


class _Session:
    def __init__(self, rows: _SharedRows) -> None:
        self.rows = rows
        self.in_transaction = False
        self.commit_count = 0
        self.added: list[object] = []
        self._owns_lock = False

    def begin(self) -> _Transaction:
        return _Transaction(self)

    async def execute(self, statement: object) -> _ScalarResult:
        descriptions = cast(Select[tuple[object]], statement).column_descriptions
        entity = descriptions[0].get("entity")
        if entity is Reply:
            if getattr(statement, "_for_update_arg", None) is not None:
                await self.rows.lock.acquire()
                self._owns_lock = True
            return _ScalarResult(self.rows.reply)
        if entity is CustomerMessage:
            return _ScalarResult(self.rows.message)
        if entity is MarketplaceAccount:
            return _ScalarResult(self.rows.account)
        raise AssertionError(f"unexpected select entity: {entity}")

    async def commit(self) -> None:
        self.commit_count += 1
        self.in_transaction = False
        self.release_lock()

    async def flush(self) -> None:
        return None

    def add(self, value: object) -> None:
        self.added.append(value)

    def release_lock(self) -> None:
        if self._owns_lock:
            self._owns_lock = False
            self.rows.lock.release()


class _Credentials:
    def __init__(self, session: _Session, *, fail: bool = False) -> None:
        self.session = session
        self.fail = fail
        self.calls = 0

    def decrypt(self, encrypted: str) -> str:
        assert encrypted == "encrypted"
        assert self.session.in_transaction is False
        assert self.session.rows.reply.status == ReplyStatus.SENDING.value
        self.calls += 1
        if self.fail:
            raise CredentialEncryptionError("synthetic credential failure")
        return "synthetic-token"


class _Adapter:
    marketplace = Marketplace.WILDBERRIES

    def __init__(
        self,
        session: _Session,
        *,
        preflight: AdapterResult[ExistingReplyResult],
        send: AdapterResult[ProviderWriteReceipt],
        send_started: asyncio.Event | None = None,
        allow_send_to_finish: asyncio.Event | None = None,
    ) -> None:
        self.session = session
        self.preflight = preflight
        self.send = send
        self.send_started = send_started
        self.allow_send_to_finish = allow_send_to_finish
        self.preflight_calls = 0
        self.send_calls = 0

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        assert self.session.in_transaction is False
        assert credential == "synthetic-token"
        assert seller_id == "seller-label"
        assert context.external_id == "feedback-1"
        self.preflight_calls += 1
        return self.preflight

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        assert self.session.in_transaction is False
        assert credential == "synthetic-token"
        assert seller_id == "seller-label"
        assert context.external_id == "feedback-1"
        assert text == "Synthetic reply"
        self.send_calls += 1
        if self.send_started is not None:
            self.send_started.set()
        if self.allow_send_to_finish is not None:
            await self.allow_send_to_finish.wait()
        return self.send


class _Registry:
    def __init__(self, adapter: _Adapter) -> None:
        self.adapter = adapter

    def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> _Adapter:
        assert marketplace is Marketplace.WILDBERRIES
        expected_stream = MarketplaceStream.QUESTIONS if self.adapter.session.rows.message.type == MessageType.QUESTION.value else MarketplaceStream.REVIEWS
        assert stream is expected_stream
        return self.adapter


def _rows(message_type: MessageType = MessageType.REVIEW) -> _SharedRows:
    organization_id = uuid4()
    account_id = uuid4()
    message = CustomerMessage(
        id=uuid4(),
        organization_id=organization_id,
        marketplace_account_id=account_id,
        marketplace=Marketplace.WILDBERRIES.value,
        external_id="feedback-1",
        type=message_type.value,
        status=MessageStatus.APPROVED.value,
        customer_text="Synthetic customer text",
        marketplace_created_at=NOW,
        imported_at=NOW,
        last_synced_at=NOW,
        metadata_json={},
    )
    reply = Reply(
        id=uuid4(),
        organization_id=organization_id,
        message_id=message.id,
        reply_text="Synthetic reply",
        status=ReplyStatus.QUEUED.value,
        mode=ResponseMode.SEMI_AUTO.value,
        idempotency_key="synthetic-idempotency-key",
        attempt_count=0,
        max_attempts=4,
        metadata_json={},
    )
    account = MarketplaceAccount(
        id=account_id,
        organization_id=organization_id,
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
    return _SharedRows(reply, message, account)


def _service(
    rows: _SharedRows,
    *,
    preflight: AdapterResult[ExistingReplyResult],
    send: AdapterResult[ProviderWriteReceipt],
    send_started: asyncio.Event | None = None,
    allow_send_to_finish: asyncio.Event | None = None,
    credential_failure: bool = False,
) -> tuple[ReplyExecutionService, _Adapter, _Session]:
    session = _Session(rows)
    adapter = _Adapter(
        session,
        preflight=preflight,
        send=send,
        send_started=send_started,
        allow_send_to_finish=allow_send_to_finish,
    )
    service = ReplyExecutionService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _Registry(adapter)),
        credentials=cast(CredentialService, _Credentials(session, fail=credential_failure)),
    )
    return service, adapter, session


def _absent() -> AdapterResult[ExistingReplyResult]:
    return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))


@pytest.mark.asyncio
async def test_credential_decryption_failure_is_terminal_without_provider_io() -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
        credential_failure=True,
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.error_code == "invalid_credentials"
    assert result.retryable is False
    assert adapter.preflight_calls == 0
    assert adapter.send_calls == 0
    assert rows.reply.status == ReplyStatus.BLOCKED.value
    assert rows.message.status == MessageStatus.BLOCKED_BY_MARKETPLACE.value


@pytest.mark.asyncio
async def test_wildberries_timeout_after_send_is_not_automatically_retried() -> None:
    rows = _rows()
    service, adapter, session = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(
            False,
            error_code="network_timeout",
            error_message_safe="Wildberries write timed out",
        ),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert adapter.send_calls == 1
    assert result.retryable is False
    assert rows.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert rows.message.status == MessageStatus.NEEDS_MANUAL_CHECK.value
    assert rows.reply.metadata_json["provider_write_ambiguity"] == {
        "active": True,
        "attempt_count": 1,
        "error_code": "network_timeout",
    }
    assert session.commit_count >= 2


@pytest.mark.asyncio
async def test_expired_sending_attempt_requires_reconciliation_without_resending() -> None:
    rows = _rows()
    rows.reply.status = ReplyStatus.SENDING.value
    rows.reply.attempt_count = 1
    rows.reply.last_attempt_at = datetime(2020, 1, 1, tzinfo=UTC)
    rows.message.status = MessageStatus.SENDING.value
    service, adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.retryable is False
    assert adapter.preflight_calls == 0
    assert adapter.send_calls == 0
    assert rows.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert rows.reply.attempt_count == 1
    assert rows.reply.metadata_json["provider_write_ambiguity"] == {
        "active": True,
        "attempt_count": 1,
        "error_code": "network_error",
    }
    assert rows.message.status == MessageStatus.NEEDS_MANUAL_CHECK.value


@pytest.mark.asyncio
async def test_existing_wildberries_answer_converges_without_sending() -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows,
        preflight=AdapterResult(
            ok=True,
            data=ExistingReplyResult(exists=True, provider_reply_id="provider-answer-1", provider_state="accepted_unverified"),
        ),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.externally_already_answered is True
    assert rows.reply.status == ReplyStatus.SENT.value
    assert rows.reply.marketplace_reply_id == "provider-answer-1"
    assert rows.message.metadata_json["provider_publication"] == "unverified"
    assert adapter.send_calls == 0


@pytest.mark.asyncio
async def test_hidden_wildberries_question_answer_requires_manual_review() -> None:
    rows = _rows(MessageType.QUESTION)
    service, adapter, _ = _service(
        rows,
        preflight=AdapterResult(
            ok=True,
            data=ExistingReplyResult(exists=True, provider_reply_id="question-1", provider_state="not_public"),
        ),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.retryable is False
    assert rows.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert rows.message.status == MessageStatus.NEEDS_MANUAL_CHECK.value
    assert adapter.send_calls == 0


@pytest.mark.asyncio
async def test_preflight_read_retry_exhaustion_does_not_send() -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows,
        preflight=AdapterResult(
            False,
            error_code="network_timeout",
            error_message_safe="Wildberries request timed out",
        ),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert adapter.send_calls == 0
    assert result.retryable is True
    assert rows.reply.status == ReplyStatus.RETRY_PENDING.value
    assert rows.reply.error_code == "network_timeout"


@pytest.mark.parametrize("message_type", [MessageType.REVIEW, MessageType.QUESTION])
@pytest.mark.asyncio
async def test_strict_wildberries_success_receipt_marks_reply_sent(message_type: MessageType) -> None:
    rows = _rows(message_type)
    service, adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("provider-answer-1", provider_state="accepted_unverified")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.retryable is False
    assert rows.reply.status == ReplyStatus.SENT.value
    assert rows.reply.marketplace_reply_id == "provider-answer-1"
    assert rows.message.metadata_json["provider_publication"] == "unverified"
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_malformed_write_success_requires_manual_reconciliation() -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(
            False,
            error_code="malformed_payload",
            error_message_safe="Wildberries write success could not be proven",
        ),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.retryable is False
    assert rows.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_permanent_provider_rejection_is_terminal() -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(
            False,
            error_code="marketplace_validation_error",
            error_message_safe="Wildberries rejected the request",
        ),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.retryable is False
    assert rows.reply.status == ReplyStatus.FAILED.value
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_concurrent_execution_of_one_idempotency_key_sends_once() -> None:
    rows = _rows()
    send_started = asyncio.Event()
    allow_send_to_finish = asyncio.Event()
    first, first_adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("provider-answer-1")),
        send_started=send_started,
        allow_send_to_finish=allow_send_to_finish,
    )
    second, second_adapter, _ = _service(
        rows,
        preflight=_absent(),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("provider-answer-2")),
    )

    first_execution = asyncio.create_task(first.execute_reply(reply_id=rows.reply.id))
    await send_started.wait()
    second_result = await second.execute_reply(reply_id=rows.reply.id)
    allow_send_to_finish.set()
    first_result = await first_execution

    assert first_result.status == ReplyStatus.SENT.value
    assert second_result.error_code == "execution_in_progress"
    assert first_adapter.send_calls == 1
    assert second_adapter.send_calls == 0
