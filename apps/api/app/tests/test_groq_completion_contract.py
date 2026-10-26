from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.services.ai_service as ai_service
from app.models.ai_draft import AIDraft
from app.models.audit_log import AuditLog
from app.models.automatic_draft_job import AutomaticDraftJob
from app.models.customer_message import CustomerMessage
from app.models.organization import OrganizationUser
from app.models.reply import Reply
from app.providers.groq import GroqProvider, GroqProviderError
from app.services.ai_service import AIService
from app.services.automatic_draft_service import AutomaticDraftService
from app.services.demo_workspace_service import ensure_demo_workspace
from app.services.reply_credit_service import ReplyCreditService
from app.tests.test_automatic_drafts import seed
from app.tests.test_reply_credits import credit_session_factory


def response_payload(failure: str) -> dict[str, object]:
    message: dict[str, object] = {
        "role": "assistant",
        "content": json.dumps({"answer": "Synthetic safe reply", "confidence_score": 0.99, "safety_flags": []}),
        "executed_tools": [{"browser_results": [{
            "url": "https://parts.example/0530023778", "title": "Haier 0530023778", "content": "Haier 0530023778 hotplate",
        }]}],
    }
    choice: dict[str, object] = {"finish_reason": "stop", "message": message}
    payload: dict[str, object] = {"model": "synthetic-model", "choices": [choice]}
    if failure in {"length", "content_filter", "tool_calls", "unknown"}:
        choice["finish_reason"] = failure
    elif failure == "missing_finish":
        del choice["finish_reason"]
    elif failure == "refusal":
        message["refusal"] = "synthetic-private-provider-detail"
    elif failure == "pending_tool":
        message["tool_calls"] = [{"id": "synthetic-tool"}]
    elif failure == "legacy_function":
        message["function_call"] = {"name": "synthetic-tool"}
    elif failure == "wrong_role":
        message["role"] = "user"
    elif failure == "multiple_choices":
        payload["choices"] = [choice, dict(choice)]
    elif failure in {"response_error", "choice_error", "message_error"}:
        target = payload if failure == "response_error" else choice if failure == "choice_error" else message
        target["error"] = {"message": "synthetic-private-provider-detail"}
    return payload


@pytest.mark.parametrize("operation", ["complete", "research"])
@pytest.mark.parametrize("failure", [
    "length", "content_filter", "tool_calls", "unknown", "missing_finish", "refusal", "pending_tool",
    "legacy_function", "wrong_role", "multiple_choices", "response_error", "choice_error", "message_error",
])
async def test_provider_rejects_unsuccessful_envelopes_without_retry(
    operation: Literal["complete", "research"], failure: str,
) -> None:
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, request=request, json=response_payload(failure))

    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler))
    with pytest.raises(GroqProviderError) as rejected:
        if operation == "complete":
            await provider.complete(model="synthetic-model", messages=[])
        else:
            await provider.research_product(name="Haier 0530023778", sku="0530023778", brand="Haier")
    assert requests == 1
    assert "synthetic-private-provider-detail" not in str(rejected.value)


@pytest.mark.parametrize("failure,error_code", [
    ("length", "groq_incomplete_response"),
    ("refusal", "groq_refused_response"),
    ("response_error", "groq_response_error"),
    ("wrong_role", "groq_malformed_response"),
])
async def test_rejected_groq_output_is_not_automatically_regenerated(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, failure: str, error_code: str,
) -> None:
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, request=request, json=response_payload(failure))

    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler))

    def configured_provider(**_: object) -> GroqProvider:
        return provider

    monkeypatch.setattr(ai_service, "GroqProvider", configured_provider)
    async with credit_db() as session:
        message = await seed(session)
        message.product_id = None
        await session.commit()
        service = AutomaticDraftService(session)
        assert await service.discover() == 1
        job_id, token = (await service.claim_due(now=datetime.now(UTC)))[0]
        await service.process(job_id=job_id, token=token)
        job = await session.get(AutomaticDraftJob, job_id, populate_existing=True)
        assert job is not None and job.state == "failed" and job.outcome == error_code
        assert job.attempt_count == 1 and job.lease_token is None and job.lease_expires_at is None
        message = await session.get(CustomerMessage, message.id, populate_existing=True)
        assert message is not None and message.status == "needs_manual_check"
        assert await service.claim_due(now=datetime.now(UTC) + timedelta(minutes=10)) == ()
        assert await service.discover() == 0
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0
        assert await session.scalar(select(func.count()).select_from(Reply)) == 0
        balance = await ReplyCreditService(session).balance(organization_id=message.organization_id)
        assert (balance.available, balance.reserved, balance.consumed) == (3, 0, 0)
    assert requests == 1


@pytest.fixture
async def credit_db() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    async for factory in credit_session_factory():
        yield factory


@pytest.mark.parametrize("failure,error_code", [
    ("length", "groq_incomplete_response"),
    ("refusal", "groq_refused_response"),
    ("response_error", "groq_response_error"),
])
async def test_unsuccessful_groq_completion_releases_credit_without_persisting_draft(
    credit_db: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch, failure: str, error_code: str,
) -> None:
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(200, request=request, json=response_payload(failure))

    provider = GroqProvider(api_key="synthetic-key", transport=httpx.MockTransport(handler))

    def configured_provider(**_: object) -> GroqProvider:
        return provider

    monkeypatch.setattr(ai_service, "GroqProvider", configured_provider)
    async with credit_db() as session:
        actor = await ensure_demo_workspace(session)
        membership = await session.scalar(select(OrganizationUser))
        message = await session.scalar(select(CustomerMessage))
        assert membership is not None and message is not None
        membership.role = "manager"
        message.product_id = None
        organization_id, message_id, original_status = message.organization_id, message.id, message.status
        await ReplyCreditService(session).grant(
            organization_id=organization_id, source_key="synthetic", kind="trial", quantity=1,
            expires_at=datetime.now(UTC) + timedelta(days=14),
        )
        await session.commit()
        with pytest.raises(HTTPException) as rejected:
            await AIService(session).generate_draft(actor=actor, message_id=message_id, operation_key=uuid4())
        assert rejected.value.status_code == 502
    async with credit_db() as session:
        balance = await ReplyCreditService(session).balance(organization_id=organization_id)
        assert (balance.available, balance.reserved, balance.consumed) == (1, 0, 0)
        assert await session.scalar(select(func.count()).select_from(AIDraft)) == 0
        message = await session.get(CustomerMessage, message_id)
        assert message is not None and message.status == original_status
        audit = await session.scalar(select(AuditLog).where(AuditLog.action == "ai_draft.failed"))
        assert audit is not None and audit.metadata_json["error_code"] == error_code
    assert requests == 1
