from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.models.ai_draft import AIDraft
from app.models.automatic_draft_job import AutomaticDraftJob
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import Organization, OrganizationUser
from app.models.product import Product
from app.models.reply import Reply
from app.models.reply_credit import ReplyCreditOperation
from app.models.user import User
from app.providers.groq import GroqProvider, GroqProviderError, LLMCompletion
from app.services.ai_service import AIService
from app.services.automatic_draft_service import AutomaticDraftService
from app.services.manual_reply_service import ManualReplyService
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_ai_credit_generation import VALID_COMPLETION
from app.tests.test_reply_credits import credit_session_factory


@pytest.fixture
async def automatic_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


async def seed(session: AsyncSession, mode: str = "auto") -> CustomerMessage:
    actor = User(email=f"{uuid4()}@automatic.example", password_hash="synthetic-test-only", status="active")
    session.add(actor)
    await session.flush()
    organization = Organization(name="Automatic test", slug=str(uuid4()), status="active", owner_user_id=actor.id, default_response_mode=mode)
    session.add(organization)
    await session.flush()
    session.add(OrganizationUser(organization_id=organization.id, user_id=actor.id, role="owner", status="active"))
    account = MarketplaceAccount(
        organization_id=organization.id, marketplace="ozon", display_name="Test account", status="active",
        credentials_status="valid", default_response_mode="inherit", credentials_encrypted="synthetic-not-usable",
        credentials_fingerprint="test", scopes_json={},
    )
    session.add(account)
    await session.flush()
    product = Product(
        organization_id=organization.id, marketplace_account_id=account.id,
        marketplace="ozon", external_id="automatic-product", name="Test product",
    )
    session.add(product)
    await session.flush()
    now = datetime.now(UTC)
    message = CustomerMessage(
        organization_id=organization.id, marketplace_account_id=account.id, product_id=product.id,
        marketplace="ozon", external_id=str(uuid4()), type="question", rating=5, status="needs_reply",
        customer_text="Is this item available?", imported_at=now, last_synced_at=now, marketplace_created_at=now,
    )
    session.add(message)
    await ReplyCreditService(session).grant(
        organization_id=organization.id, source_key="trial", kind="trial", quantity=3,
        expires_at=datetime.now(UTC) + timedelta(days=14),
    )
    await session.commit()
    return message


@pytest.fixture(autouse=True)
def synthetic_encryption_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "credentials_encryption_key", SecretStr(Fernet.generate_key().decode()))


@pytest.mark.parametrize("mode,expected_status,reply_count", [("auto", "auto_reply_pending", 1), ("semi_auto", "waiting_review", 1)])
async def test_imported_message_generates_once_and_routes_by_workspace_rules(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
    mode: str, expected_status: str, reply_count: int,
) -> None:
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    async with automatic_db() as session:
        message = await seed(session, mode)
        service = AutomaticDraftService(session)
        assert await service.discover(limit=25) == 1
        assert await service.discover(limit=25) == 0
        claims = await service.claim_due(now=datetime.now(UTC), limit=25)
        assert len(claims) == 1
        job_id, token = claims[0]
        await service.process(job_id=job_id, token=token)
        await service.process(job_id=job_id, token=token)
        await session.refresh(message)
        assert message.status == expected_status
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 1
        assert await session.scalar(select(func.count()).select_from(Reply).where(Reply.message_id == message.id)) == reply_count
        if mode == "semi_auto":
            actor = await session.scalar(select(User))
            assert actor is not None
            rows, total = await ManualReplyService(session).list_review_queue(actor=actor, organization_id=message.organization_id, page=1, page_size=25)
            assert total == 1 and rows[0][0].ai_draft_id is not None
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved) == (1, 0)


@pytest.mark.parametrize("blocked", ["demo", "account", "viewer", "answered", "empty"])
async def test_discovery_excludes_ineligible_messages(
    automatic_db: async_sessionmaker[AsyncSession], blocked: str,
) -> None:
    async with automatic_db() as session:
        message = await seed(session)
        if blocked == "demo":
            organization = await session.get(Organization, message.organization_id)
            assert organization is not None
            organization.status = "demo"
        elif blocked == "account":
            account = await session.get(MarketplaceAccount, message.marketplace_account_id)
            assert account is not None
            account.status = "disabled"
        elif blocked == "viewer":
            membership = await session.scalar(select(OrganizationUser))
            assert membership is not None
            membership.role = "viewer"
        elif blocked == "answered":
            message.status = "answered"
        else:
            message.customer_text = "   "
        await session.commit()
        assert await AutomaticDraftService(session).discover(limit=25) == 0


