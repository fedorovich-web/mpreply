from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID

import dramatiq

from app.db.session import AsyncSessionLocal
from app.services.reply_execution_service import ReplyExecutionService
from app.workers.broker import redis_broker

BROKER = redis_broker


class RetryableReplyExecutionError(RuntimeError):
    pass


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dramatiq.actor(
    queue_name="auto-replies",
    max_retries=3,
    min_backoff=1_000,
    max_backoff=60_000,
)
def auto_reply_actor(reply_id: str) -> None:
    result = asyncio.run(_execute_reply(UUID(reply_id)))
    if result.retryable:
        if result.retry_at is not None:
            delay = int((result.retry_at - _utc_now()).total_seconds() * 1000)
            if delay > 0:
                raise dramatiq.Retry(
                    result.error_code or "retryable_auto_reply_error",
                    delay=delay,
                )
        raise RetryableReplyExecutionError(result.error_code or "retryable_auto_reply_error")


async def _execute_reply(reply_id: UUID):
    async with AsyncSessionLocal() as session:
        service = ReplyExecutionService(session)
        return await service.execute_reply(reply_id=reply_id)


def enqueue_auto_reply(reply_id: UUID) -> str:
    message = auto_reply_actor.send(str(reply_id))
    return message.message_id
