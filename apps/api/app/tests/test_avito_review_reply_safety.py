from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.avito_reviews import AvitoReviewAdapter
from app.adapters.base import ProviderMessageContext
from app.adapters.capabilities import MarketplaceStream
from app.core.security import CredentialService
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType, ReplyStatus, ResponseMode
from app.models.reply import Reply
from app.services.reply_execution_service import ReplyExecutionService
from app.tests.marketplace_fixtures import SequenceTransport, response

_CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'
_CONTEXT = ProviderMessageContext(
    message_type=MessageType.REVIEW,
    external_id="92312343",
    marketplace_created_at=datetime(2026, 9, 14, tzinfo=UTC),
)


def _token() -> httpx.Response:
    return response(200, json={"access_token": "synthetic-access-token", "token_type": "Bearer", "expires_in": 3600})


def _review(**changes: object) -> dict[str, object]:
    record: dict[str, object] = {
        "id": 92312343,
        "score": 5,
        "stage": "done",
        "text": "Synthetic customer text",
        "usedInScore": True,
        "canAnswer": True,
        "createdAt": 1_757_855_200,
    }
    record.update(changes)
    return record


@pytest.mark.asyncio
async def test_review_answer_uses_one_fixed_origin_post_and_unverified_receipt() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(200, json={"reviews": [_review()], "total": 1}),
            response(200, json={"id": 1234567, "createdAt": 1_757_855_210}),
        ]
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", _CONTEXT, "Synthetic reply")

    assert result.ok and result.data is not None
    assert result.data.provider_reply_id == "1234567"
    assert result.data.provider_state == "accepted_unverified"
    posts = [request for request in transport.requests if request.url.path == "/ratings/v1/answers"]
    assert len(posts) == 1
    assert posts[0].read() == b'{"reviewId":92312343,"message":"Synthetic reply"}'
    assert all(request.url.host == "api.avito.ru" for request in transport.requests)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("review", "expected_state"),
    [
        (_review(answer={"id": 7, "text": "Answer", "status": "published", "createdAt": 1_757_855_210}), "published"),
        (_review(answer={"id": 7, "text": "Answer", "status": "moderation", "createdAt": 1_757_855_210}), "moderation"),
        (_review(answer={"id": 7, "text": "Answer", "status": "rejected", "createdAt": 1_757_855_210}), "rejected"),
    ],
)
async def test_existing_review_answer_is_reported_without_post(review: dict[str, object], expected_state: str) -> None:
    transport = SequenceTransport([_token(), response(200, json={"reviews": [review], "total": 1})])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).find_existing_reply(_CREDENTIAL, "123", _CONTEXT)

    assert result.ok and result.data is not None
    assert result.data.exists is True
    assert result.data.provider_state == expected_state
    assert all(request.url.path != "/ratings/v1/answers" for request in transport.requests)


@pytest.mark.asyncio
@pytest.mark.parametrize("reviews", [[_review(canAnswer=False)], []])
async def test_unanswerable_or_missing_review_does_not_send(reviews: list[dict[str, object]]) -> None:
    transport = SequenceTransport([_token(), response(200, json={"reviews": reviews, "total": len(reviews)})])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", _CONTEXT, "Synthetic reply")

    assert result.ok is False
    assert all(request.url.path != "/ratings/v1/answers" for request in transport.requests)


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["", " padded ", "x" * 3001, "nul\x00text"])
async def test_invalid_reply_text_is_rejected_before_authentication(text: str) -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", _CONTEXT, text)

    assert result.ok is False
    assert transport.requests == []


