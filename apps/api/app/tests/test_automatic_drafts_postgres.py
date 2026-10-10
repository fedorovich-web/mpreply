from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.adapters.capabilities import OZON_CAPABILITY
from app.adapters.http import ReadRetryPolicy
from app.adapters.ozon import OzonAdapter
from app.adapters.registry import MarketplaceAdapterRegistry, ProviderRegistration
from app.core.config import get_settings
from app.core.security import CredentialService
from app.models.ai_draft import AIDraft
from app.models.automatic_draft_job import AutomaticDraftJob
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization
from app.models.reply import Reply
from app.models.user import User
from app.providers.groq import GroqProvider, LLMCompletion, LLMUsage, ProductResearch
from app.services.automatic_draft_service import AutomaticDraftService
from app.services.manual_reply_service import ManualReplyService
from app.services.quota_service import QuotaDecision, QuotaService
from app.services.reply_credit_service import ReplyCreditService
from app.services.reply_execution_service import ExecuteReplyResult, ReplyExecutionService
from app.tests.marketplace_fixtures import SequenceTransport, response
from app.tests.test_ai_credit_generation import VALID_COMPLETION
from app.tests.test_automatic_drafts import seed, synthetic_encryption_key
from app.tests.test_reply_credits_postgres import postgres_credits

__all__ = ["postgres_credits", "synthetic_encryption_key"]


@pytest.mark.parametrize("mode", ["auto", "semi_auto"])
async def test_postgres_human_draft_during_provider_io_prevents_automatic_reply(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, mode: str,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session, mode)
        message_id, org_id = message.id, message.organization_id
        service = AutomaticDraftService(session)
        await service.discover(limit=100)
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message_id))
        assert job is not None
        job_id = job.id
        await service.claim_due(now=datetime.now(UTC), limit=100)
        await session.refresh(job)
        assert job.lease_token is not None
        token = job.lease_token
        await session.commit()

        async def complete(**_: object) -> LLMCompletion:
            async with asyncio.timeout(3), postgres_credits() as concurrent:
                actor = await concurrent.scalar(select(User).join(Organization, Organization.owner_user_id == User.id).where(Organization.id == org_id))
                assert actor is not None
                await ManualReplyService(concurrent).create_draft(
                    actor=actor, message_id=message_id, ai_draft_id=None, reply_text="Preserve this human response",
                )
                await concurrent.commit()
            return VALID_COMPLETION

        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=complete))
        await service.process(job_id=job_id, token=token)
        replies = (await session.scalars(select(Reply).where(Reply.message_id == message_id))).all()
        assert len(replies) == 1 and replies[0].mode == "semi_auto" and replies[0].status == "draft"
        assert replies[0].reply_text == "Preserve this human response"
        assert await session.scalar(select(func.count()).select_from(AIDraft).where(AIDraft.message_id == message_id)) == 0
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.consumed, balance.reserved, balance.available) == (0, 0, 3)


async def test_postgres_concurrent_discovery_and_delivery_create_one_job_and_one_reply(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        message_id, org_id = message.id, message.organization_id

    async def discover() -> int:
        async with postgres_credits() as session:
            return await AutomaticDraftService(session).discover(limit=100)

    await asyncio.gather(*(discover() for _ in range(5)))
    async with postgres_credits() as session:
        assert await session.scalar(select(func.count()).select_from(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message_id)) == 1

    async def claim() -> tuple[tuple[UUID, UUID], ...]:
        async with postgres_credits() as session:
            return await AutomaticDraftService(session).claim_due(now=datetime.now(UTC), limit=100)

    claims = [item for result in await asyncio.gather(*(claim() for _ in range(5))) for item in result]
    async with postgres_credits() as session:
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message_id))
        assert job is not None
        matching = [(job_id, token) for job_id, token in claims if job_id == job.id]
    assert len(matching) == 1
    job_id, token = matching[0]
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))

    async def process() -> None:
        async with postgres_credits() as session:
            await AutomaticDraftService(session).process(job_id=job_id, token=token)

    await asyncio.gather(*(process() for _ in range(5)))
    async with postgres_credits() as session:
        assert await session.scalar(select(func.count()).select_from(AIDraft).where(AIDraft.message_id == message_id)) == 1
        assert await session.scalar(select(func.count()).select_from(Reply).where(Reply.message_id == message_id)) == 1
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.consumed, balance.reserved, balance.available) == (1, 0, 2)


