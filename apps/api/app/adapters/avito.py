from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from urllib.parse import quote, urlsplit

import httpx

from app.adapters.avito_auth import AvitoCredentialResolver, AvitoResolvedCredential
from app.adapters.base import (
    AdapterResult,
    CredentialValidation,
    ExistingReplyResult,
    MarketplacePage,
    NormalizedProduct,
    ProviderMessageContext,
    ProviderWriteReceipt,
)
from app.adapters.conversation import ConversationAdapter, ConversationMessage, ConversationThread
from app.adapters.http import ReadRetryPolicy, parse_retry_after, request_read_with_retry
from app.models.enums import Marketplace, MessageType

_PAGE_SIZE = 100
_MAX_OFFSET = 1_000
_MAX_PREFLIGHT_PAGES = 11
_MAX_CHAT_ID_LENGTH = 255
_MAX_REPLY_LENGTH = 1_000
_MAX_UNIX_SECONDS = 253_402_300_799
_MESSAGE_KINDS = frozenset({"text", "image", "link", "item", "location", "call", "deleted", "voice", "system"})
_CHAT_TYPES = "u2i,u2u,a2u"


class AvitoAdapter(ConversationAdapter):
    marketplace = Marketplace.AVITO

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        credential_resolver: AvitoCredentialResolver | None = None,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
    ) -> None:
        self._client = client
        self._resolver = credential_resolver or AvitoCredentialResolver(client)
        self._read_retry_policy = read_retry_policy

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None,
    ) -> AdapterResult[CredentialValidation]:
        user_id = self._user_id(seller_id)
        if user_id is None:
            return cast(
                AdapterResult[CredentialValidation],
                self._invalid("Avito account ID must be a positive decimal integer"),
            )
        response = await self._read(
            credential,
            f"/messenger/v2/accounts/{user_id}/chats",
            params={
                "limit": 1,
                "offset": 0,
                "unread_only": "false",
                "chat_types": _CHAT_TYPES,
            },
        )
        if not response.ok:
            return cast(AdapterResult[CredentialValidation], self._copy_failure(response))
        if self._chat_records(response.data) is None:
            return cast(
                AdapterResult[CredentialValidation],
                self._malformed("Avito returned an invalid chat list"),
            )
        return AdapterResult(
            ok=True,
            data=CredentialValidation(
                scopes=("chats:read", "chats:write"),
                account_reference=user_id,
            ),
        )

    async def fetch_chats(
        self,
        credential: str,
        seller_id: str,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[ConversationThread]]:
        user_id = self._user_id(seller_id)
        offset = self._offset(cursor)
        if user_id is None or offset is None:
            return cast(
                AdapterResult[MarketplacePage[ConversationThread]],
                self._invalid("Avito chat pagination or account ID is invalid"),
            )
        response = await self._read(
            credential,
            f"/messenger/v2/accounts/{user_id}/chats",
            params={
                "limit": _PAGE_SIZE,
                "offset": offset,
                "unread_only": "true",
                "chat_types": _CHAT_TYPES,
            },
        )
        if not response.ok:
            return cast(
                AdapterResult[MarketplacePage[ConversationThread]],
                self._copy_failure(response),
            )
        records = self._chat_records(response.data)
        if records is None or len(records) > _PAGE_SIZE:
            return cast(
                AdapterResult[MarketplacePage[ConversationThread]],
                self._malformed("Avito returned an invalid chat page"),
            )
        try:
            items = tuple(self._parse_chat(record, user_id) for record in records)
            next_cursor = self._next_offset(offset, len(records))
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[ConversationThread]],
                self._malformed("Avito returned an invalid chat record"),
            )
        return AdapterResult(ok=True, data=MarketplacePage(items=items, next_cursor=next_cursor))

    async def fetch_chat_messages(
        self,
        credential: str,
        seller_id: str,
        chat_id: str,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[ConversationMessage]]:
        user_id = self._user_id(seller_id)
        offset = self._offset(cursor)
        segment = self._chat_segment(chat_id)
        if user_id is None or offset is None or segment is None:
            return cast(
                AdapterResult[MarketplacePage[ConversationMessage]],
                self._invalid("Avito message pagination or chat context is invalid"),
            )
        response = await self._read(
            credential,
            f"/messenger/v3/accounts/{user_id}/chats/{segment}/messages/",
            params={"limit": _PAGE_SIZE, "offset": offset},
        )
        if not response.ok:
            return cast(
                AdapterResult[MarketplacePage[ConversationMessage]],
                self._copy_failure(response),
            )
        records = self._message_records(response.data)
        if records is None or len(records) > _PAGE_SIZE:
            return cast(
                AdapterResult[MarketplacePage[ConversationMessage]],
                self._malformed("Avito returned an invalid message page"),
            )
        try:
            items = tuple(self._parse_message(record) for record in records)
            next_cursor = self._next_offset(offset, len(records))
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[ConversationMessage]],
                self._malformed("Avito returned an invalid message record"),
            )
        return AdapterResult(ok=True, data=MarketplacePage(items=items, next_cursor=next_cursor))

    async def mark_chat_read(
        self,
        credential: str,
        seller_id: str,
        chat_id: str,
    ) -> AdapterResult[None]:
        user_id = self._user_id(seller_id)
        segment = self._chat_segment(chat_id)
        if user_id is None or segment is None:
            return cast(AdapterResult[None], self._invalid("Avito chat context is invalid"))
        response = await self._write(
            credential,
            f"/messenger/v1/accounts/{user_id}/chats/{segment}/read",
            body=None,
        )
        if not response.ok:
            return cast(AdapterResult[None], self._copy_failure(response))
        payload = self._object(response.data)
        if payload is None or payload.get("ok") is not True:
            return cast(
                AdapterResult[None],
                self._malformed("Avito read confirmation is invalid"),
            )
        return AdapterResult(ok=True)

    async def find_existing_chat_reply(
        self,
        credential: str,
        seller_id: str,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        if context.message_type is not MessageType.CHAT:
            return cast(
                AdapterResult[ExistingReplyResult],
                self._invalid("Avito reply context is not a chat"),
            )
        chat_id = self._metadata_chat_id(context.metadata)
        if chat_id is None:
            return cast(
                AdapterResult[ExistingReplyResult],
                self._invalid("Avito chat ID is missing from the reply context"),
            )
        cursor: str | None = None
        for _ in range(_MAX_PREFLIGHT_PAGES):
            page = await self.fetch_chat_messages(
                credential,
                seller_id,
                chat_id,
                cursor,
            )
            if not page.ok or page.data is None:
                return cast(AdapterResult[ExistingReplyResult], self._copy_failure(page))
            for message in page.data.items:
                try:
                    created_at = datetime.fromtimestamp(message.created_unix, tz=UTC)
                except (OverflowError, OSError, ValueError):
                    return cast(
                        AdapterResult[ExistingReplyResult],
                        self._malformed("Avito returned an invalid message timestamp"),
                    )
                if message.direction == "out" and created_at >= context.marketplace_created_at:
                    return AdapterResult(
                        ok=True,
                        data=ExistingReplyResult(
                            exists=True,
                            provider_reply_id=message.external_id,
                            provider_state="published",
                        ),
                    )
            if page.data.next_cursor is None:
                return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))
            cursor = page.data.next_cursor
        return cast(
            AdapterResult[ExistingReplyResult],
            self._malformed("Avito reply preflight exceeded the safe page limit"),
        )

    async def send_chat_message(
        self,
        credential: str,
        seller_id: str,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        user_id = self._user_id(seller_id)
        chat_id = self._metadata_chat_id(context.metadata)
        segment = self._chat_segment(chat_id) if chat_id is not None else None
        if (
            context.message_type is not MessageType.CHAT
            or user_id is None
            or segment is None
            or not text
            or text != text.strip()
            or len(text) > _MAX_REPLY_LENGTH
            or "\x00" in text
        ):
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._invalid("Avito chat reply input is invalid"),
            )
        response = await self._write(
            credential,
            f"/messenger/v1/accounts/{user_id}/chats/{segment}/messages",
            body={"message": {"text": text}, "type": "text"},
        )
        if not response.ok:
            return cast(AdapterResult[ProviderWriteReceipt], self._copy_failure(response))
        payload = self._object(response.data)
        content = self._object(payload.get("content") if payload is not None else None)
        reply_id = self._bounded_string(payload.get("id") if payload is not None else None, 255)
        if (
            reply_id is None
            or payload is None
            or payload.get("direction") != "out"
            or payload.get("type") != "text"
            or content is None
            or content.get("text") != text
        ):
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._malformed("Avito write success could not be proven"),
            )
        return AdapterResult(ok=True, data=ProviderWriteReceipt(provider_reply_id=reply_id))

    async def _read(
        self,
        raw_credential: str,
        path: str,
        *,
        params: dict[str, str | int],
    ) -> AdapterResult[object]:
        resolved = await self._resolver.resolve(raw_credential)
        if not resolved.ok or resolved.data is None:
            return self._copy_failure(resolved)
        try:
            response = await self._read_with_token(resolved.data, path, params)
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Avito read timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Avito network request failed",
            )
        if response.status_code == 401:
            await self._resolver.invalidate(raw_credential)
            refreshed = await self._resolver.resolve(raw_credential)
            if not refreshed.ok or refreshed.data is None:
                return self._copy_failure(refreshed)
            try:
                response = await self._read_with_token(refreshed.data, path, params)
            except httpx.TimeoutException:
                return AdapterResult(
                    False,
                    error_code="network_timeout",
                    error_message_safe="Avito read timed out",
                )
            except httpx.RequestError:
                return AdapterResult(
                    False,
                    error_code="network_error",
                    error_message_safe="Avito network request failed",
                )
        return self._response_result(response)

    async def _read_with_token(
        self,
        resolved: AvitoResolvedCredential,
        path: str,
        params: dict[str, str | int],
    ) -> httpx.Response:
        return await request_read_with_retry(
            self._client,
            "GET",
            path,
            headers=self._headers(resolved.access_token),
            params=params,
            policy=self._read_retry_policy,
        )

    async def _write(
        self,
        raw_credential: str,
        path: str,
        *,
        body: dict[str, object] | None,
    ) -> AdapterResult[object]:
        resolved = await self._resolver.resolve(raw_credential)
        if not resolved.ok or resolved.data is None:
            return self._copy_failure(resolved)
        try:
            response = await self._client.post(
                path,
                headers=self._headers(resolved.data.access_token),
                json=body,
            )
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Avito write timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Avito network request failed",
            )
        return self._response_result(response)

    def _response_result(self, response: httpx.Response) -> AdapterResult[object]:
        if not response.is_success:
            return self._map_error(response)
        try:
            payload: object = response.json()
        except ValueError:
            return self._malformed("Avito returned invalid JSON")
        return AdapterResult(ok=True, data=payload)

    def _map_error(self, response: httpx.Response) -> AdapterResult[object]:
        retry_after = (
            parse_retry_after(
                response.headers.get("Retry-After"),
                now=datetime.now(UTC),
                maximum_seconds=self._read_retry_policy.max_retry_after_seconds,
            )
            if response.status_code == 429
            else None
        )
        if response.status_code == 401:
            code = "invalid_credentials"
            message = "Avito credentials are invalid"
        elif response.status_code in {402, 403}:
            code = "insufficient_scope"
            message = "Avito account lacks Messenger access"
        elif response.status_code == 404:
            code = "marketplace_not_found"
            message = "Avito chat or account was not found"
        elif response.status_code == 429:
            code = "rate_limited"
            message = "Avito Messenger rate limit was exceeded"
        elif 500 <= response.status_code <= 599:
            code = "marketplace_unavailable"
            message = "Avito Messenger is temporarily unavailable"
        else:
            code = "marketplace_validation_error"
            message = "Avito Messenger rejected the request"
        return AdapterResult(
            False,
            error_code=code,
            error_message_safe=message,
            retry_after_seconds=retry_after,
        )

    @classmethod
    def _parse_chat(cls, raw: dict[str, object], user_id: str) -> ConversationThread:
        chat_id = cls._bounded_string(raw.get("id"), _MAX_CHAT_ID_LENGTH)
        created = cls._unix_seconds(raw.get("created"))
        updated = cls._unix_seconds(raw.get("updated"))
        context = cls._object(raw.get("context"))
        users = raw.get("users")
        if chat_id is None or created is None or updated is None or context is None or not isinstance(users, list):
            raise ValueError("Avito chat is invalid")
        chat_type = cls._bounded_string(context.get("type"), 32)
        product = cls._chat_product(context)
        customer_id: str | None = None
        customer_name: str | None = None
        for raw_user in cast(list[object], users):
            user = cls._object(raw_user)
            identifier = cls._positive_integer(user.get("id") if user is not None else None)
            if user is None or identifier is None:
                raise ValueError("Avito chat user is invalid")
            if str(identifier) != user_id and customer_id is None:
                customer_id = str(identifier)
                customer_name = cls._bounded_string(user.get("name"), 255)
        return ConversationThread(
            external_id=chat_id,
            created_unix=created,
            updated_unix=updated,
            customer_id=customer_id,
            customer_name=customer_name,
            product=product,
            metadata={"chat_type": chat_type},
        )

    @classmethod
    def _parse_message(cls, raw: dict[str, object]) -> ConversationMessage:
        message_id = cls._bounded_string(raw.get("id"), 255)
        author_id = cls._positive_integer(raw.get("author_id"))
        created = cls._unix_seconds(raw.get("created"))
        direction = raw.get("direction")
        is_read = raw.get("is_read")
        kind = raw.get("type")
        if (
            message_id is None
            or author_id is None
            or created is None
            or direction not in {"in", "out"}
            or type(is_read) is not bool
            or not isinstance(kind, str)
            or kind not in _MESSAGE_KINDS
        ):
            raise ValueError("Avito message is invalid")
        content = cls._object(raw.get("content"))
        text = (
            cls._bounded_string(
                content.get("text") if content is not None else None,
                100_000,
            )
            if kind == "text"
            else None
        )
        if kind == "text" and text is None:
            raise ValueError("Avito text message is invalid")
        return ConversationMessage(
            external_id=message_id,
            author_id=str(author_id),
            created_unix=created,
            direction=cast(str, direction),
            is_read=is_read,
            kind=kind,
            text=text,
        )

    @classmethod
    def _chat_product(cls, context: dict[str, object]) -> NormalizedProduct | None:
        if context.get("type") != "item":
            return None
        value = cls._object(context.get("value"))
        item_id = cls._positive_integer(value.get("id") if value is not None else None)
        if value is None or item_id is None:
            return None
        return NormalizedProduct(
            external_id=str(item_id),
            sku=None,
            name=cls._bounded_string(value.get("title"), 500),
            brand=None,
            category=None,
            image_url=None,
            product_url=cls._https_url(value.get("url")),
            metadata={"item_id": item_id},
        )

    @staticmethod
    def _chat_records(value: object | None) -> list[dict[str, object]] | None:
        payload = AvitoAdapter._object(value)
        chats = payload.get("chats") if payload is not None else None
        return AvitoAdapter._object_list(chats)

    @staticmethod
    def _message_records(value: object | None) -> list[dict[str, object]] | None:
        return AvitoAdapter._object_list(value)

    @staticmethod
    def _object_list(value: object | None) -> list[dict[str, object]] | None:
        if not isinstance(value, list):
            return None
        items = cast(list[object], value)
        if not all(isinstance(item, dict) for item in items):
            return None
        return [cast(dict[str, object], item) for item in items]

    @staticmethod
    def _next_offset(offset: int, count: int) -> str | None:
        if count < _PAGE_SIZE:
            return None
        next_offset = offset + _PAGE_SIZE
        if next_offset > _MAX_OFFSET:
            raise ValueError("Avito pagination exceeded the safe offset")
        return str(next_offset)

    @staticmethod
    def _offset(cursor: str | None) -> int | None:
        if cursor is None:
            return 0
        if not cursor.isascii() or not cursor.isdecimal():
            return None
        value = int(cursor)
        return value if 0 <= value <= _MAX_OFFSET and str(value) == cursor and value % _PAGE_SIZE == 0 else None

    @staticmethod
    def _chat_segment(chat_id: str | None) -> str | None:
        value = AvitoAdapter._bounded_string(chat_id, _MAX_CHAT_ID_LENGTH)
        return quote(value, safe="").replace(".", "%2E") if value is not None else None

    @staticmethod
    def _metadata_chat_id(metadata: dict[str, object]) -> str | None:
        return AvitoAdapter._bounded_string(metadata.get("chat_id"), _MAX_CHAT_ID_LENGTH)

    @staticmethod
    def _user_id(value: str | None) -> str | None:
        if value is None or value != value.strip() or not value.isascii() or not value.isdecimal():
            return None
        parsed = int(value)
        return str(parsed) if parsed > 0 and len(value) <= 20 else None

    @staticmethod
    def _positive_integer(value: object) -> int | None:
        return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None

    @staticmethod
    def _unix_seconds(value: object) -> int | None:
        return value if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= _MAX_UNIX_SECONDS else None

    @staticmethod
    def _bounded_string(value: object, maximum: int) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text if text and text == value and len(text) <= maximum and "\x00" not in text else None

    @staticmethod
    def _https_url(value: object) -> str | None:
        text = AvitoAdapter._bounded_string(value, 2_048)
        if text is None:
            return None
        try:
            parsed = urlsplit(text)
            port = parsed.port
        except ValueError:
            return None
        hostname = parsed.hostname
        if (
            parsed.scheme != "https"
            or hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or port is not None
            or not (hostname == "avito.ru" or hostname.endswith(".avito.ru"))
        ):
            return None
        return text

    @staticmethod
    def _headers(access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}"}

    @staticmethod
    def _object(value: object | None) -> dict[str, object] | None:
        return cast(dict[str, object], value) if isinstance(value, dict) else None

    @staticmethod
    def _copy_failure(result: AdapterResult) -> AdapterResult[object]:
        return AdapterResult(
            False,
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
            retry_after_seconds=result.retry_after_seconds,
        )

    @staticmethod
    def _malformed(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="malformed_payload", error_message_safe=message)

    @staticmethod
    def _invalid(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe=message)
