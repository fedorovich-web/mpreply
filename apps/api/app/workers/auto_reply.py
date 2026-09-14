from __future__ import annotations

import asyncio
from uuid import UUID

import dramatiq

from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import create_marketplace_registry
from app.db.session import AsyncSessionLocal
from app.services.reply_execution_service import ReplyExecutionService
from app.workers.broker import redis_broker

BROKER = redis_broker


class RetryableReplyExecutionError(RuntimeError):
    pass


@dramatiq.actor(
    queue_name="auto-replies",
    max_retries=3,
    min_backoff=1_000,
    max_backoff=60_000,
)
def auto_reply_actor(reply_id: str) -> None:
    result = asyncio.run(_execute_reply(UUID(reply_id)))
    if result.retryable:
        raise RetryableReplyExecutionError(result.error_code or "retryable_auto_reply_error")


async def _execute_reply(reply_id: UUID):
    clients = MarketplaceHttpClients.create()
    try:
        registry = create_marketplace_registry(clients)
        async with AsyncSessionLocal() as session:
            service = ReplyExecutionService(session, registry=registry)
            return await service.execute_reply(reply_id=reply_id)
    finally:
        await clients.aclose()


def enqueue_auto_reply(reply_id: UUID) -> str:
    message = auto_reply_actor.send(str(reply_id))
    return message.message_id
