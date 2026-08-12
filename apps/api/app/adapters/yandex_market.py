from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Literal, cast

import httpx

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.models.enums import MessageStatus, MessageType

YandexQuestionReplyState = Literal[
    "ABSENT", "PUBLISHED", "UNMODERATED", "BANNED", "DELETED", "UNKNOWN"
]
_KNOWN_QUESTION_REPLY_STATES = frozenset({"PUBLISHED", "UNMODERATED", "BANNED", "DELETED"})


class YandexMarketAdapter(MarketplaceAdapter):
    marketplace = "yandex_market"
    base_url = "https://api.partner.market.yandex.ru"
    page_size = 50

    def __init__(
        self,
        timeout_seconds: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._timeout = timeout_seconds
        self._transport = transport

    def _headers(self, credential: str) -> dict[str, str]:
        return {
            "Api-Key": credential,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Market-Integration": "MPReply/0.1.104-dev",
        }

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        business_id = self._business_id(seller_id)
        if business_id is None:
            return self._invalid_business_id()
        token_result = await self._request("POST", "/v2/auth/token", credential, json=None)
        if not token_result.ok:
            return token_result
        scopes = self._token_scopes(token_result.data)
        if not ({"COMMUNICATION", "ALL_METHODS"} & set(scopes)):
            return AdapterResult(
                False,
                data={"scopes": scopes},
                error_code="insufficient_scope",
                error_message_safe="API key needs Customer communication write access",
            )
        access_result = await self._request(
            "POST",
            f"/v2/businesses/{business_id}/goods-feedback",
            credential,
            params={"limit": 1},
            json={"reactionStatus": "NEED_REACTION"},
        )
        if not access_result.ok:
            return access_result
        return AdapterResult(ok=True, data={"scopes": scopes, "business_id": business_id})

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        if business_id is None:
            return self._invalid_business_id()
        params: dict[str, str | int] = {"limit": self.page_size}
        if cursor:
            params["pageToken"] = cursor
        result = await self._request(
            "POST",
            f"/v2/businesses/{business_id}/goods-feedback",
            credential,
            params=params,
            json={"reactionStatus": "NEED_REACTION"},
        )
        return self._with_page_token(result)

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        if business_id is None:
            return self._invalid_business_id()
        params: dict[str, str | int] = {"limit": self.page_size}
        if cursor:
            params["pageToken"] = cursor
        result = await self._request(
            "POST",
            f"/v1/businesses/{business_id}/goods-questions",
            credential,
            params=params,
            json={"needAnswer": True},
        )
        return self._with_page_token(result)

    async def fetch_questions_window(
        self,
        credential: str,
        *,
        date_from: date,
        date_to: date,
        cursor: str | None = None,
        seller_id: str | None = None,
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        if business_id is None:
            return self._invalid_business_id()
        if date_from > date_to:
            return AdapterResult(
                False,
                error_code="invalid_date_window",
                error_message_safe="Yandex Market question date window is invalid",
            )
        params: dict[str, str | int] = {"limit": self.page_size}
        if cursor:
            params["pageToken"] = cursor
        result = await self._request(
            "POST",
            f"/v1/businesses/{business_id}/goods-questions",
            credential,
            params=params,
            json={
                "needAnswer": True,
                "dateFrom": date_from.isoformat(),
                "dateTo": date_to.isoformat(),
            },
        )
        return self._with_page_token(result)

    async def send_review_reply(
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        feedback_id = self._positive_int(external_id)
        if business_id is None:
            return self._invalid_business_id()
        if feedback_id is None:
            return self._invalid_external_id("review")
        return await self._request(
            "POST",
            f"/v2/businesses/{business_id}/goods-feedback/comments/update",
            credential,
            params={"sourceType": "SELLER"},
            json={"feedbackId": feedback_id, "comment": {"text": reply_text}},
        )

    async def send_question_reply(
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        question_id = self._positive_int(external_id)
        if business_id is None:
            return self._invalid_business_id()
        if question_id is None:
            return self._invalid_external_id("question")
        return await self._request(
            "POST",
            f"/v1/businesses/{business_id}/goods-questions/update",
            credential,
            json={
                "operationType": "CREATE",
                "parentEntityId": {"id": question_id, "type": "QUESTION"},
                "text": reply_text,
            },
        )

    async def reconcile_question_reply(
        self,
        credential: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        question_id = self._positive_int(external_id)
        if business_id is None:
            return self._invalid_business_id()
        if question_id is None:
            return self._invalid_external_id("question")
        result = await self._request(
            "POST",
            f"/v1/businesses/{business_id}/goods-questions/answers",
            credential,
            params={"limit": self.page_size},
            json={"questionId": question_id},
        )
        if not result.ok:
            return result
        answers = self._question_answer_items(result.data)
        if answers is None:
            return self._question_reply_state_result("UNKNOWN")

        seller_answers: list[dict[str, object]] = []
        for answer in answers:
            author = self._mapping(answer.get("author"))
            author_type = str(author.get("type") or "").strip().upper()
            can_modify = answer.get("canModify")
            if can_modify is True and author_type not in {"", "BUSINESS", "BRAND"}:
                return self._question_reply_state_result("UNKNOWN")
            if can_modify is True or author_type in {"BUSINESS", "BRAND"}:
                seller_answers.append(answer)
            elif not author_type and can_modify is not False:
                return self._question_reply_state_result("UNKNOWN")

        if not seller_answers:
            return self._question_reply_state_result("ABSENT")
        if len(seller_answers) != 1:
            return self._question_reply_state_result("UNKNOWN")

        answer = seller_answers[0]
        answer_id = self._positive_int(answer.get("id"))
        if answer_id is None:
            return self._question_reply_state_result("UNKNOWN")
        state = str(answer.get("status") or "").strip().upper()
        if state not in _KNOWN_QUESTION_REPLY_STATES:
            return self._question_reply_state_result("UNKNOWN", answer_id=str(answer_id))
        return self._question_reply_state_result(
            cast(YandexQuestionReplyState, state),
            answer_id=str(answer_id),
        )

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        business_id = self._business_id(seller_id)
        entity_id = self._positive_int(external_id)
        if business_id is None:
            return self._invalid_business_id()
        if entity_id is None:
            return self._invalid_external_id(message_type)
        if message_type == MessageType.REVIEW.value:
            result = await self._request(
                "POST",
                f"/v2/businesses/{business_id}/goods-feedback/comments",
                credential,
                params={"limit": self.page_size, "sourceType": "SELLER"},
                json={"feedbackId": entity_id},
            )
            items = self._extract_result_items(result.data, "comments") if result.ok else []
            if not result.ok:
                return result
            answered = any(self._is_business_authored(item) for item in items)
            return AdapterResult(ok=True, data={"answered": answered})
        if message_type == MessageType.QUESTION.value:
            reconciliation = await self.reconcile_question_reply(
                credential, external_id, seller_id=seller_id
            )
            if not reconciliation.ok:
                return reconciliation
            data = self._mapping(reconciliation.data)
            state = str(data.get("state") or "UNKNOWN").upper()
            if state == "ABSENT":
                return AdapterResult(ok=True, data={"answered": False, "state": state})
            return AdapterResult(ok=True, data={"answered": True, "state": state})
        return AdapterResult(
            False,
            error_code="unsupported_message_type",
            error_message_safe="Message type is not supported by Yandex Market",
        )

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return self._extract_result_items(payload, "feedbacks")

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return self._extract_result_items(payload, "questions")

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        identifiers = self._mapping(raw.get("identifiers"))
        description = self._mapping(raw.get("description"))
        statistics = self._mapping(raw.get("statistics"))
        offer_id = self._string(identifiers.get("offerId"))
        text_parts = [
            self._optional_string(description.get("comment")),
            self._prefixed("Плюсы", description.get("advantages")),
            self._prefixed("Минусы", description.get("disadvantages")),
        ]
        return {
            "external_id": self._string(raw.get("feedbackId")),
            "type": MessageType.REVIEW.value,
            "status": MessageStatus.NEEDS_REPLY.value,
            "rating": self._int_or_none(statistics.get("rating")),
            "customer_display_name": self._optional_string(raw.get("author")),
            "customer_text": "\n".join(part for part in text_parts if part),
            "customer_photos_json": self._media(raw.get("media")),
            "marketplace_created_at": self._datetime(raw.get("createdAt")),
            "product": {
                "external_id": offer_id or f"feedback-{self._string(raw.get('feedbackId'))}",
                "sku": offer_id or None,
                "name": f"Товар Яндекс Маркета {offer_id}" if offer_id else "Товар Яндекс Маркета",
                "brand": None,
                "category": None,
                "image_url": None,
                "product_url": None,
                "metadata_json": {"offerId": offer_id or None, "orderId": identifiers.get("orderId")},
            },
            "metadata_json": {
                "source": "yandex_market.goods_feedback",
                "need_reaction": raw.get("needReaction"),
                "recommended": statistics.get("recommended"),
                "comments_count": statistics.get("commentsCount"),
                "raw_keys": sorted(raw.keys()),
            },
        }

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        identifiers = self._mapping(raw.get("questionIdentifiers"))
        author = self._mapping(raw.get("author"))
        offer_id = self._string(identifiers.get("offerId"))
        question_id = self._string(identifiers.get("id"))
        return {
            "external_id": question_id,
            "type": MessageType.QUESTION.value,
            "status": MessageStatus.NEEDS_REPLY.value,
            "rating": None,
            "customer_display_name": self._optional_string(author.get("name")),
            "customer_text": self._string(raw.get("text")),
            "customer_photos_json": [],
            "marketplace_created_at": self._datetime(raw.get("createdAt")),
            "product": {
                "external_id": offer_id or f"question-{question_id}",
                "sku": offer_id or None,
                "name": f"Товар Яндекс Маркета {offer_id}" if offer_id else "Товар Яндекс Маркета",
                "brand": None,
                "category": self._optional_string(identifiers.get("categoryId")),
                "image_url": None,
                "product_url": None,
                "metadata_json": {
                    "offerId": offer_id or None,
                    "categoryId": identifiers.get("categoryId"),
                    "businessId": raw.get("businessId"),
                },
            },
            "metadata_json": {
                "source": "yandex_market.goods_questions",
                "author_type": author.get("type"),
                "votes": raw.get("votes"),
                "raw_keys": sorted(raw.keys()),
            },
        }

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
            return AdapterResult(False, error_code="network_timeout", error_message_safe="Yandex Market request timed out")
        except httpx.HTTPError:
            return AdapterResult(False, error_code="network_error", error_message_safe="Yandex Market network error")
        payload = self._safe_json(response)
        if response.is_success and self._response_status(payload) != "ERROR":
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

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        if status_code == 401:
            return AdapterResult(False, error_code="invalid_credentials", error_message_safe="Yandex Market API key is invalid")
        if status_code == 403:
            return AdapterResult(False, error_code="insufficient_scope", error_message_safe="Yandex Market API key has insufficient permissions")
        if status_code == 404:
            return AdapterResult(False, error_code="account_not_found", error_message_safe="Yandex Market business was not found")
        if status_code == 420:
            return AdapterResult(False, error_code="rate_limited", error_message_safe="Yandex Market resource limit exceeded")
        if status_code == 429:
            return AdapterResult(False, error_code="rate_limited", error_message_safe="Yandex Market rate limit exceeded")
        if 500 <= status_code <= 599:
            return AdapterResult(False, error_code="marketplace_unavailable", error_message_safe="Yandex Market is temporarily unavailable")
        if status_code == 400:
            return AdapterResult(False, error_code="marketplace_rejected", error_message_safe="Yandex Market rejected the request data")
        if self._response_status(payload) == "ERROR":
            return AdapterResult(False, error_code="marketplace_error", error_message_safe="Yandex Market returned an API error")
        return AdapterResult(False, error_code="marketplace_error", error_message_safe="Yandex Market returned an error")

    def _with_page_token(self, result: AdapterResult) -> AdapterResult:
        if not result.ok:
            return result
        return AdapterResult(ok=True, data=result.data, next_cursor=self._next_page_token(result.data))

    @classmethod
    def _next_page_token(cls, payload: object | None) -> str | None:
        result = cls._mapping(cls._mapping(payload).get("result"))
        paging = cls._mapping(result.get("paging"))
        return cls._optional_string(paging.get("nextPageToken"))

    @classmethod
    def _extract_result_items(cls, payload: object | None, key: str) -> list[dict[str, object]]:
        result = cls._mapping(cls._mapping(payload).get("result"))
        value = result.get(key)
        if not isinstance(value, list):
            return []
        return [cast(dict[str, object], item) for item in cast(list[object], value) if isinstance(item, dict)]

    @classmethod
    def _token_scopes(cls, payload: object | None) -> list[str]:
        result = cls._mapping(cls._mapping(payload).get("result"))
        api_key = cls._mapping(result.get("apiKey"))
        value = api_key.get("authScopes")
        if not isinstance(value, list):
            return []
        return [str(item).strip().upper() for item in cast(list[object], value) if str(item).strip()]

    @classmethod
    def _question_answer_items(
        cls, payload: object | None
    ) -> list[dict[str, object]] | None:
        if not isinstance(payload, dict):
            return None
        result = payload.get("result")
        if not isinstance(result, dict):
            return None
        answers = result.get("answers")
        if not isinstance(answers, list):
            return None
        if not all(isinstance(item, dict) for item in answers):
            return None
        return [cast(dict[str, object], item) for item in answers]

    @staticmethod
    def _question_reply_state_result(
        state: YandexQuestionReplyState,
        *,
        answer_id: str | None = None,
    ) -> AdapterResult:
        return AdapterResult(ok=True, data={"state": state, "answer_id": answer_id})

    @classmethod
    def _is_business_authored(cls, item: dict[str, object]) -> bool:
        author = cls._mapping(item.get("author"))
        return str(author.get("type") or "").upper() in {"BUSINESS", "BRAND"}

    @staticmethod
    def _response_status(payload: object | None) -> str | None:
        if not isinstance(payload, dict):
            return None
        return str(cast(dict[str, object], payload).get("status") or "").upper() or None

    @staticmethod
    def _safe_json(response: httpx.Response) -> object:
        try:
            payload: object = response.json()
            return payload
        except ValueError:
            return {"text": response.text[:500]}

    @staticmethod
    def _business_id(value: str | None) -> int | None:
        return YandexMarketAdapter._positive_int(value)

    @staticmethod
    def _positive_int(value: object) -> int | None:
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    @staticmethod
    def _invalid_business_id() -> AdapterResult:
        return AdapterResult(
            False,
            error_code="invalid_account_identifier",
            error_message_safe="Yandex Market business ID must be a positive integer",
        )

    @staticmethod
    def _invalid_external_id(entity: str) -> AdapterResult:
        return AdapterResult(
            False,
            error_code="invalid_external_id",
            error_message_safe=f"Yandex Market {entity} ID is invalid",
        )

    @staticmethod
    def _mapping(value: object | None) -> dict[str, object]:
        return cast(dict[str, object], value) if isinstance(value, dict) else {}

    @staticmethod
    def _string(value: object) -> str:
        return "" if value is None else str(value).strip()

    @staticmethod
    def _optional_string(value: object) -> str | None:
        text = YandexMarketAdapter._string(value)
        return text or None

    @staticmethod
    def _prefixed(label: str, value: object) -> str | None:
        text = YandexMarketAdapter._optional_string(value)
        return f"{label}: {text}" if text else None

    @classmethod
    def _media(cls, value: object) -> list[object]:
        if isinstance(value, list):
            return cast(list[object], value)
        if not isinstance(value, dict):
            return []
        result: list[object] = []
        for nested in cast(dict[str, object], value).values():
            if isinstance(nested, list):
                result.extend(cast(list[object], nested))
        return result

    @staticmethod
    def _datetime(value: object) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError:
                pass
        return datetime.now(UTC)

    @staticmethod
    def _int_or_none(value: object) -> int | None:
        try:
            return int(str(value))
        except (TypeError, ValueError):
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
