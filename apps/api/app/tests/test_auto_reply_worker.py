from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import dramatiq
import pytest

from app.workers import auto_reply


def test_due_later_retry_uses_persisted_retry_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    now = datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    retry_at = now + timedelta(seconds=5)

    async def execute_reply(_: object) -> SimpleNamespace:
        return SimpleNamespace(
            retryable=True,
            retry_at=retry_at,
            error_code="network_timeout",
        )

    monkeypatch.setattr(auto_reply, "_execute_reply", execute_reply)
    monkeypatch.setattr(auto_reply, "_utc_now", lambda: now)

    with pytest.raises(dramatiq.Retry) as exc_info:
        auto_reply.auto_reply_actor.fn(str(uuid4()))

    assert exc_info.value.delay is not None
    assert exc_info.value.delay == 5_000


def test_outbound_send_ambiguity_never_requests_broker_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def execute_reply(_: object) -> SimpleNamespace:
        return SimpleNamespace(
            retryable=False,
            retry_at=None,
            error_code="outbound_send_ambiguous",
        )

    monkeypatch.setattr(auto_reply, "_execute_reply", execute_reply)

    auto_reply.auto_reply_actor.fn(str(uuid4()))
