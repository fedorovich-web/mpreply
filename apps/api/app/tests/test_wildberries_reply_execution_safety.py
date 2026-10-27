from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta, tzinfo
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
from app.core.config import get_settings
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus, ResponseMode
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.reply import Reply
from app.models.user import User
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
        self.actor = User(id=uuid4(), email="synthetic@example.invalid", status="active", email_verified_at=NOW)
        self.organization = Organization(id=reply.organization_id, status="active")
        self.membership = OrganizationUser(organization_id=reply.organization_id, user_id=self.actor.id, role="manager", status="active")
        reply.created_by = self.actor.id
        reply.sent_by = self.actor.id
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
        self.owns_lock = False

    def begin(self) -> _Transaction:
        return _Transaction(self)

    async def execute(self, statement: object) -> _ScalarResult:
        descriptions = cast(Select[tuple[object]], statement).column_descriptions
        entity = descriptions[0].get("entity")
        if entity is Reply:
            if getattr(statement, "_for_update_arg", None) is not None:
                await self.rows.lock.acquire()
                self.owns_lock = True
            params = cast(Select[tuple[object]], statement).compile().params
            for field in ("status", "attempt_count", "idempotency_key"):
                if f"{field}_1" in params and getattr(self.rows.reply, field) != params[f"{field}_1"]:
                    return _ScalarResult(None)
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

    async def scalar(self, statement: object) -> object | None:
        query = cast(Select[tuple[object]], statement)
        entity = query.column_descriptions[0].get("entity")
        if entity is User:
            rows = self.rows
            params = query.compile().params
            return rows.actor.id if (
                rows.actor.id == params["id_1"] and rows.actor.status == "active" and rows.actor.email_verified_at is not None
                and rows.membership.user_id == rows.actor.id and rows.membership.organization_id == rows.reply.organization_id
                and rows.membership.status == "active" and rows.membership.role in {"owner", "admin", "manager"}
                and rows.organization.status == "active"
            ) else None
        raise AssertionError(f"unexpected scalar entity: {entity}")

    async def flush(self) -> None:
        return None

    def add(self, value: object) -> None:
        self.added.append(value)

    def release_lock(self) -> None:
        if self.owns_lock:
            self.owns_lock = False
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
        preflight_started: asyncio.Event | None = None,
        allow_preflight_to_finish: asyncio.Event | None = None,
    ) -> None:
        self.session = session
        self.preflight = preflight
        self.send = send
        self.send_started = send_started
        self.allow_send_to_finish = allow_send_to_finish
        self.preflight_started = preflight_started
        self.allow_preflight_to_finish = allow_preflight_to_finish
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
        if self.preflight_started is not None:
            self.preflight_started.set()
        if self.allow_preflight_to_finish is not None:
            await self.allow_preflight_to_finish.wait()
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
    preflight_started: asyncio.Event | None = None,
    allow_preflight_to_finish: asyncio.Event | None = None,
    credential_failure: bool = False,
) -> tuple[ReplyExecutionService, _Adapter, _Session]:
    session = _Session(rows)
    adapter = _Adapter(
        session,
        preflight=preflight,
        send=send,
        send_started=send_started,
        allow_send_to_finish=allow_send_to_finish,
        preflight_started=preflight_started,
        allow_preflight_to_finish=allow_preflight_to_finish,
    )
    service = ReplyExecutionService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _Registry(adapter)),
        credentials=cast(CredentialService, _Credentials(session, fail=credential_failure)),
    )
    return service, adapter, session


def _absent() -> AdapterResult[ExistingReplyResult]:
    return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))


@pytest.fixture
def execution_clock(monkeypatch: pytest.MonkeyPatch) -> list[datetime]:
    current = [datetime.now(UTC)]

    class _Clock(datetime):
        @classmethod
        def now(cls, tz: tzinfo | None = None) -> datetime:
            return current[0]

    monkeypatch.setattr("app.services.reply_execution_service.datetime", _Clock)
    return current


@pytest.mark.asyncio
async def test_duplicate_delivery_preserves_future_retry_deadline_without_provider_io() -> None:
    rows = _rows()
    rows.reply.status = ReplyStatus.RETRY_PENDING.value
    rows.reply.error_code = "rate_limited"
    rows.reply.next_retry_at = datetime.now(UTC) + timedelta(seconds=120)
    rows.message.status = MessageStatus.APPROVED.value
    deadline = rows.reply.next_retry_at
    service, adapter, _ = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.status == ReplyStatus.RETRY_PENDING.value
    assert result.retryable is True
    assert result.error_code == "rate_limited"
    assert rows.reply.next_retry_at == deadline
    assert rows.reply.attempt_count == 0
    assert rows.message.status == MessageStatus.APPROVED.value
    assert adapter.preflight_calls == 0
    assert adapter.send_calls == 0


