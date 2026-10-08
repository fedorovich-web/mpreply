from __future__ import annotations

import asyncio
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from uuid import UUID, uuid4

import pytest
from dramatiq.middleware import AsyncIO
from dramatiq.worker import Worker
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.workers import auto_reply, automatic_drafts, marketplace_sync
from app.workers.broker import redis_broker


def test_worker_broker_enables_async_actor_runtime() -> None:
    assert any(isinstance(middleware, AsyncIO) for middleware in redis_broker.middleware)


def test_consecutive_actor_jobs_share_the_resource_event_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    owner_loop: asyncio.AbstractEventLoop | None = None
    calls = 0

    async def pooled_operation(*_args: object) -> None:
        nonlocal owner_loop, calls
        current = asyncio.get_running_loop()
        if owner_loop is None:
            owner_loop = current
        assert current is owner_loop, "A pooled connection cannot move to another event loop"
        await asyncio.sleep(0)
        calls += 1

    monkeypatch.setattr(marketplace_sync, "_execute_claimed_stream", pooled_operation)
    monkeypatch.setattr(auto_reply, "_execute_reply", pooled_operation)
    monkeypatch.setattr(automatic_drafts, "_process", pooled_operation)
    middleware = AsyncIO()
    worker = Worker(redis_broker, worker_threads=2)
    middleware.before_worker_boot(redis_broker, worker)
    try:
        with ThreadPoolExecutor(max_workers=2) as threads:
            jobs: list[Callable[[], None]] = [
                partial(marketplace_sync.marketplace_sync_actor.fn, str(uuid4())),
                partial(marketplace_sync.marketplace_sync_actor.fn, str(uuid4())),
                partial(automatic_drafts.automatic_draft_actor.fn, str(uuid4()), str(uuid4())),
                partial(auto_reply.auto_reply_actor.fn, str(uuid4())),
            ]
            for job in jobs:
                threads.submit(job).result(timeout=5)
        assert calls == 4
    finally:
        middleware.after_worker_shutdown(redis_broker, worker)


def test_worker_jobs_reuse_a_real_postgres_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    configured = os.environ.get("MPREPLY_CREDIT_TEST_DATABASE_URL")
    if not configured:
        pytest.skip("Requires the isolated native PostgreSQL test database")
    url = make_url(configured)
    if url.host not in {"127.0.0.1", "localhost"} or not (url.database or "").startswith("mpreply_credit_test_"):
        raise ValueError("Worker tests may only use an isolated local PostgreSQL test database")
    engine = create_async_engine(url, pool_size=1, max_overflow=0, pool_pre_ping=True)
    pids: list[int] = []

    async def pooled_query(*_args: object) -> None:
        async with engine.connect() as connection:
            pids.append(int((await connection.execute(text("SELECT pg_backend_pid()"))).scalar_one()))

    monkeypatch.setattr(marketplace_sync, "_execute_claimed_stream", pooled_query)
    middleware = AsyncIO()
    worker = Worker(redis_broker, worker_threads=2)
    middleware.before_worker_boot(redis_broker, worker)
    try:
        with ThreadPoolExecutor(max_workers=2) as threads:
            for _ in range(3):
                threads.submit(marketplace_sync.marketplace_sync_actor.fn, str(uuid4())).result(timeout=10)
            async def dispose_pool(_id: UUID) -> None:
                await engine.dispose()

            monkeypatch.setattr(marketplace_sync, "_execute_claimed_stream", dispose_pool)
            threads.submit(marketplace_sync.marketplace_sync_actor.fn, str(uuid4())).result(timeout=10)
        assert len(pids) == 3
        assert len(set(pids)) == 1
    finally:
        middleware.after_worker_shutdown(redis_broker, worker)
