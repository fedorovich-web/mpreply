from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.models.customer_message import CustomerMessage
from app.models.enums import MessageStatus, ReplyStatus, ResponseMode
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.services import reply_execution_service
from app.services.reply_execution_service import ReplyExecutionService


class _PreflightAdapter(MarketplaceAdapter):
    marketplace = "wildberries"

    def __init__(self, preflight_result: AdapterResult) -> None:
        self.preflight_result = preflight_result
        self.preflight_calls = 0
        self.send_calls = 0

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
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        self.send_calls += 1
        return AdapterResult(ok=True)

    async def send_question_reply(
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        raise AssertionError("not used")

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        self.preflight_calls += 1
        return self.preflight_result

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        raise AssertionError("not used")


class _Session:
    def __init__(self) -> None:
        self.commit_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1


class _Entitlements:
    def __init__(self) -> None:
        self.reserve_calls = 0
        self.release_calls = 0

    async def reserve_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        actor_user_id: UUID | None,
    ) -> SimpleNamespace:
        self.reserve_calls += 1
        return SimpleNamespace(allowed=True, reason=None)

    async def release_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        reason: str,
        actor_user_id: UUID | None,
    ) -> None:
        self.release_calls += 1

    async def settle_for_reply(
        self,
        *,
        organization_id: UUID,
        reply_id: UUID,
        actor_user_id: UUID | None,
    ) -> None:
        raise AssertionError("uncertain preflight must not settle an answer")


class _Audit:
    async def write(self, **_: object) -> None:
        return None


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

    async def _get_reply_for_update(self, reply_id: UUID) -> Reply:
        assert reply_id == self.reply.id
        return self.reply

    async def _get_message(self, message_id: UUID) -> CustomerMessage:
        assert message_id == self.message.id
        return self.message

    async def _get_account(self, account_id: UUID) -> MarketplaceAccount:
        assert account_id == self.message.marketplace_account_id
        return self.account

    async def _write_integration_event(self, **_: object) -> None:
        return None


def _reply(*, status: str = ReplyStatus.QUEUED.value, next_retry_at: datetime | None = None) -> Reply:
    identifier = uuid4()
    return cast(
        Reply,
        SimpleNamespace(
            id=identifier,
            organization_id=uuid4(),
            message_id=uuid4(),
            status=status,
            mode=ResponseMode.SEMI_AUTO.value,
            attempt_count=0,
            max_attempts=4,
            last_attempt_at=None,
            next_retry_at=next_retry_at,
            error_code=None,
            failed_reason=None,
            metadata_json={},
            created_by=None,
            sent_by=None,
            reply_text="Ответ",
        ),
    )


def _message(reply: Reply) -> CustomerMessage:
    return cast(
        CustomerMessage,
        SimpleNamespace(
            id=reply.message_id,
            marketplace_account_id=uuid4(),
            marketplace="wildberries",
            type="review",
            external_id="feedback-1",
            status=MessageStatus.APPROVED.value,
        ),
    )


def _account(message: CustomerMessage) -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=message.marketplace_account_id,
            marketplace="wildberries",
            seller_id=None,
            credentials_encrypted="credential",
        ),
    )


def _adapter_lookup(adapter: MarketplaceAdapter):
    def lookup(_: str) -> MarketplaceAdapter:
        return adapter

    return lookup


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("preflight_result", "expected_status", "expected_retryable", "expected_error"),
    [
        (
            AdapterResult(ok=False, error_code="network_timeout", error_message_safe="timeout"),
            ReplyStatus.RETRY_PENDING.value,
            True,
            "network_timeout",
        ),
        (
            AdapterResult(ok=True, data={"answered": "invalid"}),
            ReplyStatus.FAILED.value,
            False,
            "marketplace_malformed_response",
        ),
    ],
)
async def test_wildberries_uncertain_preflight_never_sends_reply(
    preflight_result: AdapterResult,
    expected_status: str,
    expected_retryable: bool,
    expected_error: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    message = _message(reply)
    adapter = _PreflightAdapter(preflight_result)
    service = _ExecutionHarness(
        reply=reply,
        message=message,
        account=_account(message),
    )
    monkeypatch.setattr(
        reply_execution_service,
        "get_marketplace_adapter",
        _adapter_lookup(adapter),
    )

    result = await service.execute_reply(reply_id=reply.id)

    assert adapter.preflight_calls == 1
    assert adapter.send_calls == 0
    assert service.entitlements.reserve_calls == 1
    assert service.entitlements.release_calls == 1
    assert reply.status == expected_status
    assert result.retryable is expected_retryable
    assert result.error_code == expected_error
    assert reply.error_code == expected_error


@pytest.mark.asyncio
async def test_retry_pending_reply_waits_until_next_retry_without_reserving_or_calling_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply(
        status=ReplyStatus.RETRY_PENDING.value,
        next_retry_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    message = _message(reply)
    adapter = _PreflightAdapter(AdapterResult(ok=True, data={"answered": False}))
    service = _ExecutionHarness(
        reply=reply,
        message=message,
        account=_account(message),
    )
    monkeypatch.setattr(
        reply_execution_service,
        "get_marketplace_adapter",
        _adapter_lookup(adapter),
    )

    result = await service.execute_reply(reply_id=reply.id)

    assert result.retryable is True
    assert result.error_code == "retry_not_due"
    assert service.entitlements.reserve_calls == 0
    assert adapter.preflight_calls == 0
    assert adapter.send_calls == 0
    assert reply.status == ReplyStatus.RETRY_PENDING.value
