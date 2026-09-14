from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID, uuid4

import dramatiq

from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import create_marketplace_registry
from app.db.session import AsyncSessionLocal
from app.services.scheduled_sync_service import (
    ScheduledSyncService,
    StreamRunResult,
    claim_due_marketplace_streams,
    take_claimed_marketplace_stream,
)
from app.workers.broker import redis_broker

BROKER = redis_broker


@dramatiq.actor(queue_name="marketplace-sync", max_retries=0)
def marketplace_sync_actor(state_id: str) -> None:
    try:
        parsed_id = UUID(state_id)
    except ValueError as exc:
        raise ValueError("marketplace sync state ID is invalid") from exc
    asyncio.run(_execute_claimed_stream(parsed_id))


async def enqueue_due_marketplace_streams(
    now: datetime,
    limit: int = 25,
) -> tuple[UUID, ...]:
    owner = f"scheduler:{uuid4()}"
    async with AsyncSessionLocal() as session:
        states = await claim_due_marketplace_streams(
            session,
            now=now,
            owner=owner,
            limit=limit,
        )
    for state in states:
        marketplace_sync_actor.send(str(state.id))
    return tuple(state.id for state in states)


async def _execute_claimed_stream(state_id: UUID) -> StreamRunResult | None:
    clients = MarketplaceHttpClients.create()
    try:
        registry = create_marketplace_registry(clients)
        async with AsyncSessionLocal() as session:
            now = datetime.now(UTC)
            owner = f"worker:{uuid4()}"
            state = await take_claimed_marketplace_stream(
                session,
                state_id=state_id,
                now=now,
                owner=owner,
            )
            if state is None:
                return None
            return await ScheduledSyncService(
                session,
                registry=registry,
            ).run_stream(
                state_id,
                owner,
                now,
                preacquired=True,
            )
    finally:
        await clients.aclose()
