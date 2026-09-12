from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

import httpx

from app.adapters.base import (
    AdapterResult,
    CredentialValidation,
    MarketplaceAdapter,
    NormalizedMessage,
    NormalizedProduct,
)
from app.models.enums import Marketplace, MessageType


class WildberriesAdapter(MarketplaceAdapter):
    marketplace = Marketplace.WILDBERRIES
    base_url = "https://feedbacks-api.wildberries.ru"

    def __init__(
        self,
        timeout_seconds: float = 20.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._timeout = timeout_seconds
        self._client = client

    def _headers(self, credential: str) -> dict[str, str]:
        return {"Authorization": credential}

    async def validate_credentials(
        self,
        credential: str,
        seller_id: str | None = None,
    ) -> AdapterResult[CredentialValidation]:
        del seller_id
        result = await self.fetch_questions(credential=credential, cursor=None)
        if not result.ok:
            return AdapterResult(
                False,
                error_code=result.error_code,
                error_message_safe=result.error_message_safe,
                retry_after_seconds=result.retry_after_seconds,
            )
        return AdapterResult(
            ok=True,
            data=CredentialValidation(
                scopes=("fetch_reviews", "fetch_questions", "send_review_reply", "send_question_reply"),
                account_reference=None,
            ),
        )

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

    async def get_review(self, credential: str, external_id: str) -> AdapterResult:
        return await self._get("/api/v1/feedback", credential, params={"id": external_id})

    async def get_question(self, credential: str, external_id: str) -> AdapterResult:
        return await self._get("/api/v1/question", credential, params={"id": external_id})

    async def send_review_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload: dict[str, object] = {"id": external_id, "text": reply_text}
        return await self._post("/api/v1/feedbacks/answer", credential, json=payload)

    async def send_question_reply(self, credential: str, external_id: str, reply_text: str) -> AdapterResult:
        payload: dict[str, object] = {"id": external_id, "answer": {"text": reply_text}}
        return await self._patch("/api/v1/questions", credential, json=payload)

    def is_already_answered(self, payload: object) -> bool:
        data = self._data(payload)
        if not isinstance(data, dict):
            return False
        mapping = cast(dict[str, object], data)
        answer = mapping.get("answer")
        if isinstance(answer, dict):
            answer_mapping = cast(dict[str, object], answer)
            return bool(self._optional_string(answer_mapping.get("text")))
        if isinstance(answer, str):
            return bool(answer.strip())
        return bool(mapping.get("isAnswered"))

    def extract_reviews(self, payload: object) -> list[dict[str, object]]:
        return self._extract_items(payload, keys=("feedbacks", "items", "data"))

    def extract_questions(self, payload: object) -> list[dict[str, object]]:
        return self._extract_items(payload, keys=("questions", "items", "data"))

    def normalize_review(self, raw: dict[str, object]) -> NormalizedMessage:
        product = self._product_context(raw)
        return NormalizedMessage(
            external_id=self._required_string(
                raw.get("id") or raw.get("feedbackId") or raw.get("externalId"),
                field_name="feedback ID",
            ),
            message_type=MessageType.REVIEW,
            rating=self._int_or_none(raw.get("productValuation") or raw.get("valuation") or raw.get("rating")),
            customer_display_name=self._optional_string(raw.get("userName") or raw.get("customerName") or raw.get("buyerName")),
            customer_text=self._required_string(
                raw.get("text") or raw.get("reviewText") or raw.get("message"),
                field_name="feedback text",
            ),
            customer_photos=self._photos(raw),
            marketplace_created_at=self._datetime(raw.get("createdDate") or raw.get("createdAt") or raw.get("date")),
            product=product,
            metadata={
                "source": "wildberries.feedbacks",
                "status": raw.get("state") or raw.get("status"),
                "is_answered": raw.get("isAnswered"),
            },
        )

    def normalize_question(self, raw: dict[str, object]) -> NormalizedMessage:
        product = self._product_context(raw)
        return NormalizedMessage(
            external_id=self._required_string(
                raw.get("id") or raw.get("questionId") or raw.get("externalId"),
                field_name="question ID",
            ),
            message_type=MessageType.QUESTION,
            rating=None,
            customer_display_name=self._optional_string(raw.get("userName") or raw.get("customerName") or raw.get("buyerName")),
            customer_text=self._required_string(
                raw.get("text") or raw.get("question") or raw.get("message"),
                field_name="question text",
            ),
            customer_photos=self._photos(raw),
            marketplace_created_at=self._datetime(raw.get("createdDate") or raw.get("createdAt") or raw.get("date")),
            product=product,
            metadata={
                "source": "wildberries.questions",
                "status": raw.get("state") or raw.get("status"),
                "is_answered": raw.get("isAnswered"),
            },
        )

    async def _get(self, path: str, credential: str, params: dict[str, str | int]) -> AdapterResult:
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
            if self._client is not None:
                response = await self._client.request(
                    method,
                    path,
                    headers=self._headers(credential),
                    params=params,
                    json=json,
                )
            else:
                async with httpx.AsyncClient(
                    base_url=self.base_url,
                    timeout=self._timeout,
                    follow_redirects=False,
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

    def _product_context(self, raw: dict[str, object]) -> NormalizedProduct:
        product_details_value = raw.get("productDetails")
        product_details = cast(dict[str, object], product_details_value) if isinstance(product_details_value, dict) else {}
        nm_id = raw.get("nmId") or product_details.get("nmId") or raw.get("productId")
        imt_id = raw.get("imtId") or product_details.get("imtId")
        supplier_article = raw.get("supplierArticle") or product_details.get("supplierArticle")
        name = raw.get("productName") or product_details.get("productName") or raw.get("productTitle")
        return NormalizedProduct(
            external_id=self._required_string(
                nm_id or imt_id or raw.get("productExternalId"),
                field_name="product ID",
            ),
            sku=self._optional_string(supplier_article),
            name=self._required_string(name, field_name="product name"),
            brand=self._optional_string(raw.get("brandName") or product_details.get("brandName")),
            category=self._optional_string(raw.get("subjectName") or product_details.get("subjectName")),
            image_url=self._optional_string(raw.get("productImageUrl") or product_details.get("imageUrl")),
            product_url=self._optional_string(raw.get("productUrl") or product_details.get("productUrl")),
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
        value = raw.get("photoLinks") or raw.get("photos") or raw.get("photoLinksJson")
        if isinstance(value, list):
            photos = cast(list[object], value)
            if not all(isinstance(photo, str) and photo.strip() for photo in photos):
                raise ValueError("Wildberries photo list is malformed")
            return tuple(cast(str, photo).strip() for photo in photos)
        return ()

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, str) and value:
            try:
                normalized = value.replace("Z", "+00:00")
                parsed = datetime.fromisoformat(normalized)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError as exc:
                raise ValueError("Wildberries timestamp is malformed") from exc
        raise ValueError("Wildberries timestamp is missing")

    @staticmethod
    def _string(value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @staticmethod
    def _required_string(value: object, *, field_name: str) -> str:
        text = WildberriesAdapter._string(value)
        if not text:
            raise ValueError(f"Wildberries {field_name} is missing")
        return text

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
        return AdapterResult(False, error_code="marketplace_validation_error", error_message_safe="Marketplace returned an error")
