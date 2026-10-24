from __future__ import annotations

import asyncio
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from uuid import UUID, uuid4

import httpx
import pytest
from dramatiq.middleware import AsyncIO
from dramatiq.worker import Worker
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.adapters.capabilities import OZON_CAPABILITY
from app.adapters.ozon import OzonAdapter
from app.adapters.registry import MarketplaceAdapterRegistry, ProviderRegistration
from app.core.config import get_settings
from app.core.security import CredentialService
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.models.reply import Reply
from app.services.reply_execution_service import ReplyExecutionService
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits
from app.workers import auto_reply, automatic_drafts, marketplace_sync
from app.workers.broker import redis_broker

__all__ = ["postgres_credits", "synthetic_encryption_key"]


async def test_postgres_reply_write_fence_does_not_block_on_ingestion_foreign_key_lock(
    postgres_credits: async_sessionmaker[AsyncSession],
) -> None:
    async with postgres_credits() as session:
        message = await seed(session, "semi_auto")
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert account is not None
        account.seller_id = "100200"
        account.scopes_json = {"scopes": ["questions:read", "questions:write"]}
        account.credentials_encrypted = CredentialService(get_settings().credentials_encryption_key.get_secret_value()).encrypt("synthetic-api-key")
        message.metadata_json = {"sku": 646399170}
        message.status = "approved"
        reply = Reply(organization_id=message.organization_id, message_id=message.id, reply_text="Synthetic reply",
                      status="queued", mode="semi_auto", idempotency_key=str(uuid4()))
        session.add(reply)
        await session.commit()
        reply_id, organization_id, account_id = reply.id, account.organization_id, account.id

    preflight_started, finish_preflight = asyncio.Event(), asyncio.Event()
    writes = 0

    async def provider(request: httpx.Request) -> httpx.Response:
        nonlocal writes
        if request.url.path == "/v1/question/answer/list":
            preflight_started.set()
            await finish_preflight.wait()
            return httpx.Response(200, json={"answers": [], "last_id": ""})
        assert request.url.path == "/v1/question/answer/create"
        writes += 1
        return httpx.Response(200, json={"answer_id": "synthetic-answer"})

    async with httpx.AsyncClient(base_url="https://provider.invalid", transport=httpx.MockTransport(provider)) as client:
        adapter = OzonAdapter(client)
        registry = MarketplaceAdapterRegistry({Marketplace.OZON: ProviderRegistration(
            capability=OZON_CAPABILITY, credential_factory=lambda: adapter, review_factory=lambda: adapter,
        )})
        async with postgres_credits() as session:
            engine = session.bind
            assert isinstance(engine, AsyncEngine)
        async with engine.connect() as connection, AsyncSession(bind=connection, expire_on_commit=False) as worker_session, postgres_credits() as ingest:
            worker_pid = await worker_session.scalar(text("SELECT pg_backend_pid()"))
            execution = asyncio.create_task(ReplyExecutionService(worker_session, registry=registry).execute_reply(reply_id=reply_id))
            try:
                await asyncio.wait_for(preflight_started.wait(), timeout=5)
                ingest.add(Product(organization_id=organization_id, marketplace_account_id=account_id,
                                   marketplace="ozon", external_id=str(uuid4()), name="Synthetic imported product"))
                await ingest.flush()
                ingest_pid = await ingest.scalar(text("SELECT pg_backend_pid()"))
                finish_preflight.set()
                blocked = False
                async with asyncio.timeout(10), postgres_credits() as observer:
                    while not execution.done():
                        blocked = bool(await observer.scalar(
                            text("SELECT :ingest_pid = ANY(pg_blocking_pids(:worker_pid))"),
                            {"ingest_pid": ingest_pid, "worker_pid": worker_pid},
                        ))
                        if blocked:
                            break
                        await asyncio.sleep(0.01)
                assert not blocked, "Reply write fence blocked behind ingestion's account foreign-key lock"
                assert (await execution).status == "sent"
                assert writes == 1
                assert ingest.in_transaction()
            finally:
                if not execution.done():
                    execution.cancel()
                    await asyncio.gather(execution, return_exceptions=True)
                await ingest.rollback()


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
