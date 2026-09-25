from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.avito import AvitoAdapter
from app.adapters.base import ProviderMessageContext
from app.adapters.http import ReadRetryPolicy
from app.models.enums import MessageType
from app.services.avito_chat_ingest_service import AvitoChatIngestService
from app.tests.marketplace_fixtures import SequenceTransport, response

BASE_URL = "https://api.avito.ru"
CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'
NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _token(value: str = "synthetic-access-token") -> httpx.Response:
    return response(
        200,
        json={"access_token": value, "token_type": "Bearer", "expires_in": 3600},
    )


def _chat() -> dict[str, object]:
    return {
        "id": "chat-123",
        "created": 1_723_456_789,
        "updated": 1_723_456_790,
        "context": {
            "type": "item",
            "value": {
                "id": 998877,
                "title": "Synthetic item",
                "url": "https://www.avito.ru/synthetic",
            },
        },
        "users": [
            {"id": 123456, "name": "Synthetic seller"},
            {"id": 42, "name": "Synthetic buyer"},
        ],
    }


def _message(
    *,
    message_id: str = "message-123",
    direction: str = "in",
    kind: str = "text",
    text: str = "Synthetic text",
    created: int = 1_723_456_791,
) -> dict[str, object]:
    return {
        "id": message_id,
        "author_id": 42,
        "created": created,
        "direction": direction,
        "is_read": False,
        "type": kind,
        "content": {"text": text},
    }


@pytest.mark.asyncio
async def test_avito_fetches_documented_chat_and_message_contracts() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(200, json={"chats": [_chat()]}),
            response(200, json=[_message()]),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = AvitoAdapter(client, read_retry_policy=NO_RETRY)
        chats = await adapter.fetch_chats(CREDENTIAL, "123456", None)
        messages = await adapter.fetch_chat_messages(
            CREDENTIAL,
            "123456",
            "chat-123",
            None,
        )

    assert chats.ok is True and chats.data is not None
    assert chats.data.items[0].product is not None
    assert chats.data.items[0].product.external_id == "998877"
    assert chats.data.items[0].product.name == "Synthetic item"
    assert messages.ok is True and messages.data is not None
    assert messages.data.items[0].text == "Synthetic text"
    assert dict(transport.requests[1].url.params) == {
        "limit": "100",
        "offset": "0",
        "unread_only": "true",
        "chat_types": "u2i,u2u",
    }
    assert transport.requests[2].url.path.endswith("/chat-123/messages/")


@pytest.mark.asyncio
async def test_avito_projects_inbound_author_even_when_chat_user_ids_are_hashed() -> None:
    chat = {
        **_chat(),
        "users": [
            {"id": 900001, "name": "Synthetic seller"},
            {"id": 42, "name": "Synthetic buyer"},
        ],
    }
    transport = SequenceTransport([_token(), response(200, json={"chats": [chat]}), response(200, json=[_message()])])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        adapter = AvitoAdapter(client, read_retry_policy=NO_RETRY)
        chats = await adapter.fetch_chats(CREDENTIAL, "123456", None)
        messages = await adapter.fetch_chat_messages(CREDENTIAL, "123456", "chat-123", None)

    assert chats.ok is True and chats.data is not None
    assert messages.ok is True and messages.data is not None
    projection = AvitoChatIngestService().project(chats.data.items[0], messages.data.items)
    assert len(projection.page.items) == 1
    assert projection.page.items[0].customer_text == "Synthetic text"
    assert projection.page.items[0].customer_display_name == "Synthetic buyer"
    assert projection.can_mark_read is True


@pytest.mark.asyncio
async def test_avito_chat_without_item_keeps_product_nullable() -> None:
    chat = {**_chat(), "context": {"type": "user"}}
    transport = SequenceTransport([_token(), response(200, json={"chats": [chat]})])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).fetch_chats(
            CREDENTIAL,
            "123456",
            None,
        )

    assert result.ok is True and result.data is not None
    assert result.data.items[0].product is None


@pytest.mark.parametrize("seller_id,cursor", [("9" * 5000, None), ("123456", "9" * 5000)], ids=["account", "cursor"])
@pytest.mark.asyncio
async def test_avito_rejects_oversized_account_and_cursor_before_token_request(seller_id: str, cursor: str | None) -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).fetch_chats(CREDENTIAL, seller_id, cursor)

    assert result.ok is False
    assert result.error_code == "marketplace_validation_error"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_avito_chat_id_is_encoded_as_one_path_segment() -> None:
    transport = SequenceTransport([_token(), response(200, json=[])])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        await AvitoAdapter(client, read_retry_policy=NO_RETRY).fetch_chat_messages(
            CREDENTIAL,
            "123456",
            "chat/../secret",
            None,
        )

    assert transport.requests[1].url.raw_path.split(b"?", 1)[0].endswith(b"/chats/chat%2F%2E%2E%2Fsecret/messages/")


@pytest.mark.asyncio
async def test_avito_unknown_message_kind_fails_closed() -> None:
    transport = SequenceTransport([_token(), response(200, json=[_message(kind="future-provider-kind")])])
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).fetch_chat_messages(
            CREDENTIAL,
            "123456",
            "chat-123",
            None,
        )

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_avito_read_refreshes_once_after_unauthorized() -> None:
    transport = SequenceTransport(
        [
            _token("stale-token"),
            response(401),
            _token("fresh-token"),
            response(200, json={"chats": []}),
        ]
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).fetch_chats(
            CREDENTIAL,
            "123456",
            None,
        )

    assert result.ok is True
    assert transport.requests[1].headers["Authorization"] == "Bearer stale-token"
    assert transport.requests[3].headers["Authorization"] == "Bearer fresh-token"


@pytest.mark.asyncio
async def test_avito_send_is_one_shot_and_requires_exact_outbound_proof() -> None:
    transport = SequenceTransport(
        [
            _token(),
            response(
                200,
                json={
                    "id": "outbound-123",
                    "direction": "out",
                    "type": "text",
                    "content": {"text": "Synthetic reply"},
                },
            ),
        ]
    )
    context = ProviderMessageContext(
        message_type=MessageType.CHAT,
        external_id="message-123",
        marketplace_created_at=datetime(2026, 9, 14, tzinfo=UTC),
        metadata={"chat_id": "chat-123"},
    )
    async with httpx.AsyncClient(base_url=BASE_URL, transport=transport.mock()) as client:
        result = await AvitoAdapter(client, read_retry_policy=NO_RETRY).send_chat_message(
            CREDENTIAL,
            "123456",
            context,
            "Synthetic reply",
        )

    assert result.ok is True and result.data is not None
    assert result.data.provider_reply_id == "outbound-123"
    assert len(transport.requests) == 2
    assert transport.requests[1].read() == (b'{"message":{"text":"Synthetic reply"},"type":"text"}')
    assert "synthetic-secret" not in repr(result)
