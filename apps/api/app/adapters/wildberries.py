from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.models.enums import MessageStatus, MessageType


class WildberriesAdapter(MarketplaceAdapter):
    marketplace = "wildberries"
    base_url = "https://feedbacks-api.wildberries.ru"

    def __init__(
        self,
        timeout_seconds: float = 20.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._timeout = timeout_seconds
        self._transport = transport

    def _headers(self, credential: str) -> dict[str, str]:
        return {"Authorization": credential}

    page_size = 50

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        return await self._get("/ping", credential, params=None)

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        offset = self._parse_offset(cursor)
        if offset is None:
            return AdapterResult(False, error_code="invalid_cursor", error_message_safe="Stored sync cursor is invalid")
        result = await self._get(
            "/api/v1/feedbacks",
            credential,
            params={"isAnswered": "false", "take": self.page_size, "skip": offset},
        )
        return self.with_next_cursor(result, item_count=len(self.extract_reviews(result.data)), offset=offset)

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        offset = self._parse_offset(cursor)
        if offset is None:
            return AdapterResult(False, error_code="invalid_cursor", error_message_safe="Stored sync cursor is invalid")
        result = await self._get(
            "/api/v1/questions",
            credential,
            params={"isAnswered": "false", "take": self.page_size, "skip": offset},
        )
        return self.with_next_cursor(result, item_count=len(self.extract_questions(result.data)), offset=offset)

    async def get_review(self, credential: str, external_id: str) -> AdapterResult:
        return await self._get("/api/v1/feedback", credential, params={"id": external_id})

    async def get_question(self, credential: str, external_id: str) -> AdapterResult:
        return await self._get("/api/v1/question", credential, params={"id": external_id})

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        if not 2 <= len(reply_text) <= 5000:
            return AdapterResult(
                False,
                error_code="invalid_reply_text",
                error_message_safe="Wildberries review reply must contain 2 to 5000 characters",
            )
        payload: dict[str, object] = {"id": external_id, "text": reply_text}
        return await self._post("/api/v1/feedbacks/answer", credential, json=payload)

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        payload: dict[str, object] = {"id": external_id, "answer": {"text": reply_text}}
        return await self._patch("/api/v1/questions", credential, json=payload)

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        result = (
            await self.get_review(credential, external_id)
            if message_type == MessageType.REVIEW.value
            else await self.get_question(credential, external_id)
            if message_type == MessageType.QUESTION.value
            else AdapterResult(
                False,
                error_code="unsupported_message_type",
                error_message_safe="Message type is not supported by this marketplace",
            )
        )
        if not result.ok:
            return result
        answered = self._existing_reply_status(result.data)
        if answered is None:
            return AdapterResult(
                False,
                error_code="marketplace_malformed_response",
                error_message_safe="Wildberries exact message response is malformed",
            )
        return AdapterResult(ok=True, data={"answered": answered})

    def is_already_answered(self, payload: object) -> bool:
        return self._existing_reply_status(payload) is True

    def _existing_reply_status(self, payload: object) -> bool | None:
        data = self._data(payload)
        if not isinstance(data, dict):
            return None
        mapping = cast(dict[str, object], data)
        is_answered = mapping.get("isAnswered")
        if isinstance(is_answered, bool):
            return is_answered
        if "answer" not in mapping:
            return None
        answer = mapping.get("answer")
        if answer is None:
            return False
        if isinstance(answer, dict):
            answer_mapping = cast(dict[str, object], answer)
            return bool(self._optional_string(answer_mapping.get("text")))
        if isinstance(answer, str):
            return bool(answer.strip())
        return None

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return self._extract_items(payload, keys=("feedbacks", "items", "data"))

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return self._extract_items(payload, keys=("questions", "items", "data"))

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        product = self._product_context(raw)
        return {
            "external_id": self._string(raw.get("id") or raw.get("feedbackId") or raw.get("externalId")),
            "type": MessageType.REVIEW.value,
            "status": MessageStatus.NEEDS_REPLY.value,
            "rating": self._int_or_none(raw.get("productValuation") or raw.get("valuation") or raw.get("rating")),
            "customer_display_name": self._optional_string(raw.get("userName") or raw.get("customerName") or raw.get("buyerName")),
            "customer_text": self._string(raw.get("text") or raw.get("reviewText") or raw.get("message") or ""),
            "customer_photos_json": self._photos(raw),
            "marketplace_created_at": self._datetime(raw.get("createdDate") or raw.get("createdAt") or raw.get("date")),
            "product": product,
            "metadata_json": {
                "source": "wildberries.feedbacks",
                "wb_status": raw.get("state") or raw.get("status"),
                "is_answered": raw.get("isAnswered"),
                "raw_keys": sorted(raw.keys()),
            },
        }

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        product = self._product_context(raw)
        return {
            "external_id": self._string(raw.get("id") or raw.get("questionId") or raw.get("externalId")),
            "type": MessageType.QUESTION.value,
            "status": MessageStatus.NEEDS_REPLY.value,
            "rating": None,
            "customer_display_name": self._optional_string(raw.get("userName") or raw.get("customerName") or raw.get("buyerName")),
            "customer_text": self._string(raw.get("text") or raw.get("question") or raw.get("message") or ""),
            "customer_photos_json": self._photos(raw),
            "marketplace_created_at": self._datetime(raw.get("createdDate") or raw.get("createdAt") or raw.get("date")),
            "product": product,
            "metadata_json": {
                "source": "wildberries.questions",
                "wb_status": raw.get("state") or raw.get("status"),
                "is_answered": raw.get("isAnswered"),
                "raw_keys": sorted(raw.keys()),
            },
        }

    async def _get(self, path: str, credential: str, params: dict[str, str | int] | None) -> AdapterResult:
        return await self._request("GET", path, credential, params=params)

    async def _post(self, path: str, credential: str, json: dict[str, object]) -> AdapterResult:
        return await self._request("POST", path, credential, json=json)

    async def _patch(self, path: str, credential: str, json: dict[str, object]) -> AdapterResult:
        return await self._request("PATCH", path, credential, json=json)

    async def _request(
        self,
        method: str,
        path: str,
        credential: str,
        *,
        params: dict[str, str | int] | None = None,
        json: dict[str, object] | None = None,
    ) -> AdapterResult:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self._timeout,
                follow_redirects=False,
                transport=self._transport,
            ) as client:
                response = await client.request(
                    method,
                    path,
                    headers=self._headers(credential),
                    params=params,
                    json=json,
                )
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Marketplace request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Marketplace network error")
        payload = self._safe_json(response)
        if response.is_success:
            return AdapterResult(ok=True, data=payload)
        return self._map_response_error(response, payload)

    def _map_response_error(self, response: httpx.Response, payload: object | None) -> AdapterResult:
        result = self.map_error(response.status_code, payload)
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

    @classmethod
    def with_next_cursor(cls, result: AdapterResult, *, item_count: int, offset: int) -> AdapterResult:
        if not result.ok:
            return result
        next_cursor = str(offset + item_count) if item_count >= cls.page_size else None
        return AdapterResult(ok=True, data=result.data, next_cursor=next_cursor)

    @staticmethod
    def _parse_offset(cursor: str | None) -> int | None:
        if cursor is None or cursor == "":
            return 0
        try:
            offset = int(cursor)
        except ValueError:
            return None
        return offset if offset >= 0 else None

    @staticmethod
    def _safe_json(response: httpx.Response) -> object:
        try:
            payload: object = response.json()
            return payload
        except ValueError:
            return {"text": response.text[:500]}

    @staticmethod
    def _data(payload: object) -> object:
        if isinstance(payload, dict):
            data = cast(dict[str, object], payload)
            if "data" in data:
                return data["data"]
            return data
        return payload

    def _extract_items(self, payload: object, *, keys: tuple[str, ...]) -> list[dict[str, object]]:
        data = self._data(payload)
        if isinstance(data, dict):
            mapping = cast(dict[str, object], data)
            for key in keys:
                value = mapping.get(key)
                if isinstance(value, list):
                    return self._dict_items(cast(list[object], value))
        if isinstance(data, list):
            return self._dict_items(cast(list[object], data))
        return []

    @staticmethod
    def _dict_items(value: list[object]) -> list[dict[str, object]]:
        return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]

    def _product_context(self, raw: dict[str, object]) -> dict[str, object]:
        product_details_value = raw.get("productDetails")
        product_details = cast(dict[str, object], product_details_value) if isinstance(product_details_value, dict) else {}
        nm_id = raw.get("nmId") or product_details.get("nmId") or raw.get("productId")
        imt_id = raw.get("imtId") or product_details.get("imtId")
        name = raw.get("productName") or product_details.get("productName") or raw.get("productTitle") or "Wildberries product"
        return {
            "external_id": self._string(nm_id or imt_id or raw.get("productExternalId") or "unknown"),
            "sku": self._optional_string(raw.get("supplierArticle") or product_details.get("supplierArticle")),
            "name": self._string(name),
            "brand": self._optional_string(raw.get("brandName") or product_details.get("brandName")),
            "category": self._optional_string(raw.get("subjectName") or product_details.get("subjectName")),
            "image_url": self._optional_string(raw.get("productImageUrl") or product_details.get("imageUrl")),
            "product_url": self._optional_string(raw.get("productUrl") or product_details.get("productUrl")),
            "metadata_json": {
                "nmId": nm_id,
                "imtId": imt_id,
                "supplierArticle": raw.get("supplierArticle") or product_details.get("supplierArticle"),
            },
        }

    @staticmethod
    def _photos(raw: dict[str, object]) -> list[object]:
        value = raw.get("photoLinks") or raw.get("photos") or raw.get("photoLinksJson")
        if isinstance(value, list):
            return cast(list[object], value)
        return []

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, str) and value:
            try:
                normalized = value.replace("Z", "+00:00")
                parsed = datetime.fromisoformat(normalized)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError:
                return datetime.now(UTC)
        return datetime.now(UTC)

    @staticmethod
    def _string(value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _optional_string(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _int_or_none(value: object) -> int | None:
        if value is None or value == "":
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float | str):
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
        return None

    @staticmethod
    def _retry_after_seconds(value: str | None) -> int | None:
        if not value:
            return None
        try:
            parsed = int(value)
        except ValueError:
            return None
        return max(parsed, 0)

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        if status_code == 401:
            return AdapterResult(False, error_code="invalid_credentials", error_message_safe="API key is invalid")
        if status_code == 403:
            return AdapterResult(False, error_code="insufficient_scope", error_message_safe="API key has insufficient permissions")
        if status_code == 429:
            return AdapterResult(False, error_code="rate_limited", error_message_safe="Marketplace rate limit exceeded")
        if 500 <= status_code <= 599:
            return AdapterResult(False, error_code="marketplace_unavailable", error_message_safe="Marketplace is temporarily unavailable")
        return AdapterResult(False, error_code="marketplace_error", error_message_safe="Marketplace returned an error")
