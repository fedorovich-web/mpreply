from __future__ import annotations

from datetime import UTC, date, datetime
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
from app.adapters.http import MAX_PROVIDER_RETRY_AFTER_SECONDS, ReadRetryPolicy, parse_retry_after, request_read_with_retry
from app.models.enums import Marketplace, MessageType

_PAGE_SIZE = 50
_MAX_CURSOR_LENGTH = 2_048
_MAX_PREFLIGHT_PAGES = 100
_MAX_REVIEW_REPLY_LENGTH = 4_096
_MAX_QUESTION_REPLY_LENGTH = 5_000
_WRITE_SCOPES = frozenset({"COMMUNICATION", "ALL_METHODS"})
_KNOWN_REPLY_STATES = frozenset({"PUBLISHED", "UNMODERATED", "BANNED", "DELETED"})
_SELLER_AUTHOR_TYPES = frozenset({"BUSINESS", "BRAND"})


class YandexMarketAdapter(ReviewQuestionAdapter):
    marketplace = Marketplace.YANDEX_MARKET

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
        business_id = self._business_id(seller_id)
        if business_id is None or not self._valid_api_key(credential):
            return cast(
                AdapterResult[CredentialValidation],
                self._invalid_input("Yandex Market business ID or API key has an invalid format"),
            )
        token = await self._post_read("/v2/auth/token", credential=credential)
        if not token.ok:
            return cast(AdapterResult[CredentialValidation], self._copy_failure(token))
        scopes = self._token_scopes(token.data)
        if scopes is None:
            return cast(
                AdapterResult[CredentialValidation],
                self._malformed("Yandex Market returned an invalid token response"),
            )
        if not _WRITE_SCOPES.intersection(scopes):
            return AdapterResult(
                False,
                error_code="insufficient_scope",
                error_message_safe="Yandex Market API key lacks Customer communication access",
            )
        probe = await self._post_read(
            f"/v2/businesses/{business_id}/goods-feedback",
            credential=credential,
            params={"limit": 1},
            body={"reactionStatus": "NEED_REACTION"},
        )
        if not probe.ok:
            return cast(AdapterResult[CredentialValidation], self._copy_failure(probe))
        if self._page_envelope(probe.data, "feedbacks", None) is None:
            return cast(
                AdapterResult[CredentialValidation],
                self._malformed("Yandex Market business access response is invalid"),
            )
        return AdapterResult(
            ok=True,
            data=CredentialValidation(
                scopes=(
                    "reviews:read",
                    "reviews:write",
                    "questions:read",
                    "questions:write",
                ),
                account_reference=str(business_id),
            ),
        )

    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        business_id = self._business_id(seller_id)
        if business_id is None or not self._valid_api_key(credential):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._invalid_input("Yandex Market business ID or API key has an invalid format"),
            )
        if not self._valid_cursor(cursor):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Yandex Market page token is invalid"),
            )
        params: dict[str, str | int] = {"limit": _PAGE_SIZE}
        if cursor is not None:
            params["pageToken"] = cursor
        if stream is MarketplaceStream.REVIEWS:
            path = f"/v2/businesses/{business_id}/goods-feedback"
            collection = "feedbacks"
            body: dict[str, object] = {"reactionStatus": "NEED_REACTION"}
        elif stream is MarketplaceStream.QUESTIONS:
            path = f"/v1/businesses/{business_id}/goods-questions"
            collection = "questions"
            body = {"needAnswer": True}
        else:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Yandex Market stream is not supported",
            )
        response = await self._post_read(
            path,
            credential=credential,
            params=params,
            body=body,
        )
        if not response.ok:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._copy_failure(response),
            )
        envelope = self._page_envelope(response.data, collection, cursor)
        if envelope is None:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Yandex Market returned an invalid page"),
            )
        records, next_cursor = envelope
        try:
            items = tuple(self._normalize_review(record) if stream is MarketplaceStream.REVIEWS else self._normalize_question(record) for record in records)
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Yandex Market returned an invalid message record"),
            )
        return AdapterResult(ok=True, data=MarketplacePage(items=items, next_cursor=next_cursor))

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        business_id = self._business_id(seller_id)
        entity_id = self._positive_integer(context.external_id)
        if business_id is None or entity_id is None or not self._valid_api_key(credential):
            return cast(
                AdapterResult[ExistingReplyResult],
                self._invalid_input("Yandex Market reply context is invalid"),
            )
        if context.message_type is MessageType.REVIEW:
            return await self._find_review_reply(credential, business_id, entity_id)
        if context.message_type is MessageType.QUESTION:
            return await self._find_question_reply(credential, business_id, entity_id)
        return AdapterResult(
            False,
            error_code="unsupported_capability",
            error_message_safe="Yandex Market message type is not supported",
        )

    async def fetch_questions_window(
        self,
        credential: str,
        seller_id: str | None,
        *,
        date_from: date,
        date_to: date,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        business_id = self._business_id(seller_id)
        if (
            business_id is None
            or not self._valid_api_key(credential)
            or not self._valid_cursor(cursor)
            or date_from > date_to
            or (date_to - date_from).days > 27
        ):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._invalid_input("Yandex Market question window is invalid"),
            )
        params: dict[str, str | int] = {"limit": _PAGE_SIZE}
        if cursor is not None:
            params["pageToken"] = cursor
        response = await self._post_read(
            f"/v1/businesses/{business_id}/goods-questions",
            credential=credential,
            params=params,
            body={
                "needAnswer": True,
                "dateFrom": date_from.isoformat(),
                "dateTo": date_to.isoformat(),
            },
        )
        if not response.ok:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._copy_failure(response),
            )
        envelope = self._page_envelope(response.data, "questions", cursor)
        if envelope is None:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Yandex Market returned an invalid question window page"),
            )
        records, next_cursor = envelope
        try:
            items = tuple(self._normalize_question(record) for record in records)
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed("Yandex Market returned an invalid question record"),
            )
        return AdapterResult(ok=True, data=MarketplacePage(items=items, next_cursor=next_cursor))

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        business_id = self._business_id(seller_id)
        entity_id = self._positive_integer(context.external_id)
        maximum = _MAX_REVIEW_REPLY_LENGTH if context.message_type is MessageType.REVIEW else _MAX_QUESTION_REPLY_LENGTH
        if (
            business_id is None
            or entity_id is None
            or not self._valid_api_key(credential)
            or not text
            or text != text.strip()
            or len(text) > maximum
            or "\x00" in text
        ):
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._invalid_input("Yandex Market reply input is invalid"),
            )
        if context.message_type is MessageType.REVIEW:
            response = await self._post_write(
                f"/v2/businesses/{business_id}/goods-feedback/comments/update",
                credential=credential,
                params={"sourceType": "SELLER"},
                body={"feedbackId": entity_id, "comment": {"text": text}},
            )
            if not response.ok:
                return cast(AdapterResult[ProviderWriteReceipt], self._copy_failure(response))
            result = self._result_object(response.data)
            reply_id = self._positive_integer(result.get("id") if result is not None else None)
            state = self._reply_state(result)
            if reply_id is None or state is None:
                return cast(
                    AdapterResult[ProviderWriteReceipt],
                    self._malformed("Yandex Market review write success could not be proven"),
                )
            return AdapterResult(
                ok=True,
                data=ProviderWriteReceipt(
                    provider_reply_id=str(reply_id),
                    provider_state=state.lower(),
                ),
            )
        if context.message_type is MessageType.QUESTION:
            response = await self._post_write(
                f"/v1/businesses/{business_id}/goods-questions/update",
                credential=credential,
                body={
                    "operationType": "CREATE",
                    "parentEntityId": {"id": entity_id, "type": "QUESTION"},
                    "text": text,
                },
            )
            if not response.ok:
                return cast(AdapterResult[ProviderWriteReceipt], self._copy_failure(response))
            result = self._result_object(response.data)
            entity = self._object(result.get("entity") if result is not None else None)
            reply_id = self._positive_integer(entity.get("id") if entity is not None else None)
            if reply_id is None or entity is None or entity.get("type") != "ANSWER":
                return cast(
                    AdapterResult[ProviderWriteReceipt],
                    self._malformed("Yandex Market question write success could not be proven"),
                )
            return AdapterResult(
                ok=True,
                data=ProviderWriteReceipt(provider_reply_id=str(reply_id)),
            )
        return AdapterResult(
            False,
            error_code="unsupported_capability",
            error_message_safe="Yandex Market message type is not supported",
        )

    async def _find_review_reply(
        self,
        credential: str,
        business_id: int,
        feedback_id: int,
    ) -> AdapterResult[ExistingReplyResult]:
        cursor: str | None = None
        seen: set[str] = set()
        seller_replies: list[tuple[str, str]] = []
        for _ in range(_MAX_PREFLIGHT_PAGES):
            params: dict[str, str | int] = {"limit": _PAGE_SIZE, "sourceType": "SELLER"}
            if cursor is not None:
                params["pageToken"] = cursor
            response = await self._post_read(
                f"/v2/businesses/{business_id}/goods-feedback/comments",
                credential=credential,
                params=params,
                body={"feedbackId": feedback_id},
            )
            if not response.ok:
                return cast(AdapterResult[ExistingReplyResult], self._copy_failure(response))
            envelope = self._page_envelope(response.data, "comments", cursor)
            if envelope is None:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Yandex Market returned an invalid review comment page"),
                )
            comments, next_cursor = envelope
            for comment in comments:
                ownership = self._seller_owned(comment)
                if ownership is None:
                    return AdapterResult(
                        ok=True,
                        data=ExistingReplyResult(exists=True, provider_state="unknown"),
                    )
                if ownership:
                    reply_id = self._positive_integer(comment.get("id"))
                    state = self._reply_state(comment)
                    if reply_id is None or state is None:
                        return AdapterResult(
                            ok=True,
                            data=ExistingReplyResult(exists=True, provider_state="unknown"),
                        )
                    seller_replies.append((str(reply_id), state.lower()))
            if next_cursor is None:
                return self._resolve_replies(seller_replies)
            if next_cursor in seen:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Yandex Market review comment page token repeated"),
                )
            seen.add(next_cursor)
            cursor = next_cursor
        return cast(
            AdapterResult[ExistingReplyResult],
            self._malformed("Yandex Market review preflight exceeded the safe page limit"),
        )

    async def _find_question_reply(
        self,
        credential: str,
        business_id: int,
        question_id: int,
    ) -> AdapterResult[ExistingReplyResult]:
        cursor: str | None = None
        seen: set[str] = set()
        seller_replies: list[tuple[str, str]] = []
        for _ in range(_MAX_PREFLIGHT_PAGES):
            params: dict[str, str | int] = {"limit": _PAGE_SIZE}
            if cursor is not None:
                params["pageToken"] = cursor
            response = await self._post_read(
                f"/v1/businesses/{business_id}/goods-questions/answers",
                credential=credential,
                params=params,
                body={"questionId": question_id},
            )
            if not response.ok:
                return cast(AdapterResult[ExistingReplyResult], self._copy_failure(response))
            envelope = self._page_envelope(response.data, "answers", cursor)
            if envelope is None:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Yandex Market returned an invalid question answer page"),
                )
            answers, next_cursor = envelope
            for answer in answers:
                ownership = self._seller_owned(answer)
                if ownership is None:
                    return AdapterResult(
                        ok=True,
                        data=ExistingReplyResult(exists=True, provider_state="unknown"),
                    )
                if ownership:
                    reply_id = self._positive_integer(answer.get("id"))
                    state = self._reply_state(answer)
                    if reply_id is None or state is None:
                        return AdapterResult(
                            ok=True,
                            data=ExistingReplyResult(exists=True, provider_state="unknown"),
                        )
                    seller_replies.append((str(reply_id), state.lower()))
            if next_cursor is None:
                return self._resolve_replies(seller_replies)
            if next_cursor in seen:
                return cast(
                    AdapterResult[ExistingReplyResult],
                    self._malformed("Yandex Market question answer page token repeated"),
                )
            seen.add(next_cursor)
            cursor = next_cursor
        return cast(
            AdapterResult[ExistingReplyResult],
            self._malformed("Yandex Market question preflight exceeded the safe page limit"),
        )

    @staticmethod
    def _resolve_replies(replies: list[tuple[str, str]]) -> AdapterResult[ExistingReplyResult]:
        if not replies:
            return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))
        if len(replies) != 1:
            return AdapterResult(
                ok=True,
                data=ExistingReplyResult(exists=True, provider_state="unknown"),
            )
        reply_id, state = replies[0]
        return AdapterResult(
            ok=True,
            data=ExistingReplyResult(
                exists=True,
                provider_reply_id=reply_id,
                provider_state=state,
            ),
        )

    @classmethod
    def _normalize_review(cls, record: dict[str, object]) -> NormalizedMessage:
        feedback_id = cls._positive_integer(record.get("feedbackId"))
        identifiers = cls._object(record.get("identifiers"))
        description = cls._object(record.get("description"))
        statistics = cls._object(record.get("statistics"))
        if feedback_id is None or identifiers is None or description is None or statistics is None:
            raise ValueError("Yandex Market review identity is invalid")
        offer_id = cls._bounded_string(identifiers.get("offerId"), 255)
        rating = cls._positive_integer(statistics.get("rating"))
        created_at = cls._datetime(record.get("createdAt"))
        if offer_id is None or rating is None or not 1 <= rating <= 5:
            raise ValueError("Yandex Market review product or rating is invalid")
        text_parts = [
            cls._bounded_string(description.get("comment"), 100_000),
            cls._prefixed("Advantages", description.get("advantages")),
            cls._prefixed("Disadvantages", description.get("disadvantages")),
        ]
        text = "\n".join(part for part in text_parts if part)
        need_reaction = record.get("needReaction")
        if type(need_reaction) is not bool or need_reaction is not True:
            raise ValueError("Yandex Market review reaction state is invalid")
        return NormalizedMessage(
            external_id=str(feedback_id),
            message_type=MessageType.REVIEW,
            rating=rating,
            customer_display_name=cls._bounded_string(record.get("author"), 255),
            customer_text=text,
            customer_photos=cls._photos(record.get("media")),
            marketplace_created_at=created_at,
            product=NormalizedProduct(
                external_id=offer_id,
                sku=offer_id,
                name=None,
                brand=None,
                category=None,
                image_url=None,
                product_url=None,
                metadata={"offer_id": offer_id},
            ),
            metadata={
                "source": "yandex_market.goods_feedback",
                "status": "needs_reply",
                "is_answered": False,
            },
        )

    @classmethod
    def _normalize_question(cls, record: dict[str, object]) -> NormalizedMessage:
        identifiers = cls._object(record.get("questionIdentifiers"))
        author = cls._object(record.get("author"))
        if identifiers is None or author is None:
            raise ValueError("Yandex Market question identity is invalid")
        question_id = cls._positive_integer(identifiers.get("id"))
        offer_id = cls._bounded_string(identifiers.get("offerId"), 255)
        business_id = cls._positive_integer(record.get("businessId"))
        text = cls._bounded_string(record.get("text"), 5_000)
        if question_id is None or offer_id is None or business_id is None or text is None:
            raise ValueError("Yandex Market question required field is invalid")
        return NormalizedMessage(
            external_id=str(question_id),
            message_type=MessageType.QUESTION,
            rating=None,
            customer_display_name=cls._bounded_string(author.get("name"), 255),
            customer_text=text,
            customer_photos=(),
            marketplace_created_at=cls._datetime(record.get("createdAt")),
            product=NormalizedProduct(
                external_id=offer_id,
                sku=offer_id,
                name=None,
                brand=None,
                category=None,
                image_url=None,
                product_url=None,
                metadata={"business_id": business_id, "offer_id": offer_id},
            ),
            metadata={
                "source": "yandex_market.goods_questions",
                "status": "needs_reply",
                "is_answered": False,
            },
        )

    async def _post_read(
        self,
        path: str,
        *,
        credential: str,
        params: dict[str, str | int] | None = None,
        body: dict[str, object] | None = None,
    ) -> AdapterResult[object]:
        try:
            response = await request_read_with_retry(
                self._client,
                "POST",
                path,
                headers=self._headers(credential),
                params=params,
                json=body,
                policy=self._read_retry_policy,
            )
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Yandex Market request timed out")
        except httpx.RequestError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Yandex Market network request failed")
        return self._response_result(response)

    async def _post_write(
        self,
        path: str,
        *,
        credential: str,
        params: dict[str, str | int] | None = None,
        body: dict[str, object],
    ) -> AdapterResult[object]:
        try:
            response = await self._client.post(
                path,
                headers=self._headers(credential),
                params=params,
                json=body,
            )
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Yandex Market write timed out")
        except httpx.RequestError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Yandex Market network request failed")
        return self._response_result(response)

    def _response_result(self, response: httpx.Response) -> AdapterResult[object]:
        if not response.is_success:
            return self._map_error(response)
        try:
            payload: object = response.json()
        except ValueError:
            return self._malformed("Yandex Market returned invalid JSON")
        mapping = self._object(payload)
        if mapping is None or mapping.get("status") != "OK":
            if mapping is not None and mapping.get("status") == "ERROR":
                return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe="Yandex Market returned an API error")
            return self._malformed("Yandex Market returned an invalid response envelope")
        return AdapterResult(ok=True, data=mapping)

    def _map_error(self, response: httpx.Response) -> AdapterResult[object]:
        retry_after = (
            parse_retry_after(
                response.headers.get("Retry-After"),
                now=datetime.now(UTC),
                maximum_seconds=MAX_PROVIDER_RETRY_AFTER_SECONDS,
            )
            if response.status_code in {420, 429, 503}
            else None
        )
        if response.status_code == 401:
            code = "invalid_credentials"
            message = "Yandex Market API key is invalid"
        elif response.status_code == 403:
            code = "insufficient_scope"
            message = "Yandex Market API key has insufficient permissions"
        elif response.status_code == 404:
            code = "marketplace_not_found"
            message = "Yandex Market business or resource was not found"
        elif response.status_code in {420, 429}:
            code = "rate_limited"
            message = "Yandex Market request limit was exceeded"
        elif 500 <= response.status_code <= 599:
            code = "marketplace_unavailable"
            message = "Yandex Market is temporarily unavailable"
        else:
            code = "marketplace_validation_error"
            message = "Yandex Market rejected the request"
        return AdapterResult(False, error_code=code, error_message_safe=message, retry_after_seconds=retry_after)

    @classmethod
    def _page_envelope(
        cls,
        value: object | None,
        collection: str,
        requested_cursor: str | None,
    ) -> tuple[list[dict[str, object]], str | None] | None:
        result = cls._result_object(value)
        if result is None:
            return None
        records_value = result.get(collection)
        paging = cls._object(result.get("paging"))
        if not isinstance(records_value, list) or paging is None:
            return None
        raw_records = cast(list[object], records_value)
        if len(raw_records) > _PAGE_SIZE or not all(isinstance(item, dict) for item in raw_records):
            return None
        next_value = paging.get("nextPageToken")
        if next_value is None:
            next_cursor = None
        elif isinstance(next_value, str):
            next_cursor = next_value.strip()
            if not next_cursor or next_cursor == requested_cursor or not cls._valid_cursor(next_cursor):
                return None
        else:
            return None
        return [cast(dict[str, object], item) for item in raw_records], next_cursor

    @classmethod
    def _token_scopes(cls, value: object | None) -> frozenset[str] | None:
        result = cls._result_object(value)
        api_key = cls._object(result.get("apiKey") if result is not None else None)
        scopes_value = api_key.get("authScopes") if api_key is not None else None
        if not isinstance(scopes_value, list):
            return None
        scopes: set[str] = set()
        for value in cast(list[object], scopes_value):
            if not isinstance(value, str) or not value:
                return None
            scopes.add(value.upper())
        return frozenset(scopes)

    @classmethod
    def _seller_owned(cls, value: dict[str, object]) -> bool | None:
        can_modify = value.get("canModify")
        author = cls._object(value.get("author"))
        if type(can_modify) is not bool or author is None:
            return None
        author_type_value = author.get("type")
        if author_type_value is None:
            author_type = ""
        elif isinstance(author_type_value, str):
            author_type = author_type_value.upper()
        else:
            return None
        if can_modify is True and author_type not in {"", *_SELLER_AUTHOR_TYPES}:
            return None
        if can_modify is False and author_type in _SELLER_AUTHOR_TYPES:
            return None
        return can_modify is True or author_type in _SELLER_AUTHOR_TYPES

    @staticmethod
    def _reply_state(value: dict[str, object] | None) -> str | None:
        state = value.get("status") if value is not None else None
        if not isinstance(state, str):
            return None
        normalized = state.upper()
        return normalized if normalized in _KNOWN_REPLY_STATES else None

    @staticmethod
    def _photos(value: object | None) -> tuple[str, ...]:
        if value is None:
            return ()
        media = YandexMarketAdapter._object(value)
        photos_value = media.get("photos") if media is not None else None
        if photos_value is None:
            return ()
        if not isinstance(photos_value, list):
            raise ValueError("Yandex Market review media is invalid")
        photos: list[str] = []
        for raw in cast(list[object], photos_value):
            url = YandexMarketAdapter._bounded_string(raw, 2_048)
            if url is None or not url.startswith("https://"):
                raise ValueError("Yandex Market review photo is invalid")
            photos.append(url)
        if len(photos) > 20:
            raise ValueError("Yandex Market review photo count is invalid")
        return tuple(photos)

    @staticmethod
    def _datetime(value: object) -> datetime:
        if not isinstance(value, str) or not value:
            raise ValueError("Yandex Market timestamp is missing")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Yandex Market timestamp is malformed") from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Yandex Market timestamp has no timezone")
        return parsed

    @staticmethod
    def _prefixed(label: str, value: object) -> str | None:
        text = YandexMarketAdapter._bounded_string(value, 100_000)
        return f"{label}: {text}" if text is not None else None

    @staticmethod
    def _headers(credential: str) -> dict[str, str]:
        return {"Api-Key": credential, "Content-Type": "application/json"}

    @staticmethod
    def _valid_api_key(value: str) -> bool:
        return bool(value and value == value.strip() and len(value) <= 4_096 and all(ord(character) >= 32 for character in value))

    @staticmethod
    def _business_id(value: str | None) -> int | None:
        if value is None or value != value.strip() or not value.isascii() or not value.isdecimal():
            return None
        return YandexMarketAdapter._positive_integer(value)

    @staticmethod
    def _positive_integer(value: object) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value if value > 0 else None
        if isinstance(value, str) and value.isascii() and value.isdecimal():
            parsed = int(value)
            return parsed if parsed > 0 else None
        return None

    @staticmethod
    def _bounded_string(value: object, maximum: int) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text if text and len(text) <= maximum and "\x00" not in text else None

    @staticmethod
    def _valid_cursor(value: str | None) -> bool:
        return value is None or bool(value and value == value.strip() and len(value) <= _MAX_CURSOR_LENGTH and "\x00" not in value)

    @staticmethod
    def _object(value: object | None) -> dict[str, object] | None:
        return cast(dict[str, object], value) if isinstance(value, dict) else None

    @classmethod
    def _result_object(cls, value: object | None) -> dict[str, object] | None:
        envelope = cls._object(value)
        return cls._object(envelope.get("result") if envelope is not None else None)

    @staticmethod
    def _copy_failure(result: AdapterResult[object]) -> AdapterResult[object]:
        return AdapterResult(False, error_code=result.error_code, error_message_safe=result.error_message_safe, retry_after_seconds=result.retry_after_seconds)

    @staticmethod
    def _malformed(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="malformed_payload", error_message_safe=message)

    @staticmethod
    def _invalid_input(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe=message)
