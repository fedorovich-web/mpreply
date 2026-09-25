from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import cast

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.models.enums import MessageStatus, MessageType

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
_PREFLIGHT_PAGE_LIMIT = 100


class _OzonClient:
    base_url = "https://api-seller.ozon.ru"

    def __init__(
        self,
        *,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None,
    ) -> None:
        self._timeout = timeout_seconds
        self._transport = transport

    async def validate_credentials(self, api_key: str, client_id: str | None) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        result = await self._request(
            api_key=api_key,
            client_id=normalized_client_id,
            path="/v1/roles",
            json={},
        )
        if not result.ok:
            return result
        return self._normalize_roles(result.data)

    async def fetch_reviews(
        self,
        api_key: str,
        client_id: str | None,
        cursor: str | None,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        body: dict[str, object] = {"limit": 100, "sort_dir": "ASC"}
        if cursor:
            body["last_id"] = cursor
        result = await self._request(
            api_key=api_key,
            client_id=normalized_client_id,
            path="/v2/review/list",
            json=body,
        )
        return _validated_page_result(result, items_key="reviews", requested_cursor=cursor)

    async def fetch_questions(
        self,
        api_key: str,
        client_id: str | None,
        cursor: str | None,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        result = await self._request(
            api_key=api_key,
            client_id=normalized_client_id,
            path="/v1/question/list",
            json={
                "filter": {"status": "ALL"},
                "limit": 100,
                "last_id": cursor or "",
                "sort_dir": "ASC",
            },
        )
        return _validated_page_result(result, items_key="questions", requested_cursor=cursor)

    async def has_existing_review_reply(
        self,
        api_key: str,
        client_id: str | None,
        review_id: str,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        if _required_string(review_id) is None:
            return _invalid_external_id_result()
        for page in range(_PREFLIGHT_PAGE_LIMIT):
            offset = page * 100
            result = await self._request(
                api_key=api_key,
                client_id=normalized_client_id,
                path="/v1/review/comment/list",
                json={"review_id": review_id, "limit": 100, "offset": offset, "sort_dir": "ASC"},
            )
            if not result.ok:
                return result
            comments = _strict_mapping_items(result.data, key="comments")
            if comments is None:
                return _malformed_preflight_result()
            if any(
                type(comment.get("is_owner")) is not bool
                or type(comment.get("is_published")) is not bool
                or type(comment.get("is_rejected")) is not bool
                for comment in comments
            ):
                return _malformed_preflight_result()
            if any(comment.get("is_owner") is True and comment.get("is_published") is True for comment in comments):
                return AdapterResult(ok=True, data={"answered": True})
            if len(comments) < 100:
                return AdapterResult(ok=True, data={"answered": False})
        return _preflight_page_limit_result()

    async def has_existing_question_reply(
        self,
        api_key: str,
        client_id: str | None,
        question_id: str,
        sku: int,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        if _required_string(question_id) is None:
            return _invalid_external_id_result()
        cursor = ""
        seen_cursors: set[str] = set()
        for _ in range(_PREFLIGHT_PAGE_LIMIT):
            result = await self._request(
                api_key=api_key,
                client_id=normalized_client_id,
                path="/v1/question/answer/list",
                json={"question_id": question_id, "sku": sku, "last_id": cursor},
            )
            if not result.ok:
                return result
            page = _mapping(result.data)
            if page is None:
                return _malformed_preflight_result()
            answers = _strict_mapping_items(page, key="answers")
            next_cursor = page.get("last_id")
            if answers is None or not isinstance(next_cursor, str):
                return _malformed_preflight_result()
            if answers:
                return AdapterResult(ok=True, data={"answered": True})
            if not next_cursor.strip():
                return AdapterResult(ok=True, data={"answered": False})
            if next_cursor == cursor or next_cursor in seen_cursors:
                return _preflight_cursor_cycle_result()
            seen_cursors.add(next_cursor)
            cursor = next_cursor
        return _preflight_page_limit_result()

    async def send_review_reply(
        self,
        api_key: str,
        client_id: str | None,
        review_id: str,
        reply_text: str,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        if _required_string(review_id) is None:
            return _invalid_external_id_result()
        result = await self._request(
            api_key=api_key,
            client_id=normalized_client_id,
            path="/v1/review/comment/create",
            json={"review_id": review_id, "text": reply_text, "mark_review_as_processed": True},
        )
        return _provider_reply_result(result, key="comment_id")

    async def send_question_reply(
        self,
        api_key: str,
        client_id: str | None,
        question_id: str,
        sku: int,
        reply_text: str,
    ) -> AdapterResult:
        normalized_client_id = _normalized_client_id(client_id)
        if not normalized_client_id:
            return _invalid_client_id_result()
        if _required_string(question_id) is None:
            return _invalid_external_id_result()
        if not 2 <= len(reply_text) <= 3000:
            return _invalid_reply_text_result()
        result = await self._request(
            api_key=api_key,
            client_id=normalized_client_id,
            path="/v1/question/answer/create",
            json={"question_id": question_id, "sku": sku, "text": reply_text},
        )
        return _provider_reply_result(result, key="answer_id")

    @staticmethod
    def _headers(api_key: str, client_id: str) -> dict[str, str]:
        return {
            "Client-Id": client_id,
            "Api-Key": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        *,
        api_key: str,
        client_id: str,
        path: str,
        json: dict[str, object],
    ) -> AdapterResult:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self._timeout,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    path,
                    headers=self._headers(api_key, client_id),
                    json=json,
                )
        except httpx.TimeoutException:
            return AdapterResult(
                False,
                error_code="network_timeout",
                error_message_safe="Ozon Seller API request timed out",
            )
        except httpx.HTTPError:
            return AdapterResult(
                False,
                error_code="network_error",
                error_message_safe="Ozon Seller API network error",
            )
        payload = self._safe_json(response)
        if response.is_success:
            return AdapterResult(ok=True, data=payload)
        return self._map_response_error(response, payload)

    @staticmethod
    def _safe_json(response: httpx.Response) -> object:
        try:
            payload: object = response.json()
            return payload
        except ValueError:
            return {"text": response.text[:500]}

    @staticmethod
    def _retry_after_seconds(value: str | None) -> int | None:
        if not value:
            return None
        try:
            parsed = int(value)
        except ValueError:
            return None
        return min(max(parsed, 0), 3600)

    def _map_response_error(self, response: httpx.Response, payload: object) -> AdapterResult:
        result = self.map_error(response.status_code)
        retry_after = self._retry_after_seconds(response.headers.get("Retry-After"))
        if retry_after is None:
            return result
        return AdapterResult(
            ok=result.ok,
            data=result.data,
            error_code=result.error_code,
            error_message_safe=result.error_message_safe,
            next_cursor=result.next_cursor,
            retry_after_seconds=retry_after,
        )

    @staticmethod
    def map_error(status_code: int) -> AdapterResult:
        if status_code == 401:
            return AdapterResult(False, error_code="invalid_credentials", error_message_safe="Ozon API key is invalid")
        if status_code == 403:
            return AdapterResult(False, error_code="insufficient_scope", error_message_safe="Ozon API key has insufficient permissions")
        if status_code == 429:
            return AdapterResult(False, error_code="rate_limited", error_message_safe="Ozon Seller API rate limit exceeded")
        if 500 <= status_code <= 599:
            return AdapterResult(
                False,
                error_code="marketplace_unavailable",
                error_message_safe="Ozon Seller API is temporarily unavailable",
            )
        return AdapterResult(False, error_code="marketplace_error", error_message_safe="Ozon Seller API rejected the request")

    @staticmethod
    def _normalize_roles(payload: object) -> AdapterResult:
        if not isinstance(payload, dict):
            return _malformed_roles_result()
        data = cast(Mapping[str, object], payload)
        expires_at = data.get("expires_at")
        roles_value = data.get("roles")
        if (
            not isinstance(expires_at, str)
            or not _valid_timestamp(expires_at)
            or not isinstance(roles_value, list)
        ):
            return _malformed_roles_result()
        methods: set[str] = set()
        for role in cast(list[object], roles_value):
            if not isinstance(role, dict):
                return _malformed_roles_result()
            role_data = cast(Mapping[str, object], role)
            role_methods = role_data.get("methods")
            if not isinstance(role_methods, list):
                return _malformed_roles_result()
            typed_methods: list[str] = []
            for method in cast(list[object], role_methods):
                if not isinstance(method, str):
                    return _malformed_roles_result()
                typed_methods.append(method)
            methods.update(typed_methods)
        scopes: list[str] = []
        if REVIEW_METHODS.issubset(methods):
            scopes.extend(["fetch_reviews", "send_review_reply"])
        if QUESTION_METHODS.issubset(methods):
            scopes.extend(["fetch_questions", "send_question_reply"])
        if not scopes:
            return AdapterResult(
                False,
                error_code="insufficient_scope",
                error_message_safe="Ozon API key does not support a complete MPReply stream",
            )
        return AdapterResult(ok=True, data={"scopes": scopes, "expires_at": expires_at})


class OzonAdapter(MarketplaceAdapter):
    marketplace = "ozon"

    def __init__(
        self,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client = _OzonClient(timeout_seconds=timeout_seconds, transport=transport)

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        return await self._client.validate_credentials(credential, seller_id)

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return await self._client.fetch_reviews(credential, seller_id, cursor)

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return await self._client.fetch_questions(credential, seller_id, cursor)

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return _extract_valid_records(payload, items_key="reviews", is_question=False)

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return _extract_valid_records(payload, items_key="questions", is_question=True)

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        record = _valid_record(raw, is_question=False)
        if record is None:
            return {}
        return _normalized_message(record, is_question=False)

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        record = _valid_record(raw, is_question=True)
        if record is None:
            return {}
        return _normalized_message(record, is_question=True)

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        del context
        return await self._client.send_review_reply(credential, seller_id, external_id, reply_text)

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        sku = _context_sku(context)
        if sku is None:
            return _invalid_provider_context_result()
        return await self._client.send_question_reply(credential, seller_id, external_id, sku, reply_text)

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        if message_type == MessageType.REVIEW.value:
            return await self._client.has_existing_review_reply(credential, seller_id, external_id)
        if message_type == MessageType.QUESTION.value:
            sku = _context_sku(context)
            if sku is None:
                return _invalid_provider_context_result()
            return await self._client.has_existing_question_reply(credential, seller_id, external_id, sku)
        return AdapterResult(
            False,
            error_code="unsupported_message_type",
            error_message_safe="Ozon message type is not supported",
        )

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        return _OzonClient.map_error(status_code)


def _malformed_roles_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="malformed_payload",
        error_message_safe="Ozon Seller API roles response is malformed",
    )


def _invalid_client_id_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="invalid_account_identifier",
        error_message_safe="Ozon Client ID is required",
    )


def _normalized_client_id(value: str | None) -> str:
    return value.strip() if value else ""


def _malformed_page_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="malformed_payload",
        error_message_safe="Ozon Seller API list response is malformed",
    )


def _malformed_preflight_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="malformed_payload",
        error_message_safe="Ozon Seller API preflight response is malformed",
    )


def _preflight_cursor_cycle_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="preflight_cursor_cycle",
        error_message_safe="Ozon Seller API preflight cursor repeated",
    )


