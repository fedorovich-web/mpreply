from __future__ import annotations

import asyncio
from uuid import UUID

import dramatiq

from app.db.session import AsyncSessionLocal
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService
from app.workers.broker import redis_broker

BROKER = redis_broker


@dramatiq.actor(queue_name="marketplace-sync", max_retries=0)
def marketplace_sync_actor(state_id: str, lease_token: str) -> None:
    asyncio.run(_execute(UUID(state_id), UUID(lease_token)))


async def _execute(state_id: UUID, lease_token: UUID) -> None:
    async with AsyncSessionLocal() as session:
        service = ScheduledMarketplaceSyncService(session)
        await service.execute(state_id=state_id, lease_token=lease_token)
        await session.commit()


def enqueue_marketplace_sync(*, state_id: UUID, lease_token: UUID) -> str:
    message = marketplace_sync_actor.send(str(state_id), str(lease_token))
    return message.message_id
