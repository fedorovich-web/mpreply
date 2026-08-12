from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, cast
from urllib.parse import quote

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.adapters.conversation import AvitoChat, AvitoMessage

_BASE_URL = "https://api.avito.ru"
_MAX_RATE_LIMIT_VALUE = 1_000_000
_PAGE_LIMIT = 100
_MAX_OFFSET = 1000


class AvitoAdapter(MarketplaceAdapter):
    marketplace = "avito"

    def __init__(
        self,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._timeout = httpx.Timeout(timeout_seconds)
        self._transport = transport

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        user_id = _positive_decimal_id(seller_id)
        if user_id is None:
            return _invalid_account_identifier()
        result = await self._request(
            credential=credential,
            method="GET",
            path=f"/messenger/v2/accounts/{user_id}/chats",
            params={"limit": 1, "offset": 0, "unread_only": "false", "chat_types": "u2i,u2u,a2u"},
        )
        if not result.ok:
            return result
        if _chat_mappings(result.data) is None:
            return _malformed_payload()
        return AdapterResult(ok=True, data={"scopes": ["fetch_chats"]})

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        del credential, cursor, seller_id
        return _unsupported_operation()

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        del credential, cursor, seller_id
        return _unsupported_operation()

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        del payload
        return []

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        del payload
        return []

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        del raw
        return {}

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        del raw
        return {}

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        del credential, external_id, reply_text, seller_id, context
        return _unsupported_operation()

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        del credential, external_id, reply_text, seller_id, context
        return _unsupported_operation()

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        del credential, message_type, external_id, seller_id, context
        return _unsupported_operation()

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        del payload
        if status_code == 400:
            return _error("marketplace_validation_error", "Avito Messenger request is invalid")
        if status_code == 401:
            return _error("invalid_credentials", "Avito Messenger credentials are invalid")
        if status_code == 402:
            return _error("payment_required", "Avito Messenger account requires payment")
        if status_code == 403:
            return _error("insufficient_scope", "Avito Messenger credentials have insufficient permissions")
        if status_code == 404:
            return _error("marketplace_not_found", "Avito Messenger resource was not found")
        if status_code == 429:
            return _error("rate_limited", "Avito Messenger rate limit exceeded")
        if 500 <= status_code <= 599:
            return _error("marketplace_unavailable", "Avito Messenger is temporarily unavailable")
        return _error("marketplace_error", "Avito Messenger rejected the request")

    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult:
        normalized_user_id = _positive_decimal_id(user_id)
        if normalized_user_id is None:
            return _invalid_account_identifier()
        if not _valid_page(limit, offset):
            return _invalid_pagination()
        result = await self._request(
            credential=credential,
            method="GET",
            path=f"/messenger/v2/accounts/{normalized_user_id}/chats",
            params={
                "limit": limit,
                "offset": offset,
                "unread_only": "true" if unread_only else "false",
                "chat_types": "u2i,u2u,a2u",
            },
        )
        if not result.ok:
            return result
        chats = _chat_mappings(result.data)
        if chats is None:
            return _malformed_payload()
        parsed = [_parse_chat(chat, normalized_user_id) for chat in chats]
        if any(chat is None for chat in parsed):
            return _malformed_payload()
        return AdapterResult(ok=True, data=cast(list[AvitoChat], parsed))

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult:
        normalized_user_id = _positive_decimal_id(user_id)
        if normalized_user_id is None:
            return _invalid_account_identifier()
        if _required_string(chat_id) is None:
            return _invalid_chat_identifier()
        if not _valid_page(limit, offset):
            return _invalid_pagination()
        path_chat_id = _path_segment(chat_id)
        result = await self._request(
            credential=credential,
            method="GET",
            path=f"/messenger/v3/accounts/{normalized_user_id}/chats/{path_chat_id}/messages/",
            params={"limit": limit, "offset": offset},
        )
        if not result.ok:
            return result
        messages = _message_mappings(result.data)
        if messages is None:
            return _malformed_payload()
        parsed = [_parse_message(message) for message in messages]
        if any(message is None for message in parsed):
            return _malformed_payload()
        return AdapterResult(ok=True, data=cast(list[AvitoMessage], parsed))

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult:
        normalized_user_id = _positive_decimal_id(user_id)
        if normalized_user_id is None:
            return _invalid_account_identifier()
        if _required_string(chat_id) is None:
            return _invalid_chat_identifier()
        path_chat_id = _path_segment(chat_id)
        result = await self._request(
            credential=credential,
            method="POST",
            path=f"/messenger/v1/accounts/{normalized_user_id}/chats/{path_chat_id}/read",
        )
        if not result.ok:
            return result
        payload = _mapping(result.data)
        if payload is None or payload.get("ok") is not True:
            return _malformed_payload()
        return AdapterResult(ok=True, data={"ok": payload["ok"]})

    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult:
        if _required_string(chat_id) is None or type(inbound_created_unix) is not int:
            return _invalid_chat_context()
        for offset in range(0, _MAX_OFFSET + 1, _PAGE_LIMIT):
            result = await self.fetch_chat_messages(
                credential, user_id, chat_id, limit=_PAGE_LIMIT, offset=offset
            )
            if not result.ok:
                return result
            messages = cast(list[AvitoMessage], result.data)
            if any(message.direction == "out" and message.created_unix >= inbound_created_unix for message in messages):
                return AdapterResult(ok=True, data={"answered": True})
            if len(messages) < _PAGE_LIMIT:
                return AdapterResult(ok=True, data={"answered": False})
        return _error("preflight_page_limit_exceeded", "Avito Messenger preflight exceeded the safe page limit")

    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult:
        normalized_user_id = _positive_decimal_id(user_id)
        if normalized_user_id is None:
            return _invalid_account_identifier()
        if _required_string(chat_id) is None:
            return _invalid_chat_identifier()
        if not 1 <= len(text) <= 1000:
            return _error("invalid_reply_text", "Avito Messenger text must be between 1 and 1000 characters")
        path_chat_id = _path_segment(chat_id)
        result = await self._request(
            credential=credential,
            method="POST",
            path=f"/messenger/v1/accounts/{normalized_user_id}/chats/{path_chat_id}/messages",
            json={"message": {"text": text}, "type": "text"},
        )
        if not result.ok:
            return result
        payload = _mapping(result.data)
        content = _mapping(payload.get("content")) if payload is not None else None
        if (
            payload is None
            or _required_string(payload.get("id")) is None
            or payload.get("direction") != "out"
            or payload.get("type") != "text"
            or content is None
            or content.get("text") != text
        ):
            return _malformed_payload()
        return AdapterResult(ok=True, data={"marketplace_reply_id": payload["id"]})

    async def _request(
        self,
        *,
        credential: str,
        method: Literal["GET", "POST"],
        path: str,
        params: dict[str, int | str] | None = None,
        json: dict[str, object] | None = None,
    ) -> AdapterResult:
        try:
            async with httpx.AsyncClient(
                base_url=_BASE_URL,
                timeout=self._timeout,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.request(
                    method,
                    path,
                    headers={"Authorization": f"Bearer {_access_token(credential)}", "Accept": "application/json"},
                    params=params,
                    json=json,
                )
        except httpx.TimeoutException:
            return _error("network_timeout", "Avito Messenger request timed out")
        except httpx.RequestError:
            return _error("network_error", "Avito Messenger network error")
        if not response.is_success:
            result = self.map_error(response.status_code)
            rate_limit_data = _rate_limit_data(response.headers)
            if rate_limit_data is None:
                return result
            return AdapterResult(
                ok=False,
                data=rate_limit_data,
                error_code=result.error_code,
                error_message_safe=result.error_message_safe,
            )
        try:
            payload: object = response.json()
        except ValueError:
            return _malformed_payload()
        return AdapterResult(ok=True, data=payload)


def _mapping(value: object) -> Mapping[str, object] | None:
    return cast(Mapping[str, object], value) if isinstance(value, Mapping) else None


def _chat_mappings(value: object) -> list[Mapping[str, object]] | None:
    payload = _mapping(value)
    if payload is None or not isinstance(payload.get("chats"), list):
        return None
    chats = cast(list[object], payload["chats"])
    parsed = [_mapping(chat) for chat in chats]
    return cast(list[Mapping[str, object]], parsed) if all(chat is not None for chat in parsed) else None


def _message_mappings(value: object) -> list[Mapping[str, object]] | None:
    if not isinstance(value, list):
        return None
    messages = cast(list[object], value)
    parsed = [_mapping(message) for message in messages]
    return cast(list[Mapping[str, object]], parsed) if all(message is not None for message in parsed) else None


def _parse_chat(raw: Mapping[str, object], user_id: str) -> AvitoChat | None:
    chat_id = _required_string(raw.get("id"))
    created = raw.get("created")
    updated = raw.get("updated")
    if chat_id is None or type(created) is not int or type(updated) is not int:
        return None
    context = _mapping(raw.get("context"))
    chat_type = context.get("type") if context is not None and isinstance(context.get("type"), str) else None
    value = _mapping(context.get("value")) if context is not None and chat_type == "item" else None
    item_id = value.get("id") if value is not None and type(value.get("id")) is int else None
    item_title = value.get("title") if value is not None and isinstance(value.get("title"), str) else None
    item_url = value.get("url") if value is not None and isinstance(value.get("url"), str) else None
    customer_id: int | None = None
    customer_name: str | None = None
    users = raw.get("users")
    if isinstance(users, list):
        account_user_id = int(user_id)
        for user in cast(list[object], users):
            candidate = _mapping(user)
            if candidate is None or type(candidate.get("id")) is not int or candidate["id"] == account_user_id:
                continue
            customer_id = cast(int, candidate["id"])
            name = candidate.get("name")
            customer_name = name if isinstance(name, str) else None
            break
    return AvitoChat(
        id=chat_id,
        created_unix=created,
        updated_unix=updated,
        chat_type=cast(str | None, chat_type),
        item_id=cast(int | None, item_id),
        item_title=cast(str | None, item_title),
        item_url=cast(str | None, item_url),
        customer_id=customer_id,
        customer_name=customer_name,
    )


def _parse_message(raw: Mapping[str, object]) -> AvitoMessage | None:
    message_id = _required_string(raw.get("id"))
    author_id = raw.get("author_id")
    created = raw.get("created")
    direction = raw.get("direction")
    is_read = raw.get("is_read")
    kind = raw.get("type")
    read = raw.get("read")
    if (
        message_id is None
        or type(author_id) is not int
        or type(created) is not int
        or direction not in {"in", "out"}
        or type(is_read) is not bool
        or (read is not None and type(read) is not int)
        or not isinstance(kind, str)
    ):
        return None
    content = _mapping(raw.get("content"))
    text = content.get("text") if kind == "text" and content is not None and isinstance(content.get("text"), str) else None
    return AvitoMessage(
        id=message_id,
        author_id=author_id,
        created_unix=created,
        direction=cast(Literal["in", "out"], direction),
        is_read=is_read,
        read_unix=read,
        kind=kind,
        text=cast(str | None, text),
    )


def _access_token(value: str) -> str:
    normalized = value.strip()
    if normalized.lower().startswith("bearer "):
        return normalized[7:].strip()
    return normalized


def _positive_decimal_id(value: str | None) -> str | None:
    normalized = value.strip() if value else ""
    if not normalized or not normalized.isascii() or not normalized.isdecimal() or int(normalized) <= 0:
        return None
    return normalized


def _required_string(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _path_segment(value: str) -> str:
    return quote(value, safe="").replace(".", "%2E")


def _valid_page(limit: int, offset: int) -> bool:
    return type(limit) is int and type(offset) is int and 1 <= limit <= _PAGE_LIMIT and 0 <= offset <= _MAX_OFFSET


def _rate_limit_data(headers: httpx.Headers) -> dict[str, int] | None:
    values = {
        "rate_limit_limit": _bounded_non_negative_int(headers.get("X-RateLimit-Limit")),
        "rate_limit_remaining": _bounded_non_negative_int(headers.get("X-RateLimit-Remaining")),
    }
    return {key: value for key, value in values.items() if value is not None} or None


def _bounded_non_negative_int(value: str | None) -> int | None:
    if value is None or not value.isdecimal():
        return None
    parsed = int(value)
    return parsed if parsed <= _MAX_RATE_LIMIT_VALUE else None


def _error(code: str, message: str) -> AdapterResult:
    return AdapterResult(ok=False, error_code=code, error_message_safe=message)


def _invalid_account_identifier() -> AdapterResult:
    return _error("invalid_account_identifier", "Avito user ID must be a positive decimal integer")


def _invalid_chat_identifier() -> AdapterResult:
    return _error("invalid_chat_identifier", "Avito chat ID is required")


def _invalid_chat_context() -> AdapterResult:
    return _error("invalid_chat_context", "Avito chat reply context is invalid")


def _invalid_pagination() -> AdapterResult:
    return _error("invalid_pagination", "Avito pagination is outside the documented bounds")


def _malformed_payload() -> AdapterResult:
    return _error("malformed_payload", "Avito Messenger response is malformed")


def _unsupported_operation() -> AdapterResult:
    return _error("unsupported_operation", "Avito review and question operations are not supported")
