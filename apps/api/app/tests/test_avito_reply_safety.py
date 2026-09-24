from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.avito import AvitoAdapter
from app.adapters.avito_auth import AvitoCredentialResolver
from app.adapters.avito_http import AvitoApiClient
from app.adapters.base import ProviderMessageContext
from app.adapters.http import ReadRetryPolicy
from app.models.enums import MessageType
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api.avito.ru"
CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'
NO_RETRY = ReadRetryPolicy(max_attempts=1)
INBOUND_AT = datetime(2026, 9, 14, 12, tzinfo=UTC)


def _token() -> httpx.Response:
    return response(
        200,
        json={
            "access_token": "synthetic-access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
        },
    )


def _context() -> ProviderMessageContext:
    return ProviderMessageContext(
        message_type=MessageType.CHAT,
        external_id="inbound-123",
        marketplace_created_at=INBOUND_AT,
        metadata={"chat_id": "chat-123"},
    )


@pytest.mark.asyncio
async def test_avito_write_rejects_absolute_path_before_authentication() -> None:
    transport = SequenceTransport([_token(), response(200, json={})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoApiClient(client, AvitoCredentialResolver(client), NO_RETRY).write(
            CREDENTIAL,
            "https://attacker.invalid/collect",
            body={"message": "secret"},
        )

    assert result.ok is False
    assert transport.requests == []


@pytest.mark.asyncio
async def test_avito_preflight_detects_newer_outbound_message() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(
                200,
                json=[
                    {
                        "id": "outbound-123",
                        "author_id": 123456,
                        "created": int(INBOUND_AT.timestamp()) + 1,
                        "direction": "out",
                        "is_read": True,
                        "type": "text",
                        "content": {"text": "Already answered"},
                    }
                ],
            ),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(
            client,
            read_retry_policy=NO_RETRY,
        ).find_existing_chat_reply(CREDENTIAL, "123456", _context())

    assert result.ok is True and result.data is not None
    assert result.data.exists is True
    assert result.data.provider_reply_id == "outbound-123"


@pytest.mark.asyncio
async def test_avito_malformed_send_success_is_ambiguous() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(
                200,
                json={
                    "id": "outbound-123",
                    "direction": "in",
                    "type": "text",
                    "content": {"text": "Synthetic reply"},
                },
            ),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).send_chat_message(
            CREDENTIAL,
            "123456",
            _context(),
            "Synthetic reply",
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_avito_write_does_not_retry_or_refresh_after_unauthorized() -> None:
    transport = SequenceTransport([_token(), response(401)])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).send_chat_message(
            CREDENTIAL,
            "123456",
            _context(),
            "Synthetic reply",
        )

    assert result.ok is False
    assert result.error_code == "invalid_credentials"
    assert len(transport.requests) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["", " padded ", "x" * 1001, "contains\x00nul"])
async def test_avito_rejects_unsafe_reply_text_before_authentication(text: str) -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).send_chat_message(
            CREDENTIAL,
            "123456",
            _context(),
            text,
        )

    assert result.ok is False
    assert result.error_code == "marketplace_validation_error"
    assert transport.requests == []
