from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReplyStatus
from app.models.reply import Reply

logger = logging.getLogger(__name__)

ReplyEnqueue = Callable[[UUID], str]


def dispatch_reply_safely(*, reply: Reply, enqueue: ReplyEnqueue) -> str | None:
    try:
        return enqueue(reply.id)
    except Exception as exc:
        logger.warning(
            "reply_enqueue_failed",
            extra={"reply_id": str(reply.id), "error_type": type(exc).__name__},
        )
        return None


class ReplyDispatchRecoveryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def recover_missing_dispatches(
        self,
        *,
        enqueue: ReplyEnqueue,
        now: datetime | None = None,
        limit: int = 25,
    ) -> int:
        current_time = now or datetime.now(UTC)
        batch_limit = min(max(limit, 1), 100)
        result = await self.session.execute(
            select(Reply)
            .where(
                Reply.status == ReplyStatus.QUEUED.value,
                Reply.worker_message_id.is_(None),
                Reply.attempt_count < Reply.max_attempts,
                or_(Reply.next_retry_at.is_(None), Reply.next_retry_at <= current_time),
            )
            .order_by(Reply.created_at.asc(), Reply.id.asc())
            .with_for_update(skip_locked=True)
            .limit(batch_limit)
        )
        recovered = 0
        for reply in result.scalars().all():
            if not self._is_dispatchable(reply=reply, now=current_time):
                continue
            worker_message_id = dispatch_reply_safely(reply=reply, enqueue=enqueue)
            if worker_message_id is None:
                continue
            reply.worker_message_id = worker_message_id
            recovered += 1
        await self.session.flush()
        return recovered

    @staticmethod
    def _is_dispatchable(*, reply: Reply, now: datetime) -> bool:
        return (
            reply.status == ReplyStatus.QUEUED.value
            and reply.worker_message_id is None
            and reply.attempt_count < reply.max_attempts
            and (reply.next_retry_at is None or reply.next_retry_at <= now)
        )
