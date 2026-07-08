from typing import Any

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter


class WildberriesAdapter(MarketplaceAdapter):
    marketplace = "wildberries"
    base_url = "https://feedbacks-api.wildberries.ru"

    def __init__(self, timeout_seconds: float = 20.0) -> None:
        self._timeout = timeout_seconds

    def _headers(self, credential: str) -> dict[str, str]:
        return {"Authorization": credential}

    async def validate_credentials(self, credential: str) -> AdapterResult:
        # Low-cost validation route. Exact endpoint may be adjusted after final WB smoke testing.
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

    async def _get(self, path: str, credential: str, params: dict[str, Any]) -> AdapterResult:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
            response = await client.get(path, headers=self._headers(credential), params=params)
        if response.is_success:
            return AdapterResult(ok=True, data=response.json())
        return self.map_error(response.status_code, self._safe_json(response))

    async def _post(self, path: str, credential: str, json: dict[str, Any]) -> AdapterResult:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
            response = await client.post(path, headers=self._headers(credential), json=json)
        if response.is_success:
            return AdapterResult(ok=True, data=self._safe_json(response))
        return self.map_error(response.status_code, self._safe_json(response))

    async def _patch(self, path: str, credential: str, json: dict[str, Any]) -> AdapterResult:
        async with httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout) as client:
            response = await client.patch(path, headers=self._headers(credential), json=json)
        if response.is_success:
            return AdapterResult(ok=True, data=self._safe_json(response))
        return self.map_error(response.status_code, self._safe_json(response))

    @staticmethod
    def _safe_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError:
            return {"text": response.text[:500]}

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
