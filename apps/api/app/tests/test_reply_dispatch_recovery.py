from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import app.api.replies as replies_api
import app.scheduler.main as scheduler_main
from app.models.enums import ReplyStatus
from app.models.reply import Reply
from app.models.user import User
from app.services.reply_dispatch_service import ReplyDispatchRecoveryService, dispatch_reply_safely
from app.services.reply_execution_service import ReplyExecutionService


class _Scalars:
    def __init__(self, values: list[Reply]) -> None:
        self._values = values

    def all(self) -> list[Reply]:
        return self._values


class _Result:
    def __init__(self, values: list[Reply]) -> None:
        self._values = values

    def scalars(self) -> _Scalars:
        return _Scalars(self._values)


class _Session:
    def __init__(self, replies: list[Reply]) -> None:
        self.replies = replies
        self.flush_count = 0

    async def execute(self, _statement: object) -> _Result:
        return _Result(self.replies)

    async def flush(self) -> None:
        self.flush_count += 1


class _ApiSession:
    def __init__(self) -> None:
        self.commit_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1


def _reply(
    *,
    status: str = ReplyStatus.QUEUED.value,
    worker_message_id: str | None = None,
    attempt_count: int = 0,
    max_attempts: int = 4,
    next_retry_at: datetime | None = None,
) -> Reply:
    return cast(
        Reply,
        SimpleNamespace(
            id=uuid4(),
            status=status,
            worker_message_id=worker_message_id,
            attempt_count=attempt_count,
            max_attempts=max_attempts,
            next_retry_at=next_retry_at,
        ),
    )


def test_enqueue_failure_keeps_durable_reply_recoverable_without_broker_details() -> None:
    reply = _reply()

    def broken_enqueue(_: UUID) -> str:
        raise RuntimeError("broker password must not escape")

    worker_message_id = dispatch_reply_safely(reply=reply, enqueue=broken_enqueue)

    assert worker_message_id is None
    assert reply.status == ReplyStatus.QUEUED.value
    assert reply.worker_message_id is None


@pytest.mark.asyncio
async def test_retry_api_keeps_committed_reply_queued_when_broker_enqueue_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reply = _reply()
    session = _ApiSession()

    class _RetryService:
        async def prepare_retry(self, *, actor: User, reply_id: UUID) -> Reply:
            assert reply_id == reply.id
            return reply

    def broken_enqueue(_: UUID) -> str:
        raise RuntimeError("broker password must not escape")

    def retry_service_factory(_: AsyncSession) -> ReplyExecutionService:
        return cast(ReplyExecutionService, _RetryService())

    monkeypatch.setattr(replies_api, "ReplyExecutionService", retry_service_factory)
    monkeypatch.setattr(replies_api, "enqueue_auto_reply", broken_enqueue)

    response = await replies_api.retry_reply(
        reply_id=reply.id,
        current_user=cast(User, SimpleNamespace()),
        session=cast(AsyncSession, session),
    )

    assert response.queued is True
    assert response.worker_message_id is None
    assert response.status == ReplyStatus.QUEUED.value
    assert reply.worker_message_id is None
    assert session.commit_calls == 1


@pytest.mark.asyncio
async def test_recovery_dispatches_only_eligible_durable_replies() -> None:
    now = datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    dispatchable = _reply()
    broken = _reply()
    sent = _reply(status=ReplyStatus.SENT.value)
    sending = _reply(status=ReplyStatus.SENDING.value)
    blocked = _reply(status=ReplyStatus.BLOCKED.value)
    failed = _reply(status=ReplyStatus.FAILED.value)
    future_retry = _reply(next_retry_at=now + timedelta(minutes=1))
    dispatched = _reply(worker_message_id="existing-message")
    exhausted = _reply(attempt_count=4, max_attempts=4)
    session = _Session(
        [dispatchable, broken, sent, sending, blocked, failed, future_retry, dispatched, exhausted]
    )
    service = ReplyDispatchRecoveryService(cast(AsyncSession, session))
    calls: list[UUID] = []

    def enqueue(reply_id: UUID) -> str:
        calls.append(reply_id)
        if reply_id == broken.id:
            raise ConnectionError("broker unavailable")
        return f"message-{reply_id}"

    recovered = await service.recover_missing_dispatches(enqueue=enqueue, now=now, limit=25)

    assert recovered == 1
    assert calls == [dispatchable.id, broken.id]
    assert dispatchable.worker_message_id == f"message-{dispatchable.id}"
    assert broken.worker_message_id is None
    assert session.flush_count == 1


def test_recovery_query_uses_skip_locked_and_dispatchability_predicates() -> None:
    source = (
        __import__("app.services.reply_dispatch_service", fromlist=["placeholder"]).__file__
    )
    assert source is not None
    text = Path(source).read_text(encoding="utf-8")

    assert "Reply.status == ReplyStatus.QUEUED.value" in text
    assert "Reply.worker_message_id.is_(None)" in text
    assert "Reply.attempt_count < Reply.max_attempts" in text
    assert ".with_for_update(skip_locked=True)" in text


def test_all_durable_reply_api_paths_use_safe_dispatch() -> None:
    source = Path(replies_api.__file__).read_text(encoding="utf-8")

    assert source.count("dispatch_reply_safely(") == 3


def test_provider_neutral_scheduler_runs_reply_dispatch_recovery() -> None:
    source = Path(scheduler_main.__file__).read_text(encoding="utf-8")

    assert "ReplyDispatchRecoveryService" in source
    assert "recover_missing_dispatches(enqueue=enqueue_auto_reply)" in source
