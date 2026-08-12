from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest

from app.adapters.avito import AvitoAdapter
from app.adapters.conversation import AvitoChat, AvitoMessage, ConversationAdapter


class _RequestRecorder:
    def __init__(self, responses: list[httpx.Response] | Callable[[httpx.Request], httpx.Response]) -> None:
        self.requests: list[httpx.Request] = []
        self._responses = responses

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if callable(self._responses):
            return self._responses(request)
        return self._responses.pop(0)


@pytest.mark.asyncio
async def test_validate_credentials_uses_documented_read_only_chat_request() -> None:
    def _response(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/messenger/v2/accounts/123456/chats"
        assert request.headers["Authorization"] == "Bearer synthetic-access-token"
        assert request.url.params["limit"] == "1"
        assert request.url.params["offset"] == "0"
        assert request.url.params["unread_only"] == "false"
        assert request.url.params["chat_types"] == "u2i,u2u,a2u"
        return httpx.Response(200, json={"chats": []})

    recorder = _RequestRecorder(_response)
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")

    assert result.ok is True
    assert result.data == {"scopes": ["fetch_chats"]}
    assert isinstance(adapter, ConversationAdapter)
    assert len(recorder.requests) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("seller_id", [None, "", "   ", "0", "-1", "123.0", "user-123"])
async def test_avito_rejects_invalid_user_ids_without_network_calls(seller_id: str | None) -> None:
    recorder = _RequestRecorder([])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-access-token", seller_id=seller_id)

    assert result.ok is False
    assert result.error_code == "invalid_account_identifier"
    assert recorder.requests == []


@pytest.mark.asyncio
async def test_avito_normalizes_bearer_prefix_without_double_prefixing() -> None:
    recorder = _RequestRecorder([httpx.Response(200, json={"chats": []}), httpx.Response(200, json={"chats": []})])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    await adapter.validate_credentials("Bearer synthetic-access-token", seller_id="123456")
    await adapter.validate_credentials(" bearer synthetic-access-token ", seller_id="123456")

    assert [request.headers["Authorization"] for request in recorder.requests] == [
        "Bearer synthetic-access-token",
        "Bearer synthetic-access-token",
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [[], {}, {"chats": "not-a-list"}, {"chats": ["not-a-mapping"]}],
)
async def test_avito_validation_rejects_malformed_success_payloads(payload: object) -> None:
    recorder = _RequestRecorder([httpx.Response(200, json=payload)])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_avito_fetches_and_strictly_parses_chats_and_messages() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(
                200,
                json={
                    "chats": [
                        {
                            "id": "chat-123",
                            "created": 1723456789,
                            "updated": 1723456790,
                            "context": {
                                "type": "item",
                                "value": {
                                    "id": 998877,
                                    "title": "Synthetic item",
                                    "url": "https://www.avito.ru/synthetic",
                                },
                            },
                            "users": [{"id": 42, "name": "Synthetic buyer"}],
                        }
                    ]
                },
            ),
            httpx.Response(
                200,
                json=[
                    {
                        "id": "message-123",
                        "author_id": 42,
                        "created": 1723456791,
                        "direction": "in",
                        "is_read": False,
                        "read": None,
                        "type": "text",
                        "content": {"text": "Synthetic text"},
                    }
                ],
            ),
        ]
    )
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    chats = await adapter.fetch_chats(
        "synthetic-access-token", "123456", unread_only=True, limit=100, offset=0
    )
    messages = await adapter.fetch_chat_messages(
        "synthetic-access-token", "123456", "chat-123", limit=100, offset=0
    )

    assert chats.data == [
        AvitoChat(
            id="chat-123",
            created_unix=1723456789,
            updated_unix=1723456790,
            chat_type="item",
            item_id=998877,
            item_title="Synthetic item",
            item_url="https://www.avito.ru/synthetic",
            customer_id=42,
            customer_name="Synthetic buyer",
        )
    ]
    assert messages.data == [
        AvitoMessage(
            id="message-123",
            author_id=42,
            created_unix=1723456791,
            direction="in",
            is_read=False,
            read_unix=None,
            kind="text",
            text="Synthetic text",
        )
    ]
    assert [request.url.path for request in recorder.requests] == [
        "/messenger/v2/accounts/123456/chats",
        "/messenger/v3/accounts/123456/chats/chat-123/messages/",
    ]
    assert dict(recorder.requests[0].url.params) == {
        "chat_types": "u2i,u2u,a2u",
        "unread_only": "true",
        "limit": "100",
        "offset": "0",
    }
    assert dict(recorder.requests[1].url.params) == {"limit": "100", "offset": "0"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        [{"id": "m", "author_id": True, "created": 1, "direction": "in", "is_read": False, "read": None, "type": "text", "content": {"text": "x"}}],
        [{"id": "m", "author_id": 1, "created": 1.0, "direction": "in", "is_read": False, "read": None, "type": "text", "content": {"text": "x"}}],
        [{"id": "m", "author_id": 1, "created": 1, "direction": "incoming", "is_read": False, "read": None, "type": "text", "content": {"text": "x"}}],
        [{"id": "m", "author_id": 1, "created": 1, "direction": "in", "is_read": 0, "read": None, "type": "text", "content": {"text": "x"}}],
        [{"id": "m", "author_id": 1, "created": 1, "direction": "in", "is_read": False, "read": 1.0, "type": "text", "content": {"text": "x"}}],
        [{"id": "m", "author_id": 1, "created": 1, "direction": "in", "is_read": False, "read": None, "type": "unknown", "content": {}}],
    ],
)
async def test_avito_rejects_non_exact_message_fields_and_unknown_types(payload: object) -> None:
    recorder = _RequestRecorder([httpx.Response(200, json=payload)])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_chat_messages(
        "synthetic-access-token", "123456", "chat-123", limit=100, offset=0
    )

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
async def test_avito_preserves_documented_unsupported_message_type_for_sync_policy() -> None:
    payload: list[dict[str, object]] = [
        {
            "id": "message-image",
            "author_id": 42,
            "created": 1723456791,
            "direction": "in",
            "is_read": False,
            "read": None,
            "type": "image",
            "content": dict[str, object](),
        }
    ]
    adapter = AvitoAdapter(transport=httpx.MockTransport(_RequestRecorder([httpx.Response(200, json=payload)])))

    result = await adapter.fetch_chat_messages(
        "synthetic-access-token", "123456", "chat-123", limit=100, offset=0
    )

    assert result.ok is True
    assert result.data == [
        AvitoMessage(
            id="message-image",
            author_id=42,
            created_unix=1723456791,
            direction="in",
            is_read=False,
            read_unix=None,
            kind="image",
            text=None,
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status_code", "expected_error"),
    [
        (400, "marketplace_validation_error"),
        (401, "invalid_credentials"),
        (402, "payment_required"),
        (403, "insufficient_scope"),
        (404, "marketplace_not_found"),
        (429, "rate_limited"),
        (500, "marketplace_unavailable"),
        (503, "marketplace_unavailable"),
        (502, "marketplace_unavailable"),
        (418, "marketplace_error"),
    ],
)
async def test_avito_maps_http_errors_without_returning_provider_bodies(
    status_code: int, expected_error: str
) -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(
                status_code,
                content=b"provider secret body",
                headers={"X-RateLimit-Limit": "250", "X-RateLimit-Remaining": "249"},
            )
        ]
    )
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")

    assert result.ok is False
    assert result.error_code == expected_error
    assert result.error_message_safe is not None
    assert "provider secret body" not in result.error_message_safe