def _preflight_page_limit_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="preflight_page_limit_exceeded",
        error_message_safe="Ozon Seller API preflight exceeded the safe page limit",
    )


def _invalid_provider_context_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="invalid_provider_context",
        error_message_safe="Ozon SKU context is required",
    )


def _invalid_external_id_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="invalid_external_id",
        error_message_safe="Ozon message ID is required",
    )


def _invalid_reply_text_result() -> AdapterResult:
    return AdapterResult(
        False,
        error_code="invalid_reply_text",
        error_message_safe="Ozon question answer text must be between 2 and 3000 characters",
    )


def _strict_mapping_items(value: object, *, key: str) -> list[Mapping[str, object]] | None:
    mapping = _mapping(value)
    if mapping is None:
        return None
    items = mapping.get(key)
    if not isinstance(items, list):
        return None
    typed_items = cast(list[object], items)
    mapped_items: list[Mapping[str, object]] = []
    for item in typed_items:
        item_mapping = _mapping(item)
        if item_mapping is None:
            return None
        mapped_items.append(item_mapping)
    return mapped_items


def _provider_reply_result(result: AdapterResult, *, key: str) -> AdapterResult:
    if not result.ok:
        return result
    payload = _mapping(result.data)
    if payload is None:
        return _malformed_page_result()
    reply_id = _required_string(payload.get(key))
    if reply_id is None:
        return _malformed_page_result()
    return AdapterResult(ok=True, data={"marketplace_reply_id": reply_id})