@pytest.mark.asyncio
async def test_due_retry_delivery_executes_once_after_cooldown() -> None:
    rows = _rows()
    rows.reply.status = ReplyStatus.RETRY_PENDING.value
    rows.reply.error_code = "rate_limited"
    rows.reply.next_retry_at = datetime.now(UTC) - timedelta(seconds=1)
    rows.message.status = MessageStatus.APPROVED.value
    service, adapter, _ = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("sent-after-cooldown")),
    )

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert rows.reply.attempt_count == 1
    assert rows.reply.next_retry_at is None
    assert adapter.preflight_calls == 1
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_manual_execution_uses_current_sender_authority_when_creator_differs() -> None:
    rows = _rows()
    rows.reply.created_by = uuid4()
    service, adapter, _ = _service(rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("synthetic-answer")))

    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.status == ReplyStatus.SENT.value
    assert adapter.send_calls == 1


@pytest.mark.parametrize(
    "change",
    ["revoked", "disabled", "rotated", "scope_removed", "seller_changed", "marketplace_changed", "message_binding_changed", "message_manual_review"],
)
@pytest.mark.asyncio
async def test_preflight_cannot_send_after_persisted_account_eligibility_changes(change: str) -> None:
    rows = _rows()
    started, finish = asyncio.Event(), asyncio.Event()
    service, adapter, _ = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-send")),
        preflight_started=started, allow_preflight_to_finish=finish,
    )
    execution = asyncio.create_task(service.execute_reply(reply_id=rows.reply.id))
    await started.wait()
    original_account = rows.account
    rows.account = MarketplaceAccount(
        id=original_account.id, organization_id=original_account.organization_id,
        marketplace=original_account.marketplace, seller_id=original_account.seller_id,
        status=original_account.status, credentials_status=original_account.credentials_status,
        credentials_encrypted=original_account.credentials_encrypted, credentials_fingerprint=original_account.credentials_fingerprint,
        credentials_last_rotated_at=original_account.credentials_last_rotated_at, scopes_json=dict(original_account.scopes_json),
    )
    if change == "revoked":
        rows.account.credentials_status = "revoked"
    elif change == "disabled":
        rows.account.status = "disabled"
    elif change == "rotated":
        rows.account.credentials_encrypted = "rotated-encrypted"
        rows.account.credentials_fingerprint = "rotated-fingerprint"
        rows.account.credentials_last_rotated_at = datetime.now(UTC)
    elif change == "scope_removed":
        rows.account.scopes_json = {"scopes": ["reviews:read"]}
    elif change == "seller_changed":
        rows.account.seller_id = "changed-seller"
    elif change == "marketplace_changed":
        rows.account.marketplace = Marketplace.OZON.value
    elif change in {"message_binding_changed", "message_manual_review"}:
        original_message = rows.message
        rows.message = CustomerMessage(
            id=original_message.id, organization_id=original_message.organization_id,
            marketplace_account_id=uuid4() if change == "message_binding_changed" else original_message.marketplace_account_id,
            marketplace=original_message.marketplace, type=original_message.type, external_id=original_message.external_id,
            status=MessageStatus.SENDING.value if change == "message_binding_changed" else MessageStatus.NEEDS_MANUAL_CHECK.value,
        )
    finish.set()
    result = await execution

    assert adapter.send_calls == 0
    assert result.status != ReplyStatus.SENT.value
    assert result.retryable is False
    assert rows.reply.attempt_count == 1
    assert rows.reply.next_retry_at is None
    assert "provider_write_ambiguity" not in rows.reply.metadata_json
    if change in {"message_binding_changed", "message_manual_review"}:
        assert result.error_code == "execution_superseded"
        assert rows.reply.status == ReplyStatus.SENDING.value
        assert rows.message.status == (MessageStatus.SENDING.value if change == "message_binding_changed" else MessageStatus.NEEDS_MANUAL_CHECK.value)
    else:
        assert result.status == ReplyStatus.BLOCKED.value
        assert rows.message.status == MessageStatus.BLOCKED_BY_MARKETPLACE.value
        assert result.error_code == ("invalid_credentials" if change in {"revoked", "rotated"} else "insufficient_scope")


