from __future__ import annotations

import base64
import binascii
import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import cast
from urllib.parse import urlsplit

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
from app.adapters.wildberries_read_limiter import WildberriesReadLimiter
from app.models.enums import Marketplace, MessageType

_PAGE_SIZE = 50
_MAX_REVIEW_OFFSET = 199_990
_MAX_QUESTION_OFFSET = 9_950
_MAX_REPLY_TEXT_LENGTH = 5_000
_FEEDBACKS_AND_QUESTIONS_SCOPE = 1 << 7
_READ_ONLY_SCOPE = 1 << 30
_Normalizer = Callable[[dict[str, object]], NormalizedMessage]


class WildberriesAdapter(ReviewQuestionAdapter):
    marketplace = Marketplace.WILDBERRIES

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
        read_limiter: WildberriesReadLimiter | None = None,
    ) -> None:
        self._client = client
        self._read_retry_policy = read_retry_policy
        self._read_limiter = read_limiter

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None = None,
    ) -> AdapterResult[CredentialValidation]:
        token_scope = self._token_scope(credential)
        if token_scope is None:
            return AdapterResult(
                False,
                error_code="invalid_credentials",
                error_message_safe="Wildberries API key has an invalid format",
            )
        if not token_scope & _FEEDBACKS_AND_QUESTIONS_SCOPE or token_scope & _READ_ONLY_SCOPE:
            return AdapterResult(
                False,
                error_code="insufficient_scope",
                error_message_safe="Wildberries API key cannot read and answer feedbacks and questions",
            )
        # WB provides a category-specific authentication probe. Do not spend a
        # question-list request or make authentication depend on its records.
        result = await self._read("/ping", credential, params={})
        if not result.ok:
            return AdapterResult(
                False,
                error_code=result.error_code,
                error_message_safe=result.error_message_safe,
                retry_after_seconds=result.retry_after_seconds,
            )
        payload = result.data
        if not isinstance(payload, dict) or cast(dict[str, object], payload).get("Status") != "OK":
            return AdapterResult(False, error_code="malformed_payload", error_message_safe="Wildberries access check could not be proven")
        return AdapterResult(
            ok=True,
            data=CredentialValidation(
                scopes=(
                    "reviews:read",
                    "reviews:write",
                    "questions:read",
                    "questions:write",
                ),
                account_reference=None,
            ),
        )

    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        del seller_id
        contract = self._stream_contract(stream)
        if contract is None:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Wildberries stream is not supported",
            )
        path, collection_key, normalizer = contract
        max_offset = _MAX_REVIEW_OFFSET if stream is MarketplaceStream.REVIEWS else _MAX_QUESTION_OFFSET
        offset = self._parse_cursor(cursor, max_offset=max_offset)
        if offset is None:
            return AdapterResult(
                False,
                error_code="malformed_payload",
                error_message_safe="Wildberries pagination cursor is invalid",
            )
        response_result = await self._read(
            path,
            credential,
            params={"isAnswered": "false", "take": _PAGE_SIZE, "skip": offset},
        )
        if not response_result.ok:
            return AdapterResult(
                False,
                error_code=response_result.error_code,
                error_message_safe=response_result.error_message_safe,
                retry_after_seconds=response_result.retry_after_seconds,
            )
        records = self._page_records(response_result.data, collection_key)
        if records is None:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed_payload("Wildberries returned an invalid page"),
            )
        if len(records) > _PAGE_SIZE:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed_payload("Wildberries returned an oversized page"),
            )
        try:
            items = tuple(normalizer(record) for record in records)
        except (TypeError, ValueError):
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed_payload("Wildberries returned an invalid record"),
            )
        next_offset = offset + _PAGE_SIZE
        if len(items) == _PAGE_SIZE and next_offset > max_offset:
            return cast(
                AdapterResult[MarketplacePage[NormalizedMessage]],
                self._malformed_payload("Wildberries pagination exceeded the safe limit"),
            )
        next_cursor = str(next_offset) if len(items) == _PAGE_SIZE else None
        return AdapterResult(ok=True, data=MarketplacePage(items=items, next_cursor=next_cursor))

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        del seller_id
        path = self._detail_path(context.message_type)
        if path is None:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Wildberries message type is not supported",
            )
        response_result = await self._read(
            path,
            credential,
            params={"id": context.external_id},
        )
        if not response_result.ok:
            return AdapterResult(
                False,
                error_code=response_result.error_code,
                error_message_safe=response_result.error_message_safe,
                retry_after_seconds=response_result.retry_after_seconds,
            )
        data = self._required_data_object(response_result.data)
        if data is None or data.get("id") != context.external_id:
            return cast(
                AdapterResult[ExistingReplyResult],
                self._malformed_payload("Wildberries returned an invalid message detail"),
            )
        try:
            exists = self.is_already_answered(data)
        except ValueError:
            return cast(
                AdapterResult[ExistingReplyResult],
                self._malformed_payload("Wildberries returned an invalid answer state"),
            )
        native_state = self._optional_string(data.get("state"))
        provider_state = native_state
        if exists and context.message_type is MessageType.QUESTION and native_state == "none":
            provider_state = "not_public"
        elif exists and native_state in {None, "wbRu"}:
            provider_state = "accepted_unverified"
        return AdapterResult(
            ok=True,
            data=ExistingReplyResult(
                exists=exists,
                provider_reply_id=context.external_id if exists else None,
                provider_state=provider_state,
            ),
        )

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        del seller_id
        if (
            not context.external_id
            or len(context.external_id) > 255
            or "\x00" in context.external_id
            or not text.strip()
            or (context.message_type is MessageType.REVIEW and len(text.strip()) < 2)
            or len(text) > _MAX_REPLY_TEXT_LENGTH
            or "\x00" in text
        ):
            return AdapterResult(
                False,
                error_code="marketplace_validation_error",
                error_message_safe="Wildberries reply input is invalid",
            )
        if context.message_type is MessageType.REVIEW:
            method = "POST"
            path = "/api/v1/feedbacks/answer"
            write_payload: dict[str, object] = {"id": context.external_id, "text": text}
        elif context.message_type is MessageType.QUESTION:
            method = "PATCH"
            path = "/api/v1/questions"
            write_payload = {"id": context.external_id, "text": text, "state": "wbRu"}
        else:
            return AdapterResult(
                False,
                error_code="unsupported_capability",
                error_message_safe="Wildberries message type is not supported",
            )
        try:
            response = await self._client.request(
                method,
                path,
                headers=self._headers(credential),
                json=write_payload,
            )
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Wildberries write timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Wildberries network request failed",
            )
        if not response.is_success:
            return cast(AdapterResult[ProviderWriteReceipt], self._map_error_response(response))
        if context.message_type is MessageType.REVIEW:
            confirmed = response.status_code == 204 and not response.content
        else:
            try:
                payload: object = response.json()
            except ValueError:
                payload = None
            confirmed = response.status_code == 200 and self._successful_question_write(payload)
        if not confirmed:
            return cast(
                AdapterResult[ProviderWriteReceipt],
                self._malformed_payload("Wildberries write success could not be proven"),
            )
        return AdapterResult(
            ok=True,
            data=ProviderWriteReceipt(provider_reply_id=context.external_id, provider_state="accepted_unverified"),
        )

    def normalize_review(self, raw: dict[str, object]) -> NormalizedMessage:
        photos = self._photos(raw)
        video_url = self._video_url(raw.get("video"))
        deficiencies = self._deficiencies(raw.get("bables"))
        raw_text = raw.get("text")
        if raw_text is not None and not isinstance(raw_text, str):
            raise ValueError("Wildberries feedback text is malformed")
        text = raw_text.strip() if isinstance(raw_text, str) else ""
        rating = self._rating(raw.get("productValuation"))
        if len(text) > 12_000 or "\x00" in text or (not text and not photos and not video_url and not deficiencies and rating is None):
            raise ValueError("Wildberries feedback content is missing")
        return NormalizedMessage(
            external_id=self._required_string(
                raw.get("id"),
                field_name="feedback ID",
            ),
            message_type=MessageType.REVIEW,
            rating=rating,
            customer_display_name=self._optional_string(raw.get("userName")),
            customer_text=text,
            customer_photos=photos,
            marketplace_created_at=self._datetime(raw.get("createdDate")),
            product=self._product_context(raw),
            metadata={
                "source": "wildberries.feedbacks",
                "status": raw.get("state"),
                "is_answered": raw.get("isAnswered"),
                **({"review_video_url": video_url} if video_url is not None else {}),
                **({"review_deficiencies": list(deficiencies)} if deficiencies else {}),
            },
        )

    def normalize_question(self, raw: dict[str, object]) -> NormalizedMessage:
        return NormalizedMessage(
            external_id=self._required_string(
                raw.get("id"),
                field_name="question ID",
            ),
            message_type=MessageType.QUESTION,
            rating=None,
            customer_display_name=self._optional_string(raw.get("userName")),
            customer_text=self._required_string(
                raw.get("text"),
                field_name="question text",
            ),
            customer_photos=self._photos(raw),
            marketplace_created_at=self._datetime(raw.get("createdDate")),
            product=self._product_context(raw),
            metadata={
                "source": "wildberries.questions",
                "status": raw.get("state"),
                "is_answered": raw.get("isAnswered"),
            },
        )

    def is_already_answered(self, payload: object) -> bool:
        if not isinstance(payload, dict):
            raise ValueError("Wildberries answer state is malformed")
        mapping = cast(dict[str, object], payload)
        answer = mapping.get("answer")
        if isinstance(answer, dict):
            answer_mapping = cast(dict[str, object], answer)
            return self._required_string(answer_mapping.get("text"), field_name="answer text") != ""
        if answer is not None:
            raise ValueError("Wildberries answer state is malformed")
        is_answered = mapping.get("isAnswered")
        if is_answered is not None and not isinstance(is_answered, bool):
            raise ValueError("Wildberries answer state is malformed")
        return is_answered is True

    async def _read(
        self,
        path: str,
        credential: str,
        *,
        params: dict[str, str | int],
    ) -> AdapterResult[object]:
        async def request() -> httpx.Response:
            return await request_read_with_retry(
                self._client, "GET", path, headers=self._headers(credential), params=params,
                policy=ReadRetryPolicy(max_attempts=1) if self._read_limiter else self._read_retry_policy,
                rate_limit_delay=self._rate_limit_delay,
            )

        try:
            response = await self._read_limiter.read(credential, path, request) if self._read_limiter else await request()
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Wildberries request timed out",
            )
        except httpx.RequestError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Wildberries network request failed",
            )
        if not response.is_success:
            return self._map_error_response(response)
        try:
            payload: object = response.json()
        except ValueError:
            return self._malformed_payload("Wildberries returned invalid JSON")
        return AdapterResult(ok=True, data=payload)

    def _map_error_response(self, response: httpx.Response) -> AdapterResult[object]:
        retry_after = self._rate_limit_delay(response) if response.status_code == 429 else None
        if response.status_code == 401:
            code = "invalid_credentials"
            message = "Wildberries API key is invalid"
        elif response.status_code == 403:
            code = "insufficient_scope"
            message = "Wildberries API key has insufficient permissions"
        elif response.status_code == 404:
            code = "marketplace_not_found"
            message = "Wildberries resource was not found"
        elif response.status_code == 429:
            code = "rate_limited"
            message = "Wildberries rate limit was exceeded"
        elif 500 <= response.status_code <= 599:
            code = "marketplace_unavailable"
            message = "Wildberries is temporarily unavailable"
        else:
            code = "marketplace_validation_error"
            message = "Wildberries rejected the request"
        return AdapterResult(
            False,
            error_code=code,
            error_message_safe=message,
            retry_after_seconds=retry_after,
        )

    @staticmethod
    def _rate_limit_delay(response: httpx.Response) -> int | None:
        now = datetime.now(UTC)
        delays = [
            delay
            for name in ("Retry-After", "X-Ratelimit-Retry")
            if (delay := parse_retry_after(response.headers.get(name), now=now, maximum_seconds=86_400)) is not None
        ]
        return max(delays) if delays else None

    @staticmethod
    def _malformed_payload(message: str) -> AdapterResult[object]:
        return AdapterResult(False, error_code="malformed_payload", error_message_safe=message)

    @staticmethod
    def _headers(credential: str) -> dict[str, str]:
        return {"Authorization": credential}

    @staticmethod
    def _parse_cursor(cursor: str | None, *, max_offset: int) -> int | None:
        if cursor is None:
            return 0
        if not cursor or len(cursor) > len(str(max_offset)) or not cursor.isascii() or not cursor.isdecimal():
            return None
        offset = int(cursor)
        return offset if offset <= max_offset and str(offset) == cursor else None

    @staticmethod
    def _token_scope(credential: str) -> int | None:
        if not credential or credential != credential.strip() or len(credential) > 16_384:
            return None
        segments = credential.split(".")
        if len(segments) != 3 or not segments[1]:
            return None
        encoded_payload = segments[1]
        padding = "=" * (-len(encoded_payload) % 4)
        try:
            payload_bytes = base64.b64decode(
                encoded_payload + padding,
                altchars=b"-_",
                validate=True,
            )
            payload: object = json.loads(payload_bytes, object_pairs_hook=_unique_object)
        except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValueError):
            return None
        if not isinstance(payload, dict):
            return None
        mapping = cast(dict[str, object], payload)
        scope = mapping.get("s")
        if isinstance(scope, bool) or not isinstance(scope, int) or scope < 0:
            return None
        return scope

    def _stream_contract(self, stream: MarketplaceStream) -> tuple[str, str, _Normalizer] | None:
        if stream is MarketplaceStream.REVIEWS:
            return "/api/v1/feedbacks", "feedbacks", self.normalize_review
        if stream is MarketplaceStream.QUESTIONS:
            return "/api/v1/questions", "questions", self.normalize_question
        return None

    @staticmethod
    def _detail_path(message_type: MessageType) -> str | None:
        if message_type is MessageType.REVIEW:
            return "/api/v1/feedback"
        if message_type is MessageType.QUESTION:
            return "/api/v1/question"
        return None

    @staticmethod
    def _page_records(
        payload: object | None,
        collection_key: str,
    ) -> list[dict[str, object]] | None:
        data = WildberriesAdapter._required_data_object(payload)
        if data is None:
            return None
        items_value = data.get(collection_key)
        if not isinstance(items_value, list):
            return None
        items = cast(list[object], items_value)
        if not all(isinstance(item, dict) for item in items):
            return None
        return [cast(dict[str, object], item) for item in items]

    @staticmethod
    def _required_data_object(payload: object | None) -> dict[str, object] | None:
        if not isinstance(payload, dict):
            return None
        data = cast(dict[str, object], payload).get("data")
        return cast(dict[str, object], data) if isinstance(data, dict) else None

    @staticmethod
    def _successful_question_write(payload: object) -> bool:
        if not isinstance(payload, dict):
            return False
        result = cast(dict[str, object], payload)
        return (
            "data" in result
            and result["data"] is None
            and result.get("error") is False
            and result.get("errorText") == ""
            and "additionalErrors" in result
            and result["additionalErrors"] is None
        )

    def _product_context(self, raw: dict[str, object]) -> NormalizedProduct:
        product_details_value = raw.get("productDetails")
        if not isinstance(product_details_value, dict):
            raise ValueError("Wildberries product details are malformed")
        product_details = cast(dict[str, object], product_details_value)
        nm_id = product_details.get("nmId")
        imt_id = product_details.get("imtId")
        supplier_article = product_details.get("supplierArticle")
        return NormalizedProduct(
            external_id=self._required_identifier(nm_id, field_name="product ID"),
            sku=self._optional_string(supplier_article),
            name=self._optional_string(product_details.get("productName")),
            brand=self._optional_string(product_details.get("brandName")),
            category=None,
            image_url=None,
            product_url=None,
            metadata={
                key: value
                for key, value in {
                    "nm_id": nm_id,
                    "imt_id": imt_id,
                    "supplier_article": supplier_article,
                }.items()
                if value is not None
            },
        )

    @staticmethod
    def _photos(raw: dict[str, object]) -> tuple[str, ...]:
        value = raw.get("photoLinks")
        if value is None:
            return ()
        if not isinstance(value, list):
            raise ValueError("Wildberries photo list is malformed")
        photos = cast(list[object], value)
        if len(photos) > 20:
            raise ValueError("Wildberries photo list is malformed")
        full_size_urls: list[str] = []
        for photo in photos:
            if not isinstance(photo, dict):
                raise ValueError("Wildberries photo list is malformed")
            photo_mapping = cast(dict[str, object], photo)
            full_size = WildberriesAdapter._optional_string(photo_mapping.get("fullSize"))
            if full_size is None:
                raise ValueError("Wildberries photo list is malformed")
            full_size_urls.append(full_size)
        return tuple(full_size_urls)

    @staticmethod
    def _video_url(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, dict):
            raise ValueError("Wildberries video is malformed")
        link = cast(dict[str, object], value).get("link")
        if not isinstance(link, str) or not link or len(link) > 512 or any(ord(char) < 32 or ord(char) == 127 for char in link):
            raise ValueError("Wildberries video link is malformed")
        parsed = urlsplit(link)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError("Wildberries video link is malformed")
        return link

    @staticmethod
    def _deficiencies(value: object) -> tuple[str, ...]:
        if value is None:
            return ()
        if not isinstance(value, list):
            raise ValueError("Wildberries selected deficiencies are malformed")
        items = cast(list[object], value)
        if len(items) > 20 or any(
            not isinstance(item, str) or not item or item != item.strip() or len(item) > 100 or any(ord(char) < 32 or ord(char) == 127 for char in item)
            for item in items
        ):
            raise ValueError("Wildberries selected deficiencies are malformed")
        if sum(len(cast(str, item)) for item in items) > 512:
            raise ValueError("Wildberries selected deficiencies are malformed")
        return tuple(cast(str, item) for item in items)

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("Wildberries timestamp has no timezone")
            return value
        if not isinstance(value, str) or not value:
            raise ValueError("Wildberries timestamp is missing")
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Wildberries timestamp is malformed") from exc
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Wildberries timestamp has no timezone")
        return parsed

    @staticmethod
    def _required_string(value: object, *, field_name: str) -> str:
        text = WildberriesAdapter._optional_string(value)
        if text is None or len(text) > 12_000 or "\x00" in text:
            raise ValueError(f"Wildberries {field_name} is missing")
        return text

    @staticmethod
    def _required_identifier(value: object, *, field_name: str) -> str:
        if isinstance(value, bool) or not isinstance(value, str | int):
            raise ValueError(f"Wildberries {field_name} is missing")
        text = str(value).strip()
        if not text or len(text) > 255 or "\x00" in text:
            raise ValueError(f"Wildberries {field_name} is missing")
        return text

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return None
        text = str(value).strip()
        return text if text and len(text) <= 12_000 and "\x00" not in text else None

    @staticmethod
    def _rating(value: object) -> int | None:
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            raise ValueError("Wildberries rating is malformed")
        if isinstance(value, int):
            rating = value
        elif isinstance(value, str) and value.isascii() and value.isdecimal():
            rating = int(value)
        else:
            raise ValueError("Wildberries rating is malformed")
        if not 1 <= rating <= 5:
            raise ValueError("Wildberries rating is malformed")
        return rating


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result