@pytest.mark.asyncio
async def test_avito_accepts_only_bounded_non_negative_rate_limit_headers() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(
                429,
                headers={"X-RateLimit-Limit": "250", "X-RateLimit-Remaining": "249"},
            ),
            httpx.Response(
                429,
                headers={"X-RateLimit-Limit": "-1", "X-RateLimit-Remaining": "not-an-int"},
            ),
        ]
    )
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    bounded = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")
    invalid = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")

    assert bounded.data == {"rate_limit_limit": 250, "rate_limit_remaining": 249}
    assert invalid.data is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "exception, expected_error",
    [
        (httpx.ReadTimeout("synthetic timeout"), "network_timeout"),
        (httpx.ConnectError("synthetic transport error"), "network_error"),
    ],
)
async def test_avito_normalizes_transport_failures(exception: httpx.HTTPError, expected_error: str) -> None:
    async def _raise(_: httpx.Request) -> httpx.Response:
        raise exception

    adapter = AvitoAdapter(transport=httpx.MockTransport(_raise))

    result = await adapter.validate_credentials("synthetic-access-token", seller_id="123456")

    assert result.ok is False
    assert result.error_code == expected_error


@pytest.mark.asyncio
async def test_avito_mark_read_and_send_text_use_documented_contracts() -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json={"ok": True}),
            httpx.Response(
                200,
                json={
                    "id": "outbound-123",
                    "created": 1723456792,
                    "direction": "out",
                    "type": "text",
                    "content": {"text": "Synthetic reply"},
                },
            ),
        ]
    )
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    marked = await adapter.mark_chat_read("synthetic-access-token", "123456", "chat-123")
    sent = await adapter.send_chat_message(
        "synthetic-access-token", "123456", chat_id="chat-123", text="Synthetic reply"
    )

    assert marked.ok is True
    assert sent.data == {"marketplace_reply_id": "outbound-123"}
    assert [request.url.path for request in recorder.requests] == [
        "/messenger/v1/accounts/123456/chats/chat-123/read",
        "/messenger/v1/accounts/123456/chats/chat-123/messages",
    ]
    assert json.loads(recorder.requests[1].content) == {
        "message": {"text": "Synthetic reply"},
        "type": "text",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"ok": False}, {}, {"ok": "true"}, {"ok": True, "extra": 1}])
