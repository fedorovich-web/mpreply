from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import dramatiq
import pytest

from app.workers import auto_reply


def test_due_later_retry_uses_persisted_retry_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    retry_at = datetime.now(UTC) + timedelta(seconds=5)

    async def execute_reply(_: object) -> SimpleNamespace:
        return SimpleNamespace(
            retryable=True,
            retry_at=retry_at,
            error_code="network_timeout",
        )

    monkeypatch.setattr(auto_reply, "_execute_reply", execute_reply)

    with pytest.raises(dramatiq.Retry) as exc_info:
        auto_reply.auto_reply_actor.fn(str(uuid4()))

    assert exc_info.value.delay is not None
    assert 4_000 <= exc_info.value.delay <= 5_000
