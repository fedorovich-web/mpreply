from __future__ import annotations

from types import SimpleNamespace
from typing import cast

import pytest
from fastapi import HTTPException

from app.adapters.base import AdapterResult, MarketplaceAdapter
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageType
from app.models.reply import Reply
from app.services.marketplace_account_service import normalize_marketplace_seller_id
from app.services.reply_execution_service import ReplyExecutionService


class _ReplyAdapter(MarketplaceAdapter):
    marketplace = Marketplace.YANDEX_MARKET.value

    def __init__(self) -> None:
        self.calls: list[tuple[object, ...]] = []

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        return AdapterResult(ok=True)

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return AdapterResult(ok=True)

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return AdapterResult(ok=True)

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return []

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return []

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    async def send_review_reply(
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        self.calls.append(("review", credential, external_id, reply_text, seller_id))
        return AdapterResult(ok=True)

    async def send_question_reply(
        self, credential: str, external_id: str, reply_text: str, seller_id: str | None = None
    ) -> AdapterResult:
        self.calls.append(("question", credential, external_id, reply_text, seller_id))
        return AdapterResult(ok=True)

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        self.calls.append(("preflight", credential, message_type, external_id, seller_id))
        return AdapterResult(ok=True, data={"answered": True})

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        return AdapterResult(ok=False, error_code=str(status_code))


class _ReplyServiceHarness(ReplyExecutionService):
    async def preflight_answer_status_for_test(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
    ) -> bool | None:
        return await self._preflight_answer_status(
            adapter=adapter,
            credential=credential,
            seller_id=seller_id,
            message=message,
        )

    async def send_through_adapter_for_test(
        self,
        *,
        adapter: MarketplaceAdapter,
        credential: str,
        seller_id: str | None,
        message: CustomerMessage,
        reply: Reply,
    ) -> AdapterResult:
        return await self._send_through_adapter(
            adapter=adapter,
            credential=credential,
            seller_id=seller_id,
            message=message,
            reply=reply,
        )


def test_yandex_market_requires_positive_business_id() -> None:
    assert normalize_marketplace_seller_id(Marketplace.YANDEX_MARKET.value, " 123 ") == "123"

    for invalid in (None, "", "0", "-1", "business"):
        with pytest.raises(HTTPException) as exc_info:
            normalize_marketplace_seller_id(Marketplace.YANDEX_MARKET.value, invalid)
        assert exc_info.value.status_code == 400


def test_other_marketplaces_keep_optional_seller_id() -> None:
    assert normalize_marketplace_seller_id(Marketplace.WILDBERRIES.value, None) is None
    assert normalize_marketplace_seller_id(Marketplace.WILDBERRIES.value, " seller ") == "seller"


@pytest.mark.asyncio
async def test_reply_service_passes_marketplace_account_identifier_to_generic_adapter() -> None:
    service = object.__new__(_ReplyServiceHarness)
    adapter = _ReplyAdapter()
    message = cast(
        CustomerMessage,
        SimpleNamespace(type=MessageType.QUESTION.value, external_id="77"),
    )
    reply = cast(Reply, SimpleNamespace(reply_text="Ответ"))

    answered = await service.preflight_answer_status_for_test(
        adapter=adapter,
        credential="secret",
        seller_id="900",
        message=message,
    )
    send_result = await service.send_through_adapter_for_test(
        adapter=adapter,
        credential="secret",
        seller_id="900",
        message=message,
        reply=reply,
    )

    assert answered is True
    assert send_result.ok is True
    assert adapter.calls == [
        ("preflight", "secret", MessageType.QUESTION.value, "77", "900"),
        ("question", "secret", "77", "Ответ", "900"),
    ]