async def test_avito_mark_read_requires_explicit_success(payload: object) -> None:
    recorder = _RequestRecorder([httpx.Response(200, json=payload)])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.mark_chat_read("synthetic-access-token", "123456", "chat-123")

    assert result.ok is False
    assert result.error_code == "malformed_payload"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("chat_id", "encoded_chat_id"),
    [
        ("chat/id", "chat%2Fid"),
        ("..", "%2E%2E"),
        ("chat?query", "chat%3Fquery"),
        ("chat#fragment", "chat%23fragment"),
    ],
)
async def test_avito_encodes_reserved_chat_ids_as_single_path_segments(
    chat_id: str, encoded_chat_id: str
) -> None:
    recorder = _RequestRecorder(
        [
            httpx.Response(200, json=[]),
            httpx.Response(200, json={"ok": True}),
            httpx.Response(
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
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    await adapter.fetch_chat_messages(
        "synthetic-access-token", "123456", chat_id, limit=100, offset=0
    )
    await adapter.mark_chat_read("synthetic-access-token", "123456", chat_id)
    await adapter.send_chat_message(
        "synthetic-access-token", "123456", chat_id=chat_id, text="Synthetic reply"
    )

    assert [request.url.raw_path.split(b"?", 1)[0] for request in recorder.requests] == [
        f"/messenger/v3/accounts/123456/chats/{encoded_chat_id}/messages/".encode(),
        f"/messenger/v1/accounts/123456/chats/{encoded_chat_id}/read".encode(),
        f"/messenger/v1/accounts/123456/chats/{encoded_chat_id}/messages".encode(),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("text", ["", "x" * 1001])
async def test_avito_send_rejects_text_outside_documented_bounds_before_network(text: str) -> None:
    recorder = _RequestRecorder([])
    adapter = AvitoAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.send_chat_message(
        "synthetic-access-token", "123456", chat_id="chat-123", text=text
    )

    assert result.ok is False
    assert result.error_code == "invalid_reply_text"
    assert recorder.requests == []
