from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Never, cast
from urllib.parse import urlsplit

import httpx

from app.adapters.avito_auth import AvitoCredentialResolver
from app.adapters.avito_http import AvitoApiClient
from app.adapters.base import (
    AdapterResult,
    CredentialValidation,
    ExistingReplyResult,
    MarketplacePage,
    NormalizedMessage,
    NormalizedProduct,
    ProviderMessageContext,
    ProviderMessageResolution,
    ProviderWriteReceipt,
)
from app.adapters.capabilities import MarketplaceStream
from app.adapters.http import ReadRetryPolicy
from app.models.enums import Marketplace, MessageStatus, MessageType

_PAGE_SIZE = 50
_MAX_OFFSET = 5_000
_MAX_UNIX_SECONDS = 253_402_300_799
_MAX_INBOUND_ANSWER_LENGTH = 100_000
_STAGES = frozenset({"done", "fell_through", "not_agree", "not_communicate"})
_ANSWER_STATES = {
    "published": MessageStatus.ANSWERED,
    "moderation": MessageStatus.WAITING_REVIEW,
    "rejected": MessageStatus.NEEDS_MANUAL_CHECK,
}


@dataclass(frozen=True, slots=True)
class AvitoAnswerRecord:
    answer_id: int
    text: str
    status: str
    created_unix: int


@dataclass(frozen=True, slots=True)
class AvitoReviewRecord:
    review_id: int
    score: int
    created_unix: int
    stage: str
    text: str
    can_answer: bool
    used_in_score: bool
    answer: AvitoAnswerRecord | None
    sender_name: str | None
    product: NormalizedProduct | None
    photos: tuple[str, ...]


