from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import httpx

from app.adapters.base import (
    AdapterResult,
    CredentialValidation,
    ExistingReplyResult,
    MarketplacePage,
    NormalizedMessage,
    NormalizedProduct,
    ProviderMessageContext,
    ProviderWriteReceipt,
    ReviewQuestionAdapter,
)
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy, parse_retry_after, request_read_with_retry
from app.models.enums import Marketplace, MessageType

REVIEW_METHODS = frozenset(
    {
        "/v2/review/list",
        "/v1/review/comment/list",
        "/v1/review/comment/create",
    }
)
QUESTION_METHODS = frozenset(
    {
        "/v1/question/list",
        "/v1/question/answer/list",
        "/v1/question/answer/create",
    }
)

_PAGE_SIZE = 100
_MAX_CURSOR_LENGTH = 2_048
_MAX_PREFLIGHT_PAGES = 100
_MAX_REPLY_TEXT_LENGTH = 3_000


class OzonAdapter(ReviewQuestionAdapter):
    marketplace = Marketplace.OZON

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
    ) -> None:
        self._client = client
        self._read_retry_policy = read_retry_policy

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None,
    ) -> AdapterResult[CredentialValidation]:
        client_id = self._client_id(seller_id)
        if client_id is None or not self._valid_api_key(credential):
            return AdapterResult(
                False,
                error_code="marketplace_validation_error",
                error_message_safe="Ozon Client ID or API key has an invalid format",
            )
        response = await self._post_read(
            "/v1/roles",
            credential=credential,
            client_id=client_id,
            body={},
        )
        if not response.ok:
            return AdapterResult(
                False,
                error_code=response.error_code,
                error_message_safe=response.error_message_safe,
                retry_after_seconds=response.retry_after_seconds,
            )
        parsed = self._parse_roles(response.data)
        if parsed is None:
            return cast(
                AdapterResult[CredentialValidation],
                self._malformed("Ozon returned an invalid roles response"),
            )
        methods = parsed
        scopes: list[str] = []
        if REVIEW_METHODS.issubset(methods):
            scopes.extend(("reviews:read", "reviews:write"))
        if QUESTION_METHODS.issubset(methods):
            scopes.extend(("questions:read", "questions:write"))
        if not scopes:
            return AdapterResult(
                False,
                error_code="insufficient_scope",
                error_message_safe="Ozon API key does not grant a complete review or question workflow",
            )
        return AdapterResult(
            ok=True,
            data=CredentialValidation(scopes=tuple(scopes), account_reference=client_id),
        )

    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        client_id = self._client_id(seller_id)
        if client_id is None or not self._valid_api_key(credential):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._invalid_input("Ozon Client ID or API key has an invalid format"),
            )
        if not self._valid_cursor(cursor):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Ozon pagination cursor is invalid"),
            )
        if stream is MarketplaceStream.REVIEWS:
            path = "/v2/review/list"
            collection_key = "reviews"
            body: dict[str, object] = {"limit": _PAGE_SIZE, "sort_dir": "ASC"}
            if cursor is not None:
                body["last_id"] = cursor
        elif stream is MarketplaceStream.QUESTIONS:
            path = "/v1/question/list"
            collection_key = "questions"
            body = {
                "filter": {"status": "ALL"},
                "limit": _PAGE_SIZE,
                "last_id": cursor or "",
                "sort_dir": "ASC",
            }
        else:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Ozon stream is not supported",
            )
        response = await self._post_read(
            path,
            credential=credential,
            client_id=client_id,
            body=body,
        )
        if not response.ok:
            return AdapterResult(
                False,
                error_code=response.error_code,
                error_message_safe=response.error_message_safe,
                retry_after_seconds=response.retry_after_seconds,
            )
        return self._normalize_page(response.data, stream, collection_key, cursor)

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        client_id = self._client_id(seller_id)
        if client_id is None or not self._valid_api_key(credential):
            return cast(
                AdapterResult[ExistingReplyResult],
                self._invalid_input("Ozon Client ID or API key has an invalid format"),
            )
        if not self._valid_external_id(context.external_id):
            return cast(
                AdapterResult[ExistingReplyResult],
                self._invalid_input("Ozon message ID is invalid"),
            )
        if context.message_type is MessageType.REVIEW:
            return await self._find_review_reply(
                credential,
                client_id,
                context.external_id,
            )
        if context.message_type is MessageType.QUESTION:
            sku = self._context_sku(context)
            if sku is None:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._invalid_input("Ozon question SKU context is invalid"),
                )
            return await self._find_question_reply(
                credential,
                client_id,
                context.external_id,
                sku,
            )
        return AdapterResult(
            False,
            error_code="unsupported_capability",
            error_message_safe="Ozon message type is not supported",
        )

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        client_id = self._client_id(seller_id)
        if (
            client_id is None
            or not self._valid_api_key(credential)
            or not self._valid_external_id(context.external_id)
            or not text
            or text != text.strip()
            or len(text) > _MAX_REPLY_TEXT_LENGTH
            or "\x00" in text
        ):
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._invalid_input("Ozon reply input is invalid"),
            )
        if context.message_type is MessageType.REVIEW:
            path = "/v1/review/comment/create"
            body: dict[str, object] = {
                "review_id": context.external_id,
                "text": text,
                "mark_review_as_processed": True,
            }
            receipt_key = "comment_id"
        elif context.message_type is MessageType.QUESTION:
            sku = self._context_sku(context)
            if sku is None or len(text) < 2:
                return cast(
                    AdapterResult[ProviderWriteReceipt],
                    self._invalid_input("Ozon question reply input is invalid"),
                )
            path = "/v1/question/answer/create"
            body = {"question_id": context.external_id, "sku": sku, "text": text}
            receipt_key = "answer_id"
        else:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Ozon message type is not supported",
            )
        response = await self._post_write(
            path,
            credential=credential,
            client_id=client_id,
            body=body,
        )
        if not response.ok:
            return AdapterResult(
                False,
                error_code=response.error_code,
                error_message_safe=response.error_message_safe,
                retry_after_seconds=response.retry_after_seconds,
            )
        payload = self._object(response.data)
        provider_reply_id = self._required_string(
            payload.get(receipt_key) if payload is not None else None
        )
        if provider_reply_id is None:
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._malformed("Ozon write success could not be proven"),
            )
        return AdapterResult(
            ok=True,
            data=ProviderWriteReceipt(provider_reply_id=provider_reply_id),
        )

    async def _find_review_reply(
        self,
        credential: str,
        client_id: str,
        review_id: str,
    ) -> AdapterResult[ExistingReplyResult]:
        for page_number in range(_MAX_PREFLIGHT_PAGES):
            response = await self._post_read(
                "/v1/review/comment/list",
                credential=credential,
                client_id=client_id,
                body={
                    "review_id": review_id,
                    "limit": _PAGE_SIZE,
                    "offset": page_number * _PAGE_SIZE,
                    "sort_dir": "ASC",
                },
            )
            if not response.ok:
                return AdapterResult(
                    False,
                    error_code=response.error_code,
                    error_message_safe=response.error_message_safe,
                    retry_after_seconds=response.retry_after_seconds,
                )
            payload = self._object(response.data)
            comments = self._object_list(payload.get("comments") if payload is not None else None)
            if comments is None:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Ozon returned an invalid review comment page"),
                )
            for comment in comments:
                is_owner = comment.get("is_owner")
                is_published = comment.get("is_published")
                is_rejected = comment.get("is_rejected")
                if not all(type(value) is bool for value in (is_owner, is_published, is_rejected)):
                    return cast(
                        AdapterResult[ExistingReplyResult],
                        self._malformed("Ozon returned an invalid review comment"),
                    )
                if is_owner is True and is_published is True and is_rejected is False:
                    return AdapterResult(
                        ok=True,
                        data=ExistingReplyResult(
                            exists=True,
                            provider_reply_id=self._optional_string(comment.get("id")),
                            provider_state="published",
                        ),
                    )
            if len(comments) < _PAGE_SIZE:
                return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))
        return cast(
            AdapterResult[ExistingReplyResult],
            self._malformed("Ozon review preflight exceeded the safe page limit"),
        )

    async def _find_question_reply(
        self,
        credential: str,
        client_id: str,
        question_id: str,
        sku: int,
    ) -> AdapterResult[ExistingReplyResult]:
        cursor = ""
        seen: set[str] = set()
        for _ in range(_MAX_PREFLIGHT_PAGES):
            response = await self._post_read(
                "/v1/question/answer/list",
                credential=credential,
                client_id=client_id,
                body={"question_id": question_id, "sku": sku, "last_id": cursor},
            )
            if not response.ok:
                return AdapterResult(
                    False,
                    error_code=response.error_code,
                    error_message_safe=response.error_message_safe,
                    retry_after_seconds=response.retry_after_seconds,
                )
            payload = self._object(response.data)
            answers = self._object_list(payload.get("answers") if payload is not None else None)
            next_cursor_value = payload.get("last_id") if payload is not None else None
            if answers is None or not isinstance(next_cursor_value, str):
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Ozon returned an invalid question answer page"),
                )
            if answers:
                answer_id = self._required_string(answers[0].get("id"))
                if answer_id is None:
                    return cast(
                        AdapterResult[ExistingReplyResult],
                        self._malformed("Ozon returned an invalid question answer"),
                    )
                return AdapterResult(
                    ok=True,
                    data=ExistingReplyResult(
                        exists=True,
                        provider_reply_id=answer_id,
                        provider_state="answered",
                    ),
                )
            next_cursor = next_cursor_value.strip()
            if not next_cursor:
                return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))
            if next_cursor == cursor or next_cursor in seen or not self._valid_cursor(next_cursor):
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Ozon question preflight cursor repeated or is invalid"),
                )
            seen.add(next_cursor)
            cursor = next_cursor
        return cast(
            AdapterResult[ExistingReplyResult],
            self._malformed("Ozon question preflight exceeded the safe page limit"),
        )

    def _normalize_page(
        self,
        value: object | None,
        stream: MarketplaceStream,
        collection_key: str,
        requested_cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        payload = self._object(value)
        records = self._object_list(payload.get(collection_key) if payload is not None else None)
        has_next = payload.get("has_next") if payload is not None else None
        last_id = payload.get("last_id") if payload is not None else None
        if (
            records is None
            or len(records) > _PAGE_SIZE
            or type(has_next) is not bool
            or not isinstance(last_id, str)
        ):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Ozon returned an invalid message page"),
            )
        normalized: list[NormalizedMessage] = []
        try:
            for record in records:
                message = self._normalize_record(record, stream)
                if message is not None:
                    normalized.append(message)
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Ozon returned an invalid message record"),
            )
        next_cursor: str | None = None
        if has_next:
            candidate = last_id.strip()
            if (
                not candidate
                or candidate == requested_cursor
                or not self._valid_cursor(candidate)
            ):
                return cast(
                    AdapterResult[MarketplacePage[NormalizedMessage]],
                    self._malformed("Ozon returned an invalid pagination cursor"),
                )
            next_cursor = candidate
        return AdapterResult(
            ok=True,
            data=MarketplacePage(items=tuple(normalized), next_cursor=next_cursor),
        )

    def _normalize_record(
        self,
        record: dict[str, object],
        stream: MarketplaceStream,
    ) -> NormalizedMessage | None:
        identifier = self._required_string(record.get("id"))
        text = self._required_string(record.get("text"))
        published_at = self._datetime(record.get("published_at"))
        sku = self._record_sku(record.get("sku"), stream)
        status = self._required_string(record.get("status"))
        if identifier is None or text is None or sku is None or status is None:
            raise ValueError("required Ozon message field is missing")
        rating = self._optional_rating(record.get("rating"))
        if stream is MarketplaceStream.REVIEWS:
            if status != "UNPROCESSED":
                return None
            message_type = MessageType.REVIEW
            customer_name = None
        elif stream is MarketplaceStream.QUESTIONS:
            answers_count = record.get("answers_count")
            if isinstance(answers_count, bool) or not isinstance(answers_count, int):
                raise ValueError("Ozon question answer count is invalid")
            if status != "UNPROCESSED" or answers_count != 0:
                return None
            if rating is not None:
                raise ValueError("Ozon question rating is invalid")
            message_type = MessageType.QUESTION
            customer_name = self._optional_string(record.get("author_name"))
        else:
            raise ValueError("unsupported Ozon message stream")
        product_name = self._optional_string(record.get("product_name"))
        product_url = self._optional_string(record.get("product_url"))
        return NormalizedMessage(
            external_id=identifier,
            message_type=message_type,
            rating=rating,
            customer_display_name=customer_name,
            customer_text=text,
            customer_photos=(),
            marketplace_created_at=published_at,
            product=NormalizedProduct(
                external_id=str(sku),
                sku=str(sku),
                name=product_name,
                brand=None,
                category=None,
                image_url=None,
                product_url=product_url,
                metadata={"product_id": sku},
            ),
            metadata={
                "source": "ozon.reviews" if stream is MarketplaceStream.REVIEWS else "ozon.questions",
                "status": status,
                "is_answered": False,
                "sku": sku,
            },
        )

    async def _post_read(
        self,
        path: str,
        *,
        credential: str,
        client_id: str,
        body: dict[str, object],
    ) -> AdapterResult[object]:
        try:
            response = await request_read_with_retry(
                self._client,
                "POST",
                path,
                headers=self._headers(credential, client_id),
                json=body,
                policy=self._read_retry_policy,
            )
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Ozon request timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Ozon network request failed",
            )
        return self._response_result(response)

    async def _post_write(
        self,
        path: str,
        *,
        credential: str,
        client_id: str,
        body: dict[str, object],
    ) -> AdapterResult[object]:
        try:
            response = await self._client.post(
                path,
                headers=self._headers(credential, client_id),
                json=body,
            )
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Ozon write timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Ozon network request failed",
            )
        return self._response_result(response)

    def _response_result(self, response: httpx.Response) -> AdapterResult[object]:
        if not response.is_success:
            return self._map_error(response)
        try:
            payload: object = response.json()
        except ValueError:
            return self._malformed("Ozon returned invalid JSON")
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
            message = "Ozon API key is invalid"
        elif response.status_code in {402, 403}:
            code = "insufficient_scope"
            message = "Ozon API key or subscription has insufficient permissions"
        elif response.status_code == 404:
            code = "marketplace_not_found"
            message = "Ozon resource was not found"
        elif response.status_code == 429:
            code = "rate_limited"
            message = "Ozon rate limit was exceeded"
        elif 500 <= response.status_code <= 599:
            code = "marketplace_unavailable"
            message = "Ozon is temporarily unavailable"
        else:
            code = "marketplace_validation_error"
            message = "Ozon rejected the request"
        return AdapterResult(
            False,
            error_code=code,
            error_message_safe=message,
            retry_after_seconds=retry_after,
        )

    @staticmethod
    def _parse_roles(value: object | None) -> frozenset[str] | None:
        payload = OzonAdapter._object(value)
        if payload is None or not OzonAdapter._valid_datetime_string(payload.get("expires_at")):
            return None
        roles_value = payload.get("roles")
        if not isinstance(roles_value, list):
            return None
        methods: set[str] = set()
        for role_value in cast(list[object], roles_value):
            role = OzonAdapter._object(role_value)
            if role is None:
                return None
            role_methods = role.get("methods")
            if not isinstance(role_methods, list):
                return None
            for method in cast(list[object], role_methods):
                if not isinstance(method, str) or not method:
                    return None
                methods.add(method)
        return frozenset(methods)

    @staticmethod
    def _headers(credential: str, client_id: str) -> dict[str, str]:
        return {
            "Api-Key": credential,
            "Client-Id": client_id,
            "Content-Type": "application/json",
        }

    @staticmethod
    def _client_id(value: str | None) -> str | None:
        if value is None or value != value.strip() or not value.isascii() or not value.isdecimal():
            return None
        return value if len(value) <= 64 else None

    @staticmethod
    def _valid_api_key(value: str) -> bool:
        return bool(
            value
            and value == value.strip()
            and len(value) <= 4_096
            and all(ord(character) >= 32 for character in value)
        )

    @staticmethod
    def _valid_cursor(value: str | None) -> bool:
        return value is None or bool(
            value
            and value == value.strip()
            and len(value) <= _MAX_CURSOR_LENGTH
            and "\x00" not in value
        )

    @staticmethod
    def _valid_external_id(value: str) -> bool:
        return bool(value and value == value.strip() and len(value) <= 255 and "\x00" not in value)

    @staticmethod
    def _context_sku(context: ProviderMessageContext) -> int | None:
        return OzonAdapter._positive_integer(context.metadata.get("sku"))

    @staticmethod
    def _object(value: object | None) -> dict[str, object] | None:
        return cast(dict[str, object], value) if isinstance(value, dict) else None

    @staticmethod
    def _object_list(value: object | None) -> list[dict[str, object]] | None:
        if not isinstance(value, list):
            return None
        items = cast(list[object], value)
        if not all(isinstance(item, dict) for item in items):
            return None
        return [cast(dict[str, object], item) for item in items]

    @staticmethod
    def _required_string(value: object) -> str | None:
        text = OzonAdapter._optional_string(value)
        return text if text is not None and len(text) <= 4_096 else None

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text or None

    @staticmethod
    def _positive_integer(value: object) -> int | None:
        return value if isinstance(value, int) and not isinstance(value, bool) and value > 0 else None

    @staticmethod
    def _record_sku(value: object, stream: MarketplaceStream) -> int | None:
        numeric = OzonAdapter._positive_integer(value)
        if numeric is not None or stream is MarketplaceStream.QUESTIONS:
            return numeric
        if not isinstance(value, str) or not value.isascii() or not value.isdecimal():
            return None
        parsed = int(value)
        return parsed if parsed > 0 else None

    @staticmethod
    def _optional_rating(value: object) -> int | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 5:
            raise ValueError("Ozon rating is invalid")
        return value

    @staticmethod
    def _datetime(value: object) -> datetime:
        if not isinstance(value, str) or not value:
            raise ValueError("Ozon timestamp is missing")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Ozon timestamp is malformed") from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Ozon timestamp has no timezone")
        return parsed

    @staticmethod
    def _valid_datetime_string(value: object) -> bool:
        try:
            OzonAdapter._datetime(value)
        except ValueError:
            return False
        return True

    @staticmethod
    def _malformed(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="malformed_payload", error_message_safe=message)

    @staticmethod
    def _invalid_input(message: str) -> AdapterResult[object]:
        return AdapterResult(
            False,
            error_code="marketplace_validation_error",
            error_message_safe=message,
        )