async def test_postgres_provider_io_holds_no_message_or_job_lock(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        service = AutomaticDraftService(session)
        await service.discover(limit=100)
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message.id))
        assert job is not None
        job_id, message_id = job.id, message.id
        await service.claim_due(now=datetime.now(UTC), limit=100)
        await session.refresh(job)
        assert job.lease_token is not None
        token = job.lease_token
        await session.commit()

        async def complete(**_: object) -> LLMCompletion:
            async with asyncio.timeout(3), postgres_credits() as concurrent:
                await concurrent.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(priority="low"))
                await concurrent.execute(update(AutomaticDraftJob).where(AutomaticDraftJob.id == job_id).values(outcome="observed_without_lock"))
                await concurrent.commit()
            return VALID_COMPLETION

        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=complete))
        await service.process(job_id=job_id, token=token)
        await session.refresh(job)
        assert job.state == "completed"


async def test_postgres_job_cannot_reference_message_from_another_tenant(postgres_credits: async_sessionmaker[AsyncSession]) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        other = Organization(name="Other automatic tenant", slug=str(uuid4()))
        session.add(other)
        await session.commit()
        session.add(AutomaticDraftJob(
            organization_id=other.id, message_id=message.id, operation_key=uuid4(), next_attempt_at=datetime.now(UTC),
        ))
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()


async def test_postgres_expired_delivery_token_cannot_start_generation(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with postgres_credits() as session:
        message = await seed(session)
        message_id, org_id = message.id, message.organization_id
        service = AutomaticDraftService(session)
        await service.discover(limit=100)
        await service.claim_due(now=datetime.now(UTC), limit=100)
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message.id))
        assert job is not None and job.lease_token is not None
        job_id, old_token = job.id, job.lease_token
        job.lease_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
        claims = await service.claim_due(now=datetime.now(UTC), limit=100)
        assert any(item[0] == job_id and item[1] != old_token for item in claims)
        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
        await service.process(job_id=job_id, token=old_token)
        assert await session.scalar(select(func.count()).select_from(AIDraft).where(AIDraft.message_id == message_id)) == 0
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.consumed, balance.reserved, balance.available) == (0, 0, 3)


