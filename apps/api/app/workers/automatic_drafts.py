from __future__ import annotations

from datetime import datetime
from uuid import UUID

import dramatiq
import structlog
from dramatiq.errors import DramatiqError
from redis.exceptions import RedisError

from app.db.session import AsyncSessionLocal
from app.services.automatic_draft_service import AutomaticDraftService
from app.workers.broker import redis_broker

BROKER = redis_broker
logger = structlog.get_logger(__name__)


@dramatiq.actor(queue_name="automatic-drafts", max_retries=0)
async def automatic_draft_actor(job_id: str, token: str) -> None:
    await _process(UUID(job_id), UUID(token))


async def _process(job_id: UUID, token: UUID) -> None:
    async with AsyncSessionLocal() as session:
        await AutomaticDraftService(session).process(job_id=job_id, token=token)


async def dispatch_automatic_drafts(now: datetime, *, limit: int = 25) -> tuple[UUID, ...]:
    async with AsyncSessionLocal() as session:
        service = AutomaticDraftService(session)
        await service.discover(limit=limit)
        claims = await service.claim_due(now=now, limit=limit)
    dispatched: list[UUID] = []
    for job_id, token in claims:
        try:
            automatic_draft_actor.send(str(job_id), str(token))
        except (DramatiqError, RedisError, OSError):
            async with AsyncSessionLocal() as session:
                await AutomaticDraftService(session).dispatch_failed(job_id=job_id, token=token)
            logger.warning("automatic_draft_dispatch_failed", job_id=str(job_id))
            continue
        dispatched.append(job_id)
    return tuple(dispatched)