class AvitoReviewAdapter:
    marketplace = Marketplace.AVITO

    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        credential_resolver: AvitoCredentialResolver | None = None,
        read_retry_policy: ReadRetryPolicy = ReadRetryPolicy(),
    ) -> None:
        self._api = AvitoApiClient(client, credential_resolver or AvitoCredentialResolver(client), read_retry_policy)

    async def validate_credentials(self, credential: str, seller_id: str | None) -> AdapterResult[CredentialValidation]:
        page = await self._fetch_reviews(credential, None)
        if not page.ok:
            return cast(AdapterResult[CredentialValidation], AvitoApiClient.copy_failure(page))
        return AdapterResult(
            ok=True,
            data=CredentialValidation(scopes=("reviews:read", "reviews:write"), account_reference=seller_id),
        )

    async def fetch_page(
        self,
        credential: str,
        seller_id: str | None,
        stream: MarketplaceStream,
        cursor: str | None,
    ) -> AdapterResult[MarketplacePage[NormalizedMessage]]:
        del seller_id
        if stream is not MarketplaceStream.REVIEWS:
            return self._unsupported()
        page = await self._fetch_reviews(credential, cursor)
        if not page.ok or page.data is None:
            return cast(AdapterResult[MarketplacePage[NormalizedMessage]], AvitoApiClient.copy_failure(page))
        items: list[NormalizedMessage] = []
        resolutions: list[ProviderMessageResolution] = []
        for record in page.data.items:
            if record.can_answer and record.answer is None:
                items.append(
                    NormalizedMessage(
                        external_id=str(record.review_id),
                        message_type=MessageType.REVIEW,
                        rating=record.score,
                        customer_display_name=record.sender_name,
                        customer_text=record.text,
                        customer_photos=record.photos,
                        marketplace_created_at=datetime.fromtimestamp(record.created_unix, tz=UTC),
                        product=record.product,
                        metadata={"source": "avito.reviews", "stage": record.stage, "used_in_score": record.used_in_score},
                    )
                )
            else:
                status = _ANSWER_STATES[record.answer.status] if record.answer is not None else MessageStatus.BLOCKED_BY_MARKETPLACE
                resolutions.append(
                    ProviderMessageResolution(
                        external_id=str(record.review_id),
                        message_type=MessageType.REVIEW,
                        status=status,
                    )
                )
        return AdapterResult(
            ok=True,
            data=MarketplacePage(items=tuple(items), next_cursor=page.data.next_cursor, resolutions=tuple(resolutions)),
        )

    async def _fetch_reviews(self, credential: str, cursor: str | None) -> AdapterResult[MarketplacePage[AvitoReviewRecord]]:
        offset = self._offset(cursor)
        if offset is None:
            return self._invalid("Avito review offset is invalid")
        result = await self._api.read(credential, "/ratings/v1/reviews", params={"offset": offset, "limit": _PAGE_SIZE})
        if not result.ok:
            return cast(AdapterResult[MarketplacePage[AvitoReviewRecord]], AvitoApiClient.copy_failure(result))
        payload = self._object(result.data)
        if payload is None or not isinstance(payload.get("reviews"), list):
            return self._malformed()
        raw_reviews = cast(list[object], payload["reviews"])
        total = payload.get("total")
        if type(total) is not int or total < 0 or len(raw_reviews) > _PAGE_SIZE or offset + len(raw_reviews) > total:
            return self._malformed()
        if offset + len(raw_reviews) < total and len(raw_reviews) != _PAGE_SIZE:
            return self._malformed()
        next_offset = offset + len(raw_reviews)
        if next_offset < total and next_offset > _MAX_OFFSET:
            return self._malformed()
        try:
            records = tuple(self._parse_review(raw) for raw in raw_reviews)
        except (TypeError, ValueError, OverflowError):
            return self._malformed()
        return AdapterResult(
            ok=True,
            data=MarketplacePage(items=records, next_cursor=str(next_offset) if next_offset < total else None),
        )

    async def find_existing_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
    ) -> AdapterResult[ExistingReplyResult]:
        del seller_id
        if context.message_type is not MessageType.REVIEW:
            return self._unsupported()
        review_id = self._context_review_id(context)
        if review_id is None:
            return self._invalid("Avito review reply context is invalid")
        found = await self._find_review(credential, review_id)
        if not found.ok or found.data is None:
            return cast(AdapterResult[ExistingReplyResult], AvitoApiClient.copy_failure(found))
        if found.data.answer is not None:
            return AdapterResult(
                ok=True,
                data=ExistingReplyResult(
                    exists=True,
                    provider_reply_id=str(found.data.answer.answer_id),
                    provider_state=found.data.answer.status,
                ),
            )
        if not found.data.can_answer:
            return self._invalid("Avito review is no longer answerable")
        return AdapterResult(ok=True, data=ExistingReplyResult(exists=False))

    async def send_reply(
        self,
        credential: str,
        seller_id: str | None,
        context: ProviderMessageContext,
        text: str,
    ) -> AdapterResult[ProviderWriteReceipt]:
        del seller_id
        if context.message_type is not MessageType.REVIEW:
            return self._unsupported()
        review_id = self._context_review_id(context)
        if review_id is None or not text or text != text.strip() or len(text) > 3_000 or "\x00" in text:
            return self._invalid("Avito review reply input is invalid")
        found = await self._find_review(credential, review_id)
        if not found.ok or found.data is None:
            return cast(AdapterResult[ProviderWriteReceipt], AvitoApiClient.copy_failure(found))
        if found.data.answer is not None or not found.data.can_answer:
            return self._invalid("Avito review is no longer answerable")
        result = await self._api.write(
            credential,
            "/ratings/v1/answers",
            body={"reviewId": review_id, "message": text},
        )
        if not result.ok:
            return cast(AdapterResult[ProviderWriteReceipt], AvitoApiClient.copy_failure(result))
        payload = self._object(result.data)
        answer_id = self._positive_int(payload.get("id")) if payload is not None else None
        created = self._unix_seconds(payload.get("createdAt")) if payload is not None else None
        if answer_id is None or created is None:
            return self._malformed()
        return AdapterResult(
            ok=True,
            data=ProviderWriteReceipt(provider_reply_id=str(answer_id), provider_state="accepted_unverified"),
        )

    async def _find_review(self, credential: str, review_id: int) -> AdapterResult[AvitoReviewRecord]:
        cursor: str | None = None
        for _ in range(_MAX_OFFSET // _PAGE_SIZE + 1):
            page = await self._fetch_reviews(credential, cursor)
            if not page.ok or page.data is None:
                return cast(AdapterResult[AvitoReviewRecord], AvitoApiClient.copy_failure(page))
            for record in page.data.items:
                if record.review_id == review_id:
                    return AdapterResult(ok=True, data=record)
            if page.data.next_cursor is None:
                return AdapterResult(
                    False,
                    error_code="marketplace_not_found",
                    error_message_safe="Avito review was not found during reply preflight",
                )
            cursor = page.data.next_cursor
        return self._malformed()

    @classmethod
    def _context_review_id(cls, context: ProviderMessageContext) -> int | None:
        identifier = context.external_id
        if context.message_type is not MessageType.REVIEW or len(identifier) > 20 or not identifier.isascii() or not identifier.isdecimal():
            return None
        parsed = int(identifier)
        return parsed if parsed > 0 and str(parsed) == identifier else None

    @classmethod
    def _parse_review(cls, raw: object) -> AvitoReviewRecord:
        review = cls._object(raw)
        if review is None:
            raise ValueError("invalid review")
        review_id = cls._positive_int(review.get("id"))
        score = cls._positive_int(review.get("score"))
        created = cls._unix_seconds(review.get("createdAt"))
        stage = review.get("stage")
        text = review.get("text")
        can_answer = review.get("canAnswer")
        used_in_score = review.get("usedInScore")
        if (
            review_id is None
            or score is None
            or score > 5
            or created is None
            or stage not in _STAGES
            or not isinstance(text, str)
            or len(text) > 100_000
            or "\x00" in text
            or type(can_answer) is not bool
            or type(used_in_score) is not bool
        ):
            raise ValueError("invalid review fields")
        answer = cls._parse_answer(review.get("answer"))
        sender = cls._object(review.get("sender"))
        sender_name = cls._bounded_string(sender.get("name"), 255) if sender is not None else None
        if review.get("sender") is not None and (sender is None or sender_name is None):
            raise ValueError("invalid review sender")
        product = cls._parse_product(review.get("item"))
        photos = cls._parse_images(review.get("images", []))
        return AvitoReviewRecord(
            review_id=review_id,
            score=score,
            created_unix=created,
            stage=cast(str, stage),
            text=text,
            can_answer=can_answer,
            used_in_score=used_in_score,
            answer=answer,
            sender_name=sender_name,
            product=product,
            photos=photos,
        )

    @classmethod
    def _parse_answer(cls, value: object) -> AvitoAnswerRecord | None:
        if value is None:
            return None
        answer = cls._object(value)
        if answer is None:
            raise ValueError("invalid answer")
        answer_id = cls._positive_int(answer.get("id"))
        created = cls._unix_seconds(answer.get("createdAt"))
        text = answer.get("text")
        status = answer.get("status")
        if (
            answer_id is None
            or created is None
            or not isinstance(text, str)
            or len(text) > _MAX_INBOUND_ANSWER_LENGTH
            or "\x00" in text
            or status not in _ANSWER_STATES
        ):
            raise ValueError("invalid answer fields")
        return AvitoAnswerRecord(answer_id=answer_id, text=text, status=cast(str, status), created_unix=created)

    @classmethod
    def _parse_product(cls, value: object) -> NormalizedProduct | None:
        if value is None:
            return None
        item = cls._object(value)
        if item is None:
            raise ValueError("invalid item")
        item_id = item.get("id")
        if item_id is None:
            return None
        parsed_id = cls._positive_int(item_id)
        if parsed_id is None:
            raise ValueError("invalid item ID")
        title = cls._bounded_string(item.get("title"), 500) if item.get("title") is not None else None
        if item.get("title") is not None and title is None:
            raise ValueError("invalid item title")
        return NormalizedProduct(
            external_id=str(parsed_id),
            sku=None,
            name=title,
            brand=None,
            category=None,
            image_url=None,
            product_url=None,
            metadata={"item_id": parsed_id},
        )

    @classmethod
    def _parse_images(cls, value: object) -> tuple[str, ...]:
        if not isinstance(value, list):
            raise ValueError("invalid images")
        images = cast(list[object], value)
        if len(images) > 20:
            raise ValueError("too many images")
        photos: list[str] = []
        for raw in images:
            image = cls._object(raw)
            if image is None or cls._positive_int(image.get("number")) is None or not isinstance(image.get("sizes"), list):
                raise ValueError("invalid image")
            sizes = cast(list[object], image["sizes"])
            if not sizes:
                raise ValueError("missing image size")
            chosen: str | None = None
            for raw_size in sizes:
                size = cls._object(raw_size)
                if size is None or cls._bounded_string(size.get("size"), 32) is None:
                    raise ValueError("invalid image size")
                url = cls._https_url(size.get("url"))
                if url is None:
                    raise ValueError("invalid image URL")
                if chosen is None:
                    chosen = url
            if chosen is None:
                raise ValueError("missing image URL")
            photos.append(chosen)
        return tuple(photos)

    @staticmethod
    def _https_url(value: object) -> str | None:
        if not isinstance(value, str) or not value or len(value) > 2_048 or value != value.strip():
            return None
        try:
            parsed = urlsplit(value)
            port = parsed.port
        except ValueError:
            return None
        if parsed.scheme != "https" or parsed.hostname is None or parsed.username or parsed.password or port not in {None, 443}:
            return None
        return value

    @staticmethod
    def _object(value: object | None) -> dict[str, object] | None:
        return cast(dict[str, object], value) if isinstance(value, dict) else None

    @staticmethod
    def _positive_int(value: object) -> int | None:
        return value if type(value) is int and value > 0 else None

    @staticmethod
    def _unix_seconds(value: object) -> int | None:
        return value if type(value) is int and 0 <= value <= _MAX_UNIX_SECONDS else None

    @staticmethod
    def _bounded_string(value: object, maximum: int) -> str | None:
        if not isinstance(value, str) or not value or value != value.strip() or len(value) > maximum or "\x00" in value:
            return None
        return value

    @staticmethod
    def _offset(cursor: str | None) -> int | None:
        if cursor is None:
            return 0
        if len(cursor) > 4 or not cursor.isascii() or not cursor.isdecimal():
            return None
        offset = int(cursor)
        return offset if offset <= _MAX_OFFSET and offset % _PAGE_SIZE == 0 and str(offset) == cursor else None

    @staticmethod
    def _malformed() -> AdapterResult[Never]:
        return AdapterResult(False, error_code="malformed_payload", error_message_safe="Avito returned an invalid review page")

    @staticmethod
    def _invalid(message: str) -> AdapterResult[Never]:
        return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe=message)

    @staticmethod
    def _unsupported() -> AdapterResult[Never]:
        return AdapterResult(False, error_code="unsupported_capability", error_message_safe="Avito questions are not supported")
