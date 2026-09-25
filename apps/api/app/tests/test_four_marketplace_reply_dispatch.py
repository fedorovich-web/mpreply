from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast

import pytest

from app.adapters.base import AdapterResult, MarketplaceAdapter, ProviderMessageContext
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.models.reply import Reply
from app.services.reply_execution_service import ReplyExecutionService


class _Adapter(MarketplaceAdapter):
    marketplace = "test"

    def __init__(self) -> None:
        self.calls: list[tuple[object, ...]] = []
        self.preflight = AdapterResult(ok=True, data={"answered": False})

    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        return AdapterResult(ok=True)

    async def fetch_reviews(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return AdapterResult(ok=True, data=[])

    async def fetch_questions(
        self, credential: str, cursor: str | None = None, seller_id: str | None = None
    ) -> AdapterResult:
        return AdapterResult(ok=True, data=[])

    def extract_reviews(self, payload: object | None) -> list[dict[str, object]]:
        return []

    def extract_questions(self, payload: object | None) -> list[dict[str, object]]:
        return []

    def normalize_review(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    def normalize_question(self, raw: dict[str, object]) -> dict[str, object]:
        return raw

    async def send_review_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.calls.append(("review", credential, external_id, reply_text, seller_id, context))
        return AdapterResult(ok=True, data={"id": "review-reply"})

    async def send_question_reply(
        self,
        credential: str,
        external_id: str,
        reply_text: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.calls.append(("question", credential, external_id, reply_text, seller_id, context))
        return AdapterResult(ok=True, data={"id": "question-reply"})

    async def has_existing_reply(
        self,
        credential: str,
        message_type: str,
        external_id: str,
        seller_id: str | None = None,
        *,
        context: ProviderMessageContext | None = None,
    ) -> AdapterResult:
        self.calls.append(("preflight", credential, message_type, external_id, seller_id, context))
        return self.preflight

    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult:
        return AdapterResult(ok=True, data=[])

    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult:
        return AdapterResult(ok=True, data=[])

    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult:
        return AdapterResult(ok=True)

    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult:
        self.calls.append(("chat-preflight", credential, user_id, chat_id, inbound_created_unix))
        return self.preflight

    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult:
        self.calls.append(("chat-send", credential, user_id, chat_id, text))
        return AdapterResult(ok=True, data={"id": "chat-reply"})

    def map_error(self, status_code: int, payload: object | None = None) -> AdapterResult:
        return AdapterResult(ok=False, error_code=str(status_code))


def _message(
    *,
    message_type: str,
    external_id: str = "external-1",
    metadata: dict[str, object] | None = None,
) -> CustomerMessage:
    return cast(
        CustomerMessage,
        SimpleNamespace(
            type=message_type,
            external_id=external_id,
            metadata_json=metadata or {},
        ),
    )


def _reply(text: str = "Reply text") -> Reply:
    return cast(Reply, SimpleNamespace(reply_text=text, metadata_json={}))


def test_registry_dispatches_all_four_marketplace_adapters() -> None:
    expected = {
        Marketplace.WILDBERRIES: "WildberriesAdapter",
        Marketplace.OZON: "OzonAdapter",
        Marketplace.YANDEX_MARKET: "YandexMarketAdapter",
        Marketplace.AVITO: "AvitoAdapter",
    }
    for marketplace, class_name in expected.items():
        account = cast(MarketplaceAccount, SimpleNamespace(marketplace=marketplace.value))
        assert ReplyExecutionService._adapter_for(account).__class__.__name__ == class_name


@pytest.mark.asyncio
async def test_review_dispatch_forwards_seller_id_and_persisted_provider_context() -> None:
    service = object.__new__(ReplyExecutionService)
    adapter = _Adapter()
    message = _message(
        message_type=MessageType.REVIEW.value,
        metadata={"ozon_sku": "SKU-42", "source": "test"},
    )

    result = await service._send_through_adapter(
        adapter=adapter,
        credential="credential",
        seller_id="client-123",
        message=message,
        reply=_reply(),
    )

    assert result.ok is True
    assert adapter.calls == [
        ("review", "credential", "external-1", "Reply text", "client-123", message.metadata_json)
    ]


@pytest.mark.asyncio
async def test_avito_chat_preflight_and_send_use_persisted_chat_context() -> None:
    service = object.__new__(ReplyExecutionService)
    adapter = _Adapter()
    message = _message(
        message_type=MessageType.CHAT.value,
        metadata={"avito_chat_id": "chat-7", "avito_inbound_created_unix": 1_777_000_000},
    )

    preflight = await service._preflight_answer_state(
        adapter=adapter,
        credential="credential",
        seller_id="123456",
        message=message,
    )
    result = await service._send_through_adapter(
        adapter=adapter,
        credential="credential",
        seller_id="123456",
        message=message,
        reply=_reply("Chat reply"),
    )

    assert preflight.answered is False
    assert preflight.failure is None
    assert result.ok is True
    assert adapter.calls == [
        ("chat-preflight", "credential", "123456", "chat-7", 1_777_000_000),
        ("chat-send", "credential", "123456", "chat-7", "Chat reply"),
    ]


@pytest.mark.asyncio
async def test_read_only_preflight_failure_is_returned_instead_of_sending() -> None:
    service = object.__new__(ReplyExecutionService)
    adapter = _Adapter()
    adapter.preflight = AdapterResult(
        ok=False,
        error_code="rate_limited",
        error_message_safe="Marketplace rate limit exceeded",
        retry_after_seconds=17,
    )

    result = await service._preflight_answer_state(
        adapter=adapter,
        credential="credential",
        seller_id="seller",
        message=_message(message_type=MessageType.QUESTION.value),
    )

    assert result.answered is None
    assert result.failure is adapter.preflight


def test_ozon_scope_guard_requires_matching_read_and_write_scopes() -> None:
    message = _message(message_type=MessageType.REVIEW.value)
    account = cast(
        MarketplaceAccount,
        SimpleNamespace(
            marketplace=Marketplace.OZON.value,
            status="active",
            credentials_status="valid",
            scopes_json={"validated": True, "scopes": ["fetch_reviews", "send_review_reply"]},
        ),
    )
    assert ReplyExecutionService._ozon_message_scope_is_allowed(account=account, message=message) is True

    account.scopes_json = {"validated": True, "scopes": ["fetch_reviews"]}
    assert ReplyExecutionService._ozon_message_scope_is_allowed(account=account, message=message) is False


@pytest.mark.asyncio
async def test_yandex_question_reconciliation_allows_only_confirmed_absence() -> None:
    service = object.__new__(ReplyExecutionService)
    reply = _reply()

    class _Yandex:
        async def reconcile_question_reply(
            self, credential: str, external_id: str, seller_id: str | None = None
        ) -> AdapterResult:
            assert (credential, external_id, seller_id) == ("credential", "77", "42")
            return AdapterResult(ok=True, data={"state": "ABSENT"})

    authorization = await service._authorize_yandex_question_write(
        adapter=cast(YandexMarketAdapter, _Yandex()),
        credential="credential",
        seller_id="42",
        message=_message(message_type=MessageType.QUESTION.value, external_id="77"),
        reply=reply,
    )

    assert authorization.allowed is True
    assert authorization.state == "ABSENT"


def test_outbound_ambiguity_marker_blocks_automatic_avito_resend() -> None:
    reply = _reply()
    ReplyExecutionService._record_outbound_send_ambiguity(
        reply=reply,
        marketplace=Marketplace.AVITO.value,
        error_code="network_timeout",
        now=datetime.now(UTC),
    )
    assert ReplyExecutionService._has_outbound_send_ambiguity(
        reply,
        marketplace=Marketplace.AVITO.value,
    ) is True