@pytest.mark.parametrize("owner_change", ["none", "manual_review", "new_attempt"])
@pytest.mark.asyncio
async def test_expired_preflight_cannot_publish_after_lease_or_owner_changes(
    execution_clock: list[datetime], owner_change: str,
) -> None:
    rows = _rows()
    started, finish = asyncio.Event(), asyncio.Event()
    service, adapter, _ = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-send")),
        preflight_started=started, allow_preflight_to_finish=finish,
    )
    execution = asyncio.create_task(service.execute_reply(reply_id=rows.reply.id))
    await started.wait()
    execution_clock[0] += timedelta(seconds=121)
    if owner_change == "manual_review":
        recovery, recovery_adapter, _ = _service(
            rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-send")),
        )
        recovered = await recovery.execute_reply(reply_id=rows.reply.id)
        assert recovered.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
        assert recovery_adapter.send_calls == 0
    elif owner_change == "new_attempt":
        rows.reply.attempt_count = 2
        rows.reply.last_attempt_at = execution_clock[0]
    status, metadata = rows.reply.status, dict(rows.reply.metadata_json)
    attempts = rows.reply.attempt_count
    finish.set()
    result = await execution

    assert adapter.send_calls == 0
    assert result.status == status
    assert rows.reply.status == status
    assert rows.reply.metadata_json == metadata
    assert rows.reply.attempt_count == attempts


@pytest.mark.asyncio
async def test_valid_preflight_renews_execution_lease_before_bounded_write(execution_clock: list[datetime]) -> None:
    rows = _rows()
    preflight_started, finish_preflight = asyncio.Event(), asyncio.Event()
    send_started, finish_send = asyncio.Event(), asyncio.Event()
    service, adapter, session = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("provider-answer-1")),
        preflight_started=preflight_started, allow_preflight_to_finish=finish_preflight,
        send_started=send_started, allow_send_to_finish=finish_send,
    )
    execution = asyncio.create_task(service.execute_reply(reply_id=rows.reply.id))
    await preflight_started.wait()
    execution_clock[0] += timedelta(seconds=119)
    finish_preflight.set()
    await send_started.wait()
    try:
        assert rows.reply.last_attempt_at == execution_clock[0]
        assert rows.reply.attempt_count == 1
        assert not session.owns_lock
        execution_clock[0] += timedelta(seconds=2)
        duplicate, duplicate_adapter, _ = _service(
            rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-send")),
        )
        duplicate_result = await duplicate.execute_reply(reply_id=rows.reply.id)
        assert duplicate_result.error_code == "execution_in_progress"
        assert duplicate_adapter.send_calls == 0
    finally:
        finish_send.set()
        result = await execution
    assert result.status == ReplyStatus.SENT.value
    assert adapter.send_calls == 1


@pytest.mark.parametrize("lease_seconds", [2, 120])
@pytest.mark.asyncio
async def test_write_timeout_finishes_within_lease_and_requires_manual_reconciliation(
    monkeypatch: pytest.MonkeyPatch, execution_clock: list[datetime], lease_seconds: int,
) -> None:
    rows = _rows()
    service, adapter, session = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-mark-sent")),
        allow_send_to_finish=asyncio.Event(),
    )
    settings = get_settings().model_copy(update={"auto_reply_execution_lease_seconds": lease_seconds})
    monkeypatch.setattr("app.services.reply_execution_service.get_settings", lambda: settings)
    actual_timeout = asyncio.timeout
    budgets: list[float | None] = []

    def short_timeout(delay: float | None) -> asyncio.Timeout:
        budgets.append(delay)
        return actual_timeout(0.01)

    monkeypatch.setattr("app.services.reply_execution_service.asyncio.timeout", short_timeout)
    result = await service.execute_reply(reply_id=rows.reply.id)

    assert len(budgets) == 1
    assert budgets[0] == lease_seconds
    assert result.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.error_code == "network_timeout"
    assert not result.retryable
    assert rows.reply.next_retry_at is None
    assert "provider_write_ambiguity" in rows.reply.metadata_json
    assert adapter.send_calls == 1
    assert not session.owns_lock


@pytest.mark.asyncio
async def test_lease_expiring_during_write_claim_commit_prevents_provider_write(
    monkeypatch: pytest.MonkeyPatch, execution_clock: list[datetime],
) -> None:
    rows = _rows()
    service, adapter, session = _service(
        rows, preflight=_absent(), send=AdapterResult(ok=True, data=ProviderWriteReceipt("must-not-send")),
    )
    commit = session.commit

    async def delayed_commit() -> None:
        await commit()
        if session.commit_count == 2:
            execution_clock[0] += timedelta(seconds=121)

    monkeypatch.setattr(session, "commit", delayed_commit)
    result = await service.execute_reply(reply_id=rows.reply.id)

    assert result.status == ReplyStatus.SENDING.value
    assert result.error_code == "execution_lease_expired"
    assert adapter.send_calls == 0
    assert rows.reply.attempt_count == 1


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


