from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import dramatiq
import structlog
from dramatiq.errors import DramatiqError
from redis.exceptions import RedisError
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.http import MarketplaceHttpClients
from app.adapters.registry import create_marketplace_registry
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.enums import ReplyStatus
from app.models.reply import Reply
from app.services.reply_execution_service import ExecuteReplyResult, ReplyExecutionService
from app.workers.broker import redis_broker

BROKER = redis_broker
logger = structlog.get_logger(__name__)


@dramatiq.actor(
    queue_name="auto-replies",
    max_retries=0,
)
def auto_reply_actor(reply_id: str) -> None:
    try:
        parsed_id = UUID(reply_id)
    except ValueError as exc:
        raise ValueError("reply ID is invalid") from exc
    asyncio.run(_execute_reply(parsed_id))


async def _execute_reply(reply_id: UUID) -> ExecuteReplyResult:
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


async def claim_due_replies(
    session: AsyncSession,
    *,
    now: datetime,
    owner: str,
    limit: int,
    lease_for: timedelta = timedelta(seconds=30),
) -> tuple[UUID, ...]:
    if not owner or owner != owner.strip() or len(owner) > 128:
        raise ValueError("reply dispatch owner is invalid")
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("reply dispatch limit must be between 1 and 100")
    if not timedelta(seconds=5) <= lease_for <= timedelta(minutes=5):
        raise ValueError("reply dispatch lease must be between 5 seconds and 5 minutes")

    settings = get_settings()
    stale_execution_before = now - timedelta(seconds=settings.auto_reply_execution_lease_seconds)
    redispatch_before = now - timedelta(seconds=settings.auto_reply_execution_lease_seconds)
    due_status = or_(
        and_(
            Reply.status == ReplyStatus.QUEUED.value,
            Reply.attempt_count < Reply.max_attempts,
            or_(
                Reply.last_dispatched_at.is_(None),
                Reply.last_dispatched_at <= redispatch_before,
            ),
        ),
        and_(
            Reply.status == ReplyStatus.RETRY_PENDING.value,
            Reply.attempt_count < Reply.max_attempts,
            Reply.next_retry_at.is_not(None),
            Reply.next_retry_at <= now,
            or_(
                Reply.last_dispatched_at.is_(None),
                Reply.last_dispatched_at <= redispatch_before,
            ),
        ),
        and_(
            Reply.status == ReplyStatus.SENDING.value,
            or_(
                Reply.last_attempt_at.is_(None),
                Reply.last_attempt_at <= stale_execution_before,
            ),
            or_(
                Reply.last_dispatched_at.is_(None),
                Reply.last_dispatched_at <= redispatch_before,
            ),
        ),
    )
    result = await session.execute(
        select(Reply)
        .where(
            due_status,
            or_(
                Reply.dispatch_lease_expires_at.is_(None),
                Reply.dispatch_lease_expires_at <= now,
            ),
        )
        .order_by(Reply.next_retry_at.asc().nullsfirst(), Reply.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(limit)
    )
    replies = list(result.scalars().all())
    lease_expires_at = now + lease_for
    for reply in replies:
        reply.dispatch_owner = owner
        reply.dispatch_lease_expires_at = lease_expires_at
        reply.dispatch_attempt_count += 1
        reply.last_dispatch_error_code = None
    await session.commit()
    return tuple(reply.id for reply in replies)


async def dispatch_due_replies(now: datetime, *, limit: int = 25) -> tuple[UUID, ...]:
    owner = f"scheduler:{uuid4()}"
    async with AsyncSessionLocal() as session:
        reply_ids = await claim_due_replies(
            session,
            now=now,
            owner=owner,
            limit=limit,
        )

    dispatched: list[UUID] = []
    for reply_id in reply_ids:
        try:
            worker_message_id = enqueue_auto_reply(reply_id)
        except (DramatiqError, RedisError, OSError):
            await _finish_dispatch(
                reply_id=reply_id,
                owner=owner,
                worker_message_id=None,
                dispatched_at=None,
                error_code="broker_unavailable",
            )
            logger.warning("reply_dispatch_failed", reply_id=str(reply_id))
            continue
        await _finish_dispatch(
            reply_id=reply_id,
            owner=owner,
            worker_message_id=worker_message_id,
            dispatched_at=now,
            error_code=None,
        )
        dispatched.append(reply_id)
    return tuple(dispatched)


async def _finish_dispatch(
    *,
    reply_id: UUID,
    owner: str,
    worker_message_id: str | None,
    dispatched_at: datetime | None,
    error_code: str | None,
) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Reply)
            .where(
                Reply.id == reply_id,
                Reply.dispatch_owner == owner,
            )
            .with_for_update()
        )
        reply = result.scalar_one_or_none()
        if reply is None:
            await session.rollback()
            return
        if worker_message_id is not None:
            reply.worker_message_id = worker_message_id
            reply.last_dispatched_at = dispatched_at
        reply.last_dispatch_error_code = error_code
        reply.dispatch_owner = None
        reply.dispatch_lease_expires_at = None
        await session.commit()