async def test_provider_failure_releases_credit_and_confirmed_ended_operation_can_retry(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=GroqProviderError("synthetic failure")))
    async with automatic_db() as session:
        message = await seed(session)
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await service.process(job_id=job_id, token=token)
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.available, balance.reserved, balance.consumed) == (3, 0, 0)
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None and job.state == "pending"
        key = job.operation_key
        # The failed generation already confirmed release and rotated the key.
        job_id, token = (await service.claim_due(now=datetime.now(UTC) + timedelta(minutes=2)))[0]
        await service.process(job_id=job_id, token=token)
        await session.refresh(job)
        assert job.operation_key != key and job.state == "pending" and job.attempt_count == 2
        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
        job_id, token = (await service.claim_due(now=datetime.now(UTC) + timedelta(minutes=2)))[0]
        await service.process(job_id=job_id, token=token)
        await session.refresh(job)
        assert job.state == "completed"
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved) == (1, 0)


async def test_broker_failure_does_not_lose_job_or_use_generation_attempt(
    automatic_db: async_sessionmaker[AsyncSession],
) -> None:
    async with automatic_db() as session:
        await seed(session)
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await service.dispatch_failed(job_id=job_id, token=token)
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None and (job.state, job.attempt_count, job.outcome) == ("pending", 0, "broker_unavailable")
        assert await service.claim_due(now=datetime.now(UTC)) == ()
        assert len(await service.claim_due(now=datetime.now(UTC) + timedelta(minutes=1))) == 1


@pytest.mark.parametrize("prior_attempts", [0, 3])
async def test_crash_after_generation_recovers_original_draft_without_second_charge(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
    prior_attempts: int,
) -> None:
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    async with automatic_db() as session:
        message = await seed(session)
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await session.execute(update(AutomaticDraftJob).where(AutomaticDraftJob.id == job_id).values(attempt_count=prior_attempts))
        await session.commit()
        original_commit = session.commit

        async def crash_on_routing_commit() -> None:
            if any(isinstance(value, AutomaticDraftJob) and value.state == "completed" for value in session.identity_map.values()):
                raise RuntimeError("synthetic crash after generation")
            await original_commit()

        monkeypatch.setattr(session, "commit", crash_on_routing_commit)
        with pytest.raises(RuntimeError):
            await service.process(job_id=job_id, token=token)
        await session.rollback()
        monkeypatch.setattr(session, "commit", original_commit)
        await session.execute(update(AutomaticDraftJob).where(AutomaticDraftJob.id == job_id).values(
            lease_expires_at=datetime.now(UTC) - timedelta(seconds=1),
        ))
        await session.commit()
        recovered_id, recovered_token = (await service.claim_due(now=datetime.now(UTC)))[0]
        assert recovered_id == job_id and recovered_token != token
        await service.process(job_id=job_id, token=token)
        await service.process(job_id=job_id, token=recovered_token)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 1
        assert await session.scalar(select(func.count()).select_from(Reply).where(Reply.message_id == message.id)) == 1
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved) == (1, 0)


@pytest.mark.parametrize("change", ["lease", "account", "demo", "role"])
async def test_late_worker_cannot_consume_credit_after_eligibility_or_lease_changes(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, change: str,
) -> None:
    async with automatic_db() as session:
        message = await seed(session)
        organization_id, account_id = message.organization_id, message.marketplace_account_id
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]

        async def complete(**_: object) -> LLMCompletion:
            async with automatic_db() as concurrent:
                if change == "lease":
                    await concurrent.execute(update(AutomaticDraftJob).where(AutomaticDraftJob.id == job_id).values(lease_token=uuid4()))
                elif change == "account":
                    await concurrent.execute(update(MarketplaceAccount).where(MarketplaceAccount.id == account_id).values(status="disabled"))
                elif change == "role":
                    await concurrent.execute(update(OrganizationUser).where(OrganizationUser.organization_id == organization_id).values(role="viewer"))
                else:
                    await concurrent.execute(update(Organization).where(Organization.id == organization_id).values(status="demo"))
                await concurrent.commit()
            return VALID_COMPLETION

        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=complete))
        await service.process(job_id=job_id, token=token)
        balance = await ReplyCreditService(session).balance(organization_id=organization_id)
        assert (balance.consumed, balance.reserved, balance.available) == (0, 0, 3)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0


async def test_changed_input_after_generation_is_not_queued_for_send(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
    original_generate = AIService.generate_draft
    async with automatic_db() as session:
        message = await seed(session)
        message_id = message.id

        async def generate(
            service: AIService, *, actor: User, message_id: UUID, operation_key: UUID,
            automatic_job: tuple[UUID, UUID] | None = None,
        ) -> AIDraft:
            draft = await original_generate(service, actor=actor, message_id=message_id, operation_key=operation_key, automatic_job=automatic_job)
            async with automatic_db() as concurrent:
                await concurrent.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(customer_text="Updated question"))
                await concurrent.commit()
            return draft

        monkeypatch.setattr(AIService, "generate_draft", generate)
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await service.process(job_id=job_id, token=token)
        assert await session.scalar(select(func.count()).select_from(Reply).where(Reply.message_id == message_id)) == 0
        await session.refresh(message)
        assert message.status == "needs_manual_check"