async def test_postgres_import_ai_rules_and_adapter_send_complete_with_one_credit(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Real persistence and Ozon adapter, synthetic credentials and mocked HTTP only."""
    monkeypatch.setattr(GroqProvider, "research_product", AsyncMock(return_value=ProductResearch(
        [{"url": "https://parts.example/tp123", "title": "TP123", "excerpt": "Test product TP123"}],
        "search-test", LLMUsage(1, 2, 3, None), 1,
    )))
    transport = SequenceTransport([
        response(200, json={"answers": [], "last_id": ""}), response(200, json={"answer_id": "synthetic-answer"}),
    ])
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    async with postgres_credits() as session, httpx.AsyncClient(base_url="https://api-seller.ozon.ru", transport=transport.mock()) as client:
        message = await seed(session)
        account = await session.get(MarketplaceAccount, message.marketplace_account_id)
        assert account is not None
        account.seller_id = "100200"
        account.scopes_json = {"scopes": ["questions:read", "questions:write"]}
        account.credentials_encrypted = CredentialService(get_settings().credentials_encryption_key.get_secret_value()).encrypt("synthetic-api-key")
        message.metadata_json = {"sku": 646399170}
        await session.commit()
        pipeline = AutomaticDraftService(session)
        await pipeline.discover(limit=100)
        await pipeline.claim_due(now=datetime.now(UTC), limit=100)
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message.id))
        assert job is not None and job.lease_token is not None
        await pipeline.process(job_id=job.id, token=job.lease_token)
        reply = await session.scalar(select(Reply).where(Reply.message_id == message.id))
        assert reply is not None and reply.status == "queued"
        adapter = OzonAdapter(client, read_retry_policy=ReadRetryPolicy(max_attempts=1))
        registry = MarketplaceAdapterRegistry({Marketplace.OZON: ProviderRegistration(
            capability=OZON_CAPABILITY, credential_factory=lambda: adapter, review_factory=lambda: adapter,
        )})
        execution = ReplyExecutionService(session, registry=registry)
        result = await execution.execute_reply(reply_id=reply.id)
        assert result.status == "sent"
        await execution.execute_reply(reply_id=reply.id)
        await session.refresh(message)
        assert message.status == "auto_reply_sent"
        assert [request.url.path for request in transport.requests] == ["/v1/question/answer/list", "/v1/question/answer/create"]
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved) == (1, 0)



async def test_postgres_concurrent_auto_sends_reserve_organization_quota(
    postgres_credits: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Concurrent workers must reserve quota before either performs provider I/O."""
    settings = get_settings()
    monkeypatch.setattr(settings, "auto_reply_daily_limit_default", 100)
    monkeypatch.setattr(
        GroqProvider,
        "research_product",
        AsyncMock(return_value=ProductResearch(
            [{"url": "https://parts.example/tp123", "title": "TP123", "excerpt": "Test product TP123"}],
            "search-test", LLMUsage(1, 2, 3, None), 1,
        )),
    )
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))

    async with postgres_credits() as session:
        first_message = await seed(session)
        account = await session.get(MarketplaceAccount, first_message.marketplace_account_id)
        assert account is not None
        account.seller_id = "100200"
        account.scopes_json = {"scopes": ["questions:read", "questions:write"]}
        account.credentials_encrypted = CredentialService(
            settings.credentials_encryption_key.get_secret_value()
        ).encrypt("synthetic-api-key")
        first_message.metadata_json = {"sku": 646399170}

        now = datetime.now(UTC)
        second_message = CustomerMessage(
            organization_id=first_message.organization_id,
            marketplace_account_id=first_message.marketplace_account_id,
            product_id=first_message.product_id,
            marketplace="ozon",
            external_id=str(uuid4()),
            type="question",
            rating=5,
            status="needs_reply",
            customer_text="Will this item fit my model?",
            imported_at=now,
            last_synced_at=now,
            marketplace_created_at=now,
            metadata_json={"sku": 646399171},
        )
        session.add(second_message)
        await session.flush()
        message_ids = (first_message.id, second_message.id)
        await session.commit()

        pipeline = AutomaticDraftService(session)
        await pipeline.discover(limit=100)
        claims = dict(await pipeline.claim_due(now=datetime.now(UTC), limit=100))
        jobs = (await session.scalars(
            select(AutomaticDraftJob).where(AutomaticDraftJob.message_id.in_(message_ids))
        )).all()
        assert len(jobs) == 2 and all(job.id in claims for job in jobs)
        for job in jobs:
            await pipeline.process(job_id=job.id, token=claims[job.id])

        replies = (await session.scalars(
            select(Reply).where(Reply.message_id.in_(message_ids))
        )).all()
        assert len(replies) == 2 and all(reply.status == "queued" for reply in replies)
        reply_ids = tuple(reply.id for reply in replies)

    monkeypatch.setattr(settings, "auto_reply_daily_limit_default", 1)
    original_check = QuotaService.check_auto_reply_quota
    quota_checks_finished = 0
    both_quota_checks_finished = asyncio.Event()

    async def delayed_check(
        self: QuotaService,
        *,
        organization_id: UUID,
        automation_rule_id: UUID | None,
        hourly_limit: int | None,
        daily_limit: int | None,
        now: datetime | None = None,
    ) -> QuotaDecision:
        nonlocal quota_checks_finished
        decision = await original_check(
            self,
            organization_id=organization_id,
            automation_rule_id=automation_rule_id,
            hourly_limit=hourly_limit,
            daily_limit=daily_limit,
            now=now,
        )
        await asyncio.sleep(0.15)
        quota_checks_finished += 1
        if quota_checks_finished == 2:
            both_quota_checks_finished.set()
        return decision

    monkeypatch.setattr(QuotaService, "check_auto_reply_quota", delayed_check)

    first_preflight_entered = asyncio.Event()
    release_first_preflight = asyncio.Event()
    preflight_calls = 0
    send_calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal preflight_calls, send_calls
        if request.url.path == "/v1/question/answer/list":
            preflight_calls += 1
            if preflight_calls == 1:
                first_preflight_entered.set()
                await release_first_preflight.wait()
            return httpx.Response(200, json={"answers": [], "last_id": ""})
        if request.url.path == "/v1/question/answer/create":
            send_calls += 1
            return httpx.Response(200, json={"answer_id": str(uuid4())})
        return httpx.Response(404, json={"error": "unexpected endpoint"})

    async with httpx.AsyncClient(
        base_url="https://api-seller.ozon.ru",
        transport=httpx.MockTransport(handler),
    ) as client:
        adapter = OzonAdapter(client, read_retry_policy=ReadRetryPolicy(max_attempts=1))
        registry = MarketplaceAdapterRegistry({Marketplace.OZON: ProviderRegistration(
            capability=OZON_CAPABILITY, credential_factory=lambda: adapter, review_factory=lambda: adapter,
        )})

        async def execute(reply_id: UUID) -> ExecuteReplyResult:
            async with postgres_credits() as session:
                return await ReplyExecutionService(session, registry=registry).execute_reply(reply_id=reply_id)

        tasks = [asyncio.create_task(execute(reply_id)) for reply_id in reply_ids]
        try:
            await asyncio.wait_for(first_preflight_entered.wait(), timeout=5)
            await asyncio.wait_for(both_quota_checks_finished.wait(), timeout=5)
        finally:
            release_first_preflight.set()
        results = await asyncio.wait_for(asyncio.gather(*tasks), timeout=10)

    assert sum(result.status == "sent" for result in results) == 1
    assert sum(
        result.status == "manual_review_required"
        and result.error_code == "organization_daily_limit_exceeded"
        for result in results
    ) == 1
    assert preflight_calls == 1
    assert send_calls == 1
