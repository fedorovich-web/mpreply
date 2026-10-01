from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import Mock
from uuid import UUID

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.automatic_draft_job import AutomaticDraftJob
from app.tests.test_automatic_drafts import automatic_db, seed, synthetic_encryption_key
from app.workers import automatic_drafts

__all__ = ["automatic_db", "synthetic_encryption_key"]


async def test_dispatch_failure_persists_retry_and_success_delivers_owned_token(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with automatic_db() as session:
        message = await seed(session)
        message_id = message.id
    monkeypatch.setattr(automatic_drafts, "AsyncSessionLocal", automatic_db)
    monkeypatch.setattr(automatic_drafts.automatic_draft_actor, "send", Mock(side_effect=RedisConnectionError("synthetic broker unavailable")))
    assert await automatic_drafts.dispatch_automatic_drafts(datetime.now(UTC) + timedelta(seconds=1)) == ()
    async with automatic_db() as session:
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message_id))
        assert job is not None and (job.state, job.attempt_count, job.outcome) == ("pending", 0, "broker_unavailable")
        job_id = job.id
    deliveries: list[tuple[UUID, UUID]] = []

    def deliver(job: str, token: str) -> None:
        deliveries.append((UUID(job), UUID(token)))

    monkeypatch.setattr(automatic_drafts.automatic_draft_actor, "send", deliver)
    assert await automatic_drafts.dispatch_automatic_drafts(datetime.now(UTC) + timedelta(minutes=1)) == (job_id,)
    async with automatic_db() as session:
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None and job.state == "dispatched" and job.lease_token is not None
        assert deliveries == [(job_id, job.lease_token)]