@pytest.mark.asyncio
async def test_preflight_cooldown_does_not_exhaust_write_attempts(execution_clock: list[datetime]) -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows, preflight=AdapterResult(False, error_code="rate_limited", retry_after_seconds=600),
        send=AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )
    for _ in range(6):
        result = await service.execute_reply(reply_id=rows.reply.id)
        assert result.retryable
        assert rows.reply.status == ReplyStatus.RETRY_PENDING.value
        assert rows.reply.attempt_count == 0
        assert rows.reply.next_retry_at is not None
        assert rows.reply.next_retry_at == execution_clock[0] + timedelta(seconds=600)
        execution_clock[0] = rows.reply.next_retry_at
    assert adapter.send_calls == 0
    assert adapter.preflight_calls == 6
    adapter.preflight = _absent()
    result = await service.execute_reply(reply_id=rows.reply.id)
    assert rows.reply.status == ReplyStatus.SENT.value
    assert rows.reply.attempt_count == 1
    assert adapter.send_calls == 1


@pytest.mark.asyncio
async def test_rejected_write_respects_provider_cooldown() -> None:
    rows = _rows()
    service, _, _ = _service(
        rows, preflight=_absent(),
        send=AdapterResult(False, error_code="rate_limited", retry_after_seconds=720),
    )
    result = await service.execute_reply(reply_id=rows.reply.id)
    assert result.retryable and rows.reply.attempt_count == 0
    assert rows.reply.next_retry_at is not None
    assert rows.reply.next_retry_at >= datetime.now(UTC) + timedelta(seconds=719)


@pytest.mark.parametrize("stage", ["preflight", "write"])
async def test_retry_event_identifies_the_blocked_stage_without_customer_or_credential_data(stage: str) -> None:
    rows = _rows()
    service, adapter, session = _service(
        rows,
        preflight=AdapterResult(False, error_code="rate_limited", retry_after_seconds=600) if stage == "preflight" else _absent(),
        send=AdapterResult(False, error_code="rate_limited", retry_after_seconds=600)
        if stage == "write" else AdapterResult(ok=True, data=ProviderWriteReceipt("unused")),
    )

    await service.execute_reply(reply_id=rows.reply.id)

    events = [event for event in session.added if isinstance(event, IntegrationEvent)]
    assert len(events) == 1
    assert events[0].status == "retry_pending"
    assert events[0].metadata_json == {
        "reply_id": str(rows.reply.id),
        "message_id": str(rows.message.id),
        "attempt_count": 0,
        "execution_stage": stage,
        "retry_after_seconds": 600,
        "retry_delay_seconds": 600,
    }
    assert rows.reply.status == ReplyStatus.RETRY_PENDING.value
    assert rows.reply.attempt_count == 0
    assert adapter.send_calls == (1 if stage == "write" else 0)


async def test_local_coordination_outage_retries_without_consuming_publication_attempts() -> None:
    rows = _rows()
    service, _, _ = _service(rows, preflight=_absent(),
        send=AdapterResult(False, error_code="coordination_unavailable", retry_after_seconds=30))
    result = await service.execute_reply(reply_id=rows.reply.id)
    assert result.retryable
    assert rows.reply.status == ReplyStatus.RETRY_PENDING.value
    assert rows.reply.attempt_count == 0
    assert rows.reply.next_retry_at is not None
    assert rows.reply.next_retry_at >= datetime.now(UTC) + timedelta(seconds=29)


@pytest.mark.asyncio
async def test_repeated_provider_throttle_does_not_turn_a_rejected_write_into_terminal_failure(execution_clock: list[datetime]) -> None:
    rows = _rows()
    service, adapter, _ = _service(
        rows, preflight=_absent(), send=AdapterResult(False, error_code="rate_limited", retry_after_seconds=600),
    )
    for _ in range(6):
        result = await service.execute_reply(reply_id=rows.reply.id)
        assert result.retryable and rows.reply.status == ReplyStatus.RETRY_PENDING.value
        assert rows.reply.next_retry_at == execution_clock[0] + timedelta(seconds=600)
        assert rows.reply.next_retry_at is not None
        execution_clock[0] = rows.reply.next_retry_at
    assert adapter.send_calls == 6
    adapter.send = AdapterResult(ok=True, data=ProviderWriteReceipt("sent-after-cooldown"))
    await service.execute_reply(reply_id=rows.reply.id)
    assert rows.reply.status == ReplyStatus.SENT.value


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
