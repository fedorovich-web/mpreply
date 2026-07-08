from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

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
        # Low-cost validation route. Exact scopes are confirmed by the real marketplace response.
        return await self.fetch_questions(credential=credential, cursor=None)

    async def fetch_reviews(self, credential: str, cursor: str | None = None) -> AdapterResult:
        params: dict[str, Any] = {"isAnswered": "false", "take": 50, "skip": 0}
        if cursor:
            params["skip"] = int(cursor)
        return await self._get("/api/v1/feedbacks", credential, params=params)

    async def fetch_questions(self, credential: str, cursor: str | None = None) -> AdapterResult:
        params: dict[str, Any] = {"isAnswered": "false", "take": 50, "skip": 0}
        if cursor:
            params["skip"] = int(cursor)
        return await self._get("/api/v1/questions", credential, params=params)

    async def send_review_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload = {"id": external_id, "text": reply_text}
        return await self._post("/api/v1/feedbacks/answer", credential, json=payload)

    async def send_question_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload = {"id": external_id, "answer": {"text": reply_text}}
        return await self._patch("/api/v1/questions", credential, json=payload)

    def extract_reviews(self, payload: Any) -> list[dict[str, Any]]:
        data = self._data(payload)
        if isinstance(data, dict):
            for key in ("feedbacks", "items", "data"):
                value = data.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def extract_questions(self, payload: Any) -> list[dict[str, Any]]:
        data = self._data(payload)
        if isinstance(data, dict):
            for key in ("questions", "items", "data"):
                value = data.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def normalize_review(self, raw: dict[str, Any]) -> dict[str, Any]:
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

    def normalize_question(self, raw: dict[str, Any]) -> dict[str, Any]:
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

    async def _get(self, path: str, credential: str, params: dict[str, Any]) -> AdapterResult:
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
                response = await client.get(path, headers=self._headers(credential), params=params)
        except httpx.TimeoutException:
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Marketplace request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Marketplace network error")
        if response.is_success:
            return AdapterResult(ok=True, data=response.json())
        return self.map_error(response.status_code, self._safe_json(response))

    async def _post(self, path: str, credential: str, json: dict[str, Any]) -> AdapterResult:
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

    async def _patch(self, path: str, credential: str, json: dict[str, Any]) -> AdapterResult:
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
    def _safe_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError:
            return {"text": response.text[:500]}

    @staticmethod
    def _data(payload: Any) -> Any:
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    def _product_context(self, raw: dict[str, Any]) -> dict[str, Any]:
        product_details = raw.get("productDetails") if isinstance(raw.get("productDetails"), dict) else {}
        nm_id = raw.get("nmId") or product_details.get("nmId") or raw.get("productId")
        imt_id = raw.get("imtId") or product_details.get("imtId")
        name = (
            raw.get("productName")
            or product_details.get("productName")
            or raw.get("productTitle")
            or "Wildberries product"
        )
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
    def _photos(raw: dict[str, Any]) -> list[Any]:
        value = raw.get("photoLinks") or raw.get("photos") or raw.get("photoLinksJson") or []
        if isinstance(value, list):
            return value
        return []

    @staticmethod
    def _datetime(value: Any) -> datetime:
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
    def _string(value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _optional_string(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _int_or_none(value: Any) -> int | None:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def map_error(self, status_code: int, payload: Any | None = None) -> AdapterResult:
        if status_code == 401:
            return AdapterResult(False, error_code="invalid_credentials", error_message_safe="API key is invalid")
        if status_code == 403:
            return AdapterResult(False, error_code="insufficient_scope", error_message_safe="API key has insufficient permissions")
        if status_code == 429:
            return AdapterResult(False, error_code="rate_limited", error_message_safe="Marketplace rate limit exceeded")
        if 500 <= status_code <= 599:
            return AdapterResult(False, error_code="marketplace_unavailable", error_message_safe="Marketplace is temporarily unavailable")
        return AdapterResult(False, error_code="marketplace_error", error_message_safe="Marketplace returned an error")