def _context_sku(context: ProviderMessageContext | None) -> int | None:
    if context is None:
        return None
    return _positive_sku(context.get("ozon_sku"))


def _validated_page_result(
    result: AdapterResult,
    *,
    items_key: str,
    requested_cursor: str | None,
) -> AdapterResult:
    if not result.ok:
        return result
    page = _mapping(result.data)
    if page is None:
        return _malformed_page_result()
    items = page.get(items_key)
    has_next = page.get("has_next")
    last_id = page.get("last_id")
    if not isinstance(items, list) or type(has_next) is not bool or not isinstance(last_id, str):
        return _malformed_page_result()
    if any(_mapping(item) is None for item in cast(list[object], items)):
        return _malformed_page_result()
    if not has_next:
        return AdapterResult(ok=True, data=result.data)
    if not last_id.strip() or last_id == requested_cursor:
        return _malformed_page_result()
    return AdapterResult(ok=True, data=result.data, next_cursor=last_id)


def _extract_valid_records(
    payload: object | None,
    *,
    items_key: str,
    is_question: bool,
) -> list[dict[str, object]]:
    page = _mapping(payload)
    if page is None:
        return []
    items = page.get(items_key)
    if not isinstance(items, list):
        return []
    records: list[dict[str, object]] = []
    for item in cast(list[object], items):
        record = _valid_record(item, is_question=is_question)
        if record is not None:
            records.append(record)
    return records