@pytest.mark.parametrize("flag,expected_reply_status", [("needs_manual_review", "waiting_review"), ("policy_violation", "manual_review_required")])
async def test_unsafe_automatic_draft_appears_in_human_review_without_send_job(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, flag: str, expected_reply_status: str,
) -> None:
    completion = LLMCompletion(
        text='{"answer":"Test response","confidence_score":0.9,"safety_flags":["' + flag + '"]}',
        model="test-model", usage=VALID_COMPLETION.usage, latency_ms=1,
    )
    monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=completion))
    async with automatic_db() as session:
        message = await seed(session)
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await service.process(job_id=job_id, token=token)
        reply = await session.scalar(select(Reply).where(Reply.message_id == message.id))
        assert reply is not None and reply.mode == "semi_auto" and reply.status == expected_reply_status
        assert reply.idempotency_key is None
        actor = await session.scalar(select(User))
        assert actor is not None
        _, total = await ManualReplyService(session).list_review_queue(actor=actor, organization_id=message.organization_id, page=1, page_size=25)
        assert total == 1


async def test_still_reserved_generation_is_retried_without_releasing_another_attempt(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with automatic_db() as session:
        message = await seed(session)
        actor = await session.scalar(select(User))
        assert actor is not None
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None
        request_hash = sha256(json.dumps({
            "actor_id": str(actor.id), "message_id": str(message.id), "tone": "neutral",
            "temperature": 0.3, "max_tokens": 600, "brand_rules": None, "knowledge_base": None,
        }, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        operation = await ReplyCreditService(session).reserve(
            organization_id=message.organization_id, operation_key=job.operation_key, request_hash=request_hash,
        )
        operation_id = operation.id
        await session.commit()
        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(return_value=VALID_COMPLETION))
        await service.process(job_id=job_id, token=token)
        await session.refresh(job)
        assert job.state == "pending"
        operation = await session.get(ReplyCreditOperation, operation_id)
        assert operation is not None and operation.state == "reserved"


@pytest.mark.parametrize("mode", ["auto", "semi_auto"])
@pytest.mark.parametrize("phase", ["provider", "routing"])
async def test_human_draft_takes_priority_over_automatic_generation(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
    mode: str, phase: str,
) -> None:
    async with automatic_db() as session:
        message = await seed(session, mode)
        message_id, org_id = message.id, message.organization_id
        service = AutomaticDraftService(session)
        await service.discover()
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]

        async def save_human_draft() -> None:
            async with automatic_db() as concurrent:
                actor = await concurrent.scalar(select(User))
                assert actor is not None
                await ManualReplyService(concurrent).create_draft(
                    actor=actor, message_id=message_id, ai_draft_id=None,
                    reply_text="Human response saved while AI was running",
                )
                await concurrent.commit()

        async def complete(**_: object) -> LLMCompletion:
            if phase == "provider":
                await save_human_draft()
            return VALID_COMPLETION

        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=complete))
        if phase == "routing":
            original_generate = AIService.generate_draft

            async def generate(
                ai: AIService, *, actor: User, message_id: UUID, operation_key: UUID,
                automatic_job: tuple[UUID, UUID] | None = None,
            ) -> AIDraft:
                draft = await original_generate(ai, actor=actor, message_id=message_id, operation_key=operation_key, automatic_job=automatic_job)
                await save_human_draft()
                return draft

            monkeypatch.setattr(AIService, "generate_draft", generate)

        await service.process(job_id=job_id, token=token)
        replies = (await session.scalars(select(Reply).where(Reply.message_id == message_id))).all()
        assert len(replies) == 1
        assert (replies[0].mode, replies[0].status, replies[0].ai_draft_id) == ("semi_auto", "draft", None)
        assert replies[0].reply_text == "Human response saved while AI was running"
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None and job.state == "failed"
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.consumed, balance.reserved) == (1 if phase == "routing" else 0, 0)


async def test_released_operation_rotation_does_not_exhaust_provider_retry_budget(
    automatic_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch,
) -> None:
    completion = AsyncMock(side_effect=[GroqProviderError("first failure"), GroqProviderError("second failure"), VALID_COMPLETION])
    monkeypatch.setattr(GroqProvider, "complete", completion)
    async with automatic_db() as session:
        message = await seed(session)
        service = AutomaticDraftService(session)
        await service.discover()
        job = await session.scalar(select(AutomaticDraftJob).where(AutomaticDraftJob.message_id == message.id))
        assert job is not None
        job_id = job.id
        for _ in range(3):
            claimed_id, token = (await service.claim_due(now=datetime.now(UTC) + timedelta(minutes=2)))[0]
            assert claimed_id == job_id
            await service.process(job_id=job_id, token=token)
        job = await session.get(AutomaticDraftJob, job_id)
        assert job is not None and job.state == "completed" and job.attempt_count == 3
        assert completion.await_count == 3
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved, balance.available) == (1, 0, 2)