@pytest.mark.asyncio
async def test_oversized_review_id_is_rejected_before_integer_conversion_or_authentication() -> None:
    transport = SequenceTransport([])
    context = ProviderMessageContext(
        message_type=MessageType.REVIEW,
        external_id="9" * 5_000,
        marketplace_created_at=_CONTEXT.marketplace_created_at,
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", context, "Synthetic reply")

    assert result.ok is False
    assert transport.requests == []


@pytest.mark.asyncio
async def test_questions_are_explicitly_unsupported_without_provider_io() -> None:
    transport = SequenceTransport([])
    context = ProviderMessageContext(
        message_type=MessageType.QUESTION,
        external_id=_CONTEXT.external_id,
        marketplace_created_at=_CONTEXT.marketplace_created_at,
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        adapter = AvitoReviewAdapter(client)
        page = await adapter.fetch_page(_CREDENTIAL, "123", MarketplaceStream.QUESTIONS, None)
        preflight = await adapter.find_existing_reply(_CREDENTIAL, "123", context)
        sent = await adapter.send_reply(_CREDENTIAL, "123", context, "Synthetic reply")

    assert [result.error_code for result in (page, preflight, sent)] == ["unsupported_capability"] * 3
    assert transport.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("write_response", [response(401), response(403), response(429), response(500), response(200, json={})])
async def test_failed_or_malformed_answer_post_is_one_shot_and_redacted(write_response: httpx.Response) -> None:
    transport = SequenceTransport([_token(), response(200, json={"reviews": [_review()], "total": 1}), write_response])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", _CONTEXT, "Synthetic reply")

    assert result.ok is False
    assert len([request for request in transport.requests if request.url.path == "/ratings/v1/answers"]) == 1
    assert "synthetic-secret" not in repr(result)
    assert "synthetic-access-token" not in repr(result)
    assert "Synthetic customer text" not in repr(result)


@pytest.mark.asyncio
async def test_timed_out_post_is_not_retried() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(200, json={"reviews": [_review()], "total": 1}),
            httpx.ReadTimeout("synthetic timeout"),
        ]
    )
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoReviewAdapter(client).send_reply(_CREDENTIAL, "123", _CONTEXT, "Synthetic reply")

    assert result.error_code == "network_timeout"
    assert len([request for request in transport.requests if request.url.path == "/ratings/v1/answers"]) == 1


class _Session:
    def __init__(self) -> None:
        self.commit_count = 0

    def add(self, value: object) -> None:
        assert value is not None

    async def commit(self) -> None:
        self.commit_count += 1


class _ReplyService(ReplyExecutionService):
    async def mark_sent(
        self,
        *,
        reply: Reply,
        message: CustomerMessage,
        externally_already_answered: bool,
        provider_state: str,
    ) -> None:
        await self._mark_sent(
            reply=reply,
            message=message,
            marketplace_reply_id="1234567",
            externally_already_answered=externally_already_answered,
            provider_state=provider_state,
        )


@pytest.mark.asyncio
async def test_accepted_answer_marks_publication_unverified_but_published_preflight_does_not() -> None:
    session = _Session()
    service = _ReplyService(cast(AsyncSession, session), credentials=cast(CredentialService, object()))
    message = CustomerMessage(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        external_id="92312343",
        type=MessageType.REVIEW.value,
        status=MessageStatus.SENDING.value,
        customer_text="Synthetic customer text",
        marketplace_created_at=_CONTEXT.marketplace_created_at,
        metadata_json={},
    )
    reply = Reply(
        id=uuid4(),
        organization_id=message.organization_id,
        message_id=message.id,
        reply_text="Synthetic reply",
        status=ReplyStatus.SENDING.value,
        mode=ResponseMode.SEMI_AUTO.value,
        attempt_count=1,
        metadata_json={},
    )
    with (
        patch.object(service, "_write_integration_event", new_callable=AsyncMock),
        patch.object(service.audit, "write", new_callable=AsyncMock),
    ):
        await service.mark_sent(
            reply=reply,
            message=message,
            externally_already_answered=False,
            provider_state="accepted_unverified",
        )

    assert message.metadata_json["provider_publication"] == "unverified"
    assert reply.status == ReplyStatus.SENT.value

    message.status = MessageStatus.SENDING.value
    reply.status = ReplyStatus.SENDING.value
    with (
        patch.object(service, "_write_integration_event", new_callable=AsyncMock),
        patch.object(service.audit, "write", new_callable=AsyncMock),
    ):
        await service.mark_sent(
            reply=reply,
            message=message,
            externally_already_answered=True,
            provider_state="published",
        )

    assert "provider_publication" not in message.metadata_json
