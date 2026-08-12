from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import cast

import pytest

from app.adapters.base import AdapterResult
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.customer_message import CustomerMessage
from app.models.reply import Reply
from app.services.reply_execution_service import (
    ReplyExecutionService,
    YandexQuestionWriteAuthorization,
)

API_ROOT = Path(__file__).resolve().parents[2]


class _ReconciliationAdapter(YandexMarketAdapter):
    def __init__(self, result: AdapterResult) -> None:
        self.result = result
        self.calls: list[tuple[str, str, str | None]] = []

    async def reconcile_question_reply(
        self,
        credential: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        self.calls.append((credential, external_id, seller_id))
        return self.result


class _ReplyExecutionHarness(ReplyExecutionService):
    async def authorize_yandex_question_write(
        self,
        *,
        adapter: YandexMarketAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
        reply: Reply,
    ) -> YandexQuestionWriteAuthorization:
        return await self._authorize_yandex_question_write(
            adapter=adapter,
            credential=credential,
            seller_id=seller_id,
            message=message,
            reply=reply,
        )

    def is_yandex_question_send_ambiguous_error(self, error_code: str | None) -> bool:
        return self._is_yandex_question_send_ambiguous_error(error_code)

    def record_yandex_question_send_ambiguity(
        self,
        *,
        reply: Reply,
        error_code: str,
        now: datetime,
    ) -> None:
        self._record_yandex_question_send_ambiguity(
            reply=reply,
            error_code=error_code,
            now=now,
        )


def _message() -> CustomerMessage:
    return cast(CustomerMessage, SimpleNamespace(external_id="123"))


def _reply(metadata: dict[str, object] | None = None) -> Reply:
    return cast(
        Reply,
        SimpleNamespace(
            metadata_json=metadata or {},
            attempt_count=1,
        ),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("state", "error_code"),
    [
        ("UNMODERATED", "yandex_question_reply_unmoderated"),
        ("BANNED", "yandex_question_reply_banned"),
        ("DELETED", "yandex_question_reply_deleted"),
        ("UNKNOWN", "yandex_question_reconciliation_unknown"),
    ],
)
async def test_non_absent_yandex_question_states_block_write(
    state: str,
    error_code: str,
) -> None:
    service = object.__new__(_ReplyExecutionHarness)
    adapter = _ReconciliationAdapter(
        AdapterResult(ok=True, data={"state": state, "answer_id": "88"})
    )

    authorization = await service.authorize_yandex_question_write(
        adapter=adapter,
        credential="key",
        seller_id="99",
        message=_message(),
        reply=_reply(),
    )

    assert authorization.allowed is False
    assert authorization.externally_already_answered is False
    assert authorization.state == state
    assert authorization.error_code == error_code
    assert adapter.calls == [("key", "123", "99")]


@pytest.mark.asyncio
async def test_published_yandex_question_converges_as_external_answer() -> None:
    service = object.__new__(_ReplyExecutionHarness)
    adapter = _ReconciliationAdapter(
        AdapterResult(ok=True, data={"state": "PUBLISHED", "answer_id": "88"})
    )

    authorization = await service.authorize_yandex_question_write(
        adapter=adapter,
        credential="key",
        seller_id="99",
        message=_message(),
        reply=_reply(),
    )

    assert authorization.allowed is False
    assert authorization.externally_already_answered is True
    assert authorization.answer_id == "88"
    assert authorization.error_code is None


@pytest.mark.asyncio
async def test_confirmed_absent_yandex_question_allows_write_without_ambiguity() -> None:
    service = object.__new__(_ReplyExecutionHarness)
    adapter = _ReconciliationAdapter(
        AdapterResult(ok=True, data={"state": "ABSENT", "answer_id": None})
    )

    authorization = await service.authorize_yandex_question_write(
        adapter=adapter,
        credential="key",
        seller_id="99",
        message=_message(),
        reply=_reply(),
    )

    assert authorization.allowed is True
    assert authorization.state == "ABSENT"
    assert authorization.error_code is None


@pytest.mark.asyncio
async def test_reconciliation_transport_failure_is_unknown_and_blocks_write() -> None:
    service = object.__new__(_ReplyExecutionHarness)
    adapter = _ReconciliationAdapter(
        AdapterResult(ok=False, error_code="network_timeout")
    )

    authorization = await service.authorize_yandex_question_write(
        adapter=adapter,
        credential="key",
        seller_id="99",
        message=_message(),
        reply=_reply(),
    )

    assert authorization.allowed is False
    assert authorization.state == "UNKNOWN"
    assert authorization.error_code == "yandex_question_reconciliation_unknown"


@pytest.mark.asyncio
async def test_absent_does_not_authorize_resend_with_active_ambiguity() -> None:
    service = object.__new__(_ReplyExecutionHarness)
    adapter = _ReconciliationAdapter(
        AdapterResult(ok=True, data={"state": "ABSENT", "answer_id": None})
    )
    reply = _reply(
        {
            "yandex_question_send_ambiguity": {
                "active": True,
                "reason": "network_timeout",
            }
        }
    )

    authorization = await service.authorize_yandex_question_write(
        adapter=adapter,
        credential="key",
        seller_id="99",
        message=_message(),
        reply=reply,
    )

    assert authorization.allowed is False
    assert authorization.state == "ABSENT"
    assert authorization.error_code == "yandex_question_send_ambiguous"


def test_only_unknown_transport_outcomes_create_yandex_send_ambiguity() -> None:
    service = object.__new__(_ReplyExecutionHarness)
    assert (
        service.is_yandex_question_send_ambiguous_error("network_timeout")
        is True
    )
    assert (
        service.is_yandex_question_send_ambiguous_error("network_error")
        is True
    )
    assert (
        service.is_yandex_question_send_ambiguous_error("rate_limited")
        is False
    )


def test_ambiguity_marker_preserves_existing_reply_metadata() -> None:
    reply = _reply({"keep": "value"})
    service = object.__new__(_ReplyExecutionHarness)

    service.record_yandex_question_send_ambiguity(
        reply=reply,
        error_code="network_timeout",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert reply.metadata_json["keep"] == "value"
    assert reply.metadata_json["yandex_question_send_ambiguity"] == {
        "active": True,
        "reason": "network_timeout",
        "recorded_at": "2026-08-12T07:00:00+00:00",
    }


def test_yandex_question_authorization_precedes_provider_send() -> None:
    source = (API_ROOT / "app" / "services" / "reply_execution_service.py").read_text(
        encoding="utf-8"
    )
    execute_start = source.index("async def execute_reply")
    authorization = source.index(
        "authorization = await self._authorize_yandex_question_write",
        execute_start,
    )
    send = source.index("result = await self._send_through_adapter", authorization)

    assert authorization < send


def test_ambiguous_yandex_send_is_blocked_before_generic_retry_scheduling() -> None:
    source = (API_ROOT / "app" / "services" / "reply_execution_service.py").read_text(
        encoding="utf-8"
    )
    execute_start = source.index("async def execute_reply")
    ambiguity = source.index(
        "if is_yandex_question and self._is_yandex_question_send_ambiguous_error",
        execute_start,
    )
    generic_retry = source.index("retryable = error_code in _RETRYABLE_ERRORS", ambiguity)

    assert ambiguity < generic_retry
