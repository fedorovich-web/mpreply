from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ClauseElement

from app.models.enums import ReplyStatus
from app.models.reply import Reply
from app.workers.auto_reply import claim_due_replies

NOW = datetime(2026, 9, 14, 12, tzinfo=UTC)


class _Scalars:
    def __init__(self, replies: list[Reply]) -> None:
        self.replies = replies

    def all(self) -> list[Reply]:
        return self.replies


class _Result:
    def __init__(self, replies: list[Reply]) -> None:
        self.replies = replies

    def scalars(self) -> _Scalars:
        return _Scalars(self.replies)


class _Session:
    def __init__(self, replies: list[Reply]) -> None:
        self.replies = replies
        self.statements: list[object] = []
        self.commit_count = 0

    async def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return _Result(self.replies)

    async def commit(self) -> None:
        self.commit_count += 1


def _reply(*, status: ReplyStatus = ReplyStatus.QUEUED) -> Reply:
    return Reply(
        id=uuid4(),
        organization_id=uuid4(),
        message_id=uuid4(),
        reply_text="Reply text",
        status=status.value,
        mode="auto",
        attempt_count=0,
        max_attempts=4,
        dispatch_attempt_count=0,
        metadata_json={},
    )


@pytest.mark.asyncio
async def test_reply_dispatch_claim_is_bounded_and_skip_locked() -> None:
    reply = _reply()
    session = _Session([reply])

    claimed = await claim_due_replies(
        cast(AsyncSession, session),
        now=NOW,
        owner="scheduler:synthetic",
        limit=25,
    )

    sql = str(
        cast(ClauseElement, session.statements[0]).compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": False},
        )
    )
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert " LIMIT " in sql
    assert claimed == (reply.id,)
    assert reply.dispatch_owner == "scheduler:synthetic"
    assert reply.dispatch_lease_expires_at == NOW + timedelta(seconds=30)
    assert reply.dispatch_attempt_count == 1
    assert session.commit_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, -1, 101, True])
async def test_reply_dispatch_rejects_unsafe_limits(limit: int) -> None:
    session = _Session([])

    with pytest.raises(ValueError, match="between 1 and 100"):
        await claim_due_replies(
            cast(AsyncSession, session),
            now=NOW,
            owner="scheduler:synthetic",
            limit=limit,
        )

    assert session.statements == []