def _valid_record(value: object, *, is_question: bool) -> dict[str, object] | None:
    record = _mapping(value)
    if record is None:
        return None
    identifier = _required_string(record.get("id"))
    text = _required_string(record.get("text"))
    published_at = _parse_timestamp(record.get("published_at"))
    sku = _record_sku(record.get("sku"), is_question=is_question)
    status = record.get("status")
    if identifier is None or text is None or published_at is None or sku is None or not isinstance(status, str):
        return None
    if is_question:
        answers_count = record.get("answers_count")
        if type(answers_count) is not int or answers_count != 0 or status == "PROCESSED":
            return None
    elif status != "UNPROCESSED":
        return None
    return dict(record)


def _normalized_message(record: dict[str, object], *, is_question: bool) -> dict[str, object]:
    identifier = _required_string(record.get("id"))
    text = _required_string(record.get("text"))
    published_at = _parse_timestamp(record.get("published_at"))
    sku = _record_sku(record.get("sku"), is_question=is_question)
    status = record.get("status")
    if identifier is None or text is None or published_at is None or sku is None or not isinstance(status, str):
        return {}
    product_url = _optional_string(record.get("product_url")) if is_question else None
    return {
        "external_id": identifier,
        "type": MessageType.QUESTION.value if is_question else MessageType.REVIEW.value,
        "status": MessageStatus.NEEDS_REPLY.value,
        "rating": None if is_question else _optional_integer(record.get("rating")),
        "customer_display_name": _optional_string(record.get("author_name")) if is_question else None,
        "customer_text": text,
        "customer_photos_json": [],
        "marketplace_created_at": published_at,
        "product": {
            "external_id": str(sku),
            "sku": str(sku),
            "name": None,
            "brand": None,
            "category": None,
            "image_url": None,
            "product_url": product_url,
            "metadata_json": {"ozon_sku": sku},
        },
        "metadata_json": {
            "source": "ozon.questions" if is_question else "ozon.reviews",
            "ozon_sku": sku,
            "ozon_status": status,
        },
    }


def _mapping(value: object | None) -> Mapping[str, object] | None:
    if not isinstance(value, Mapping):
        return None
    return cast(Mapping[str, object], value)


def _required_string(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value


def _optional_string(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value


def _optional_integer(value: object) -> int | None:
    return value if type(value) is int else None


def _positive_sku(value: object) -> int | None:
    if type(value) is not int or value <= 0:
        return None
    return value


def _record_sku(value: object, *, is_question: bool) -> int | None:
    sku = _positive_sku(value)
    if sku is not None or is_question:
        return sku
    if not isinstance(value, str) or not value.isascii() or not value.isdigit():
        return None
    parsed = int(value)
    return parsed if parsed > 0 else None


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else None


def _valid_timestamp(value: str) -> bool:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None
