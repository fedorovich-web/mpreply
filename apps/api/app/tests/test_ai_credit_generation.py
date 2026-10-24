from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.ai_draft import AIDraft
from app.models.audit_log import AuditLog
from app.models.customer_message import CustomerMessage
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.providers.groq import GroqProvider, GroqProviderError, LLMCompletion, LLMUsage
from app.services.ai_service import AIService
from app.services.demo_workspace_service import ensure_demo_workspace
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_reply_credits import credit_session_factory


@pytest.fixture
async def credit_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


VALID_COMPLETION = LLMCompletion(
    text='{"answer":"Thank you for your feedback.","confidence_score":0.9,"safety_flags":[]}',
    model="test-model",
    usage=LLMUsage(10, 10, 20, None),
    latency_ms=1,
)


@pytest.mark.asyncio
async def test_generation_commits_reservation_before_provider_and_replay_returns_same_draft(
    credit_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        await session.flush()
        await ReplyCreditService(session).grant(organization_id=message.organization_id, source_key="paid", kind="addon", quantity=50)
        await session.commit()
        await ReplyCreditService(session).grant(
            organization_id=message.organization_id,
            source_key="trial",
            kind="trial",
            quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()

        async def complete(**_: object) -> LLMCompletion:
            async with credit_db() as observed:
                balance = await ReplyCreditService(observed).balance(organization_id=message.organization_id)
                assert balance.reserved == 1
                assert await observed.scalar(select(func.count()).select_from(AIDraft)) == 0
            return VALID_COMPLETION

        provider = AsyncMock(side_effect=complete)
        monkeypatch.setattr(GroqProvider, "complete", provider)
        key = uuid4()
        service = AIService(session)
        draft = await service.generate_draft(actor=actor, message_id=message.id, operation_key=key)
        repeated = await service.generate_draft(actor=actor, message_id=message.id, operation_key=key)
        assert draft.id == repeated.id
        assert provider.await_count == 1
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 1
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.consumed, balance.reserved, balance.trial_available, balance.paid_available) == (1, 0, 0, 50)
        with pytest.raises(HTTPException) as exhausted:
            await service.generate_draft(actor=actor, message_id=message.id, operation_key=uuid4())
        assert exhausted.value.status_code == 402
        assert provider.await_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["provider", "malformed", "persist", "timeout"])
async def test_generation_failure_never_consumes_a_reply(
    credit_db: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        org_id, message_id = message.organization_id, message.id
        await session.flush()
        await ReplyCreditService(session).grant(
            organization_id=org_id,
            source_key="trial",
            kind="trial",
            quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        completion = VALID_COMPLETION if failure != "malformed" else LLMCompletion("invalid", "test", LLMUsage(0, 0, 0, None), 1)
        provider_error = GroqProviderError("synthetic failure") if failure == "provider" else TimeoutError() if failure == "timeout" else None
        provider = AsyncMock(return_value=completion, side_effect=provider_error)
        monkeypatch.setattr(GroqProvider, "complete", provider)
        if failure == "persist":
            monkeypatch.setattr(ReplyCreditService, "consume", AsyncMock(side_effect=RuntimeError("synthetic persistence failure")))
        with pytest.raises((HTTPException, RuntimeError)) as failed:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4())
        if failure == "timeout":
            assert isinstance(failed.value, HTTPException) and failed.value.status_code == 502
    async with credit_db() as observed:
        balance = await ReplyCreditService(observed).balance(organization_id=org_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await observed.scalar(select(func.count()).select_from(AIDraft)) == 0
        failure_audit = await observed.scalar(select(AuditLog).where(AuditLog.action == "ai_draft.failed"))
        assert failure_audit is not None
        expected_code = {"provider": "groq_error", "malformed": "groq_malformed_response", "persist": "generation_failed", "timeout": "generation_timeout"}[
            failure
        ]
        assert failure_audit.metadata_json["error_code"] == expected_code


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["answered", "auto_reply_sent", "sending", "auto_reply_pending", "approved", "archived"])
async def test_generation_does_not_call_provider_for_handled_or_inflight_message(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, status: str,
) -> None:
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        message.status = status
        org_id, message_id = message.organization_id, message.id
        await ReplyCreditService(session).grant(
            organization_id=org_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        provider = AsyncMock(return_value=VALID_COMPLETION)
        monkeypatch.setattr(GroqProvider, "complete", provider)
        with pytest.raises(HTTPException) as failed:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4())
        assert failed.value.status_code == 409
        provider.assert_not_awaited()
        await session.refresh(message)
        assert message.status == status
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["answered", "text", "rating", "product"])
async def test_late_generation_does_not_overwrite_changed_message_or_consume_credit(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, change: str,
) -> None:
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        message.status = "needs_reply"
        message.rating = 5
        product = Product(
            id=uuid4(), organization_id=message.organization_id, marketplace_account_id=message.marketplace_account_id,
            marketplace=message.marketplace, external_id="generation-context-test", name="Context test item", metadata_json={"size": "original"},
        )
        session.add(product)
        await session.flush()
        message.product_id = product.id
        org_id, message_id, product_id = message.organization_id, message.id, message.product_id
        await ReplyCreditService(session).grant(
            organization_id=org_id, source_key="trial", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()

        async def complete(**_: object) -> LLMCompletion:
            async with credit_db() as concurrent:
                if change == "product":
                    await concurrent.execute(update(Product).where(Product.id == product_id).values(metadata_json={"size": "changed"}))
                else:
                    values = {"status": "answered"} if change == "answered" else {"customer_text": "Updated question"} if change == "text" else {"rating": 1}
                    await concurrent.execute(update(CustomerMessage).where(CustomerMessage.id == message_id).values(**values))
                await concurrent.commit()
            return VALID_COMPLETION

        monkeypatch.setattr(GroqProvider, "complete", AsyncMock(side_effect=complete))
        with pytest.raises(HTTPException) as failed:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4())
        assert failed.value.status_code == 409
        await session.refresh(message)
        assert message.status == ("answered" if change == "answered" else "needs_reply")
        balance = await ReplyCreditService(session).balance(organization_id=org_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0
