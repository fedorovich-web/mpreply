from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.models.enums import MessageStatus, MessageType


class WildberriesAdapter(MarketplaceAdapter):
    marketplace = "wildberries"
    base_url = "https://feedbacks-api.wildberries.ru"

    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self._timeout = timeout_seconds

    def _headers(self, credential: str) -> dict[str, str]:
        return {"Authorization": credential}

    async def validate_credentials(self, credential: str) -> AdapterResult:
        return await self.fetch_questions(credential=credential, cursor=None)

    async def fetch_reviews(self, credential: str, cursor: str | None = None) -> AdapterResult:
        params: dict[str, str | int] = {"isAnswered": "false", "take": 50, "skip": 0}
        if cursor:
            params["skip"] = int(cursor)
        return await self._get("/api/v1/feedbacks", credential, params=params)

    async def fetch_questions(self, credential: str, cursor: str | None = None) -> AdapterResult:
        params: dict[str, str | int] = {"isAnswered": "false", "take": 50, "skip": 0}
        if cursor:
            params["skip"] = int(cursor)
        return await self._get("/api/v1/questions", credential, params=params)

    async def send_review_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload: dict[str, object] = {"id": external_id, "text": reply_text}
        return await self._post("/api/v1/feedbacks/answer", credential, json=payload)

    async def send_question_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload: dict[str, object] = {"id": external_id, "answer": {"text": reply_text}}
        return await self._patch("/api/v1/questions", credential, json=payload)

    def extract_reviews(self, payload: object) -> list[dict[str, object]]:
        return self._extract_items(payload, keys=("feedbacks", "items", "data"))

    def extract_questions(self, payload: object) -> list[dict[str, object]]:
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

    async def _get(self, path: str, credential: str, params: dict[str, str | int]) -> AdapterResult:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
                response = await client.get(path, headers=self._headers(credential), params=params)
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Marketplace request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Marketplace network error")
        if response.is_success:
            return AdapterResult(ok=True, data=self._safe_json(response))
        return self.map_error(response.status_code, self._safe_json(response))

    async def _post(self, path: str, credential: str, json: dict[str, object]) -> AdapterResult:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
                response = await client.post(path, headers=self._headers(credential), json=json)
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Marketplace request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Marketplace network error")
        if response.is_success:
            return AdapterResult(ok=True, data=self._safe_json(response))
        return self.map_error(response.status_code, self._safe_json(response))

    async def _patch(self, path: str, credential: str, json: dict[str, object]) -> AdapterResult:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
                response = await client.patch(path, headers=self._headers(credential), json=json)
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Marketplace request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Marketplace network error")
        if response.is_success:
            return AdapterResult(ok=True, data=self._safe_json(response))
        return self.map_error(response.status_code, self._safe_json(response))

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
