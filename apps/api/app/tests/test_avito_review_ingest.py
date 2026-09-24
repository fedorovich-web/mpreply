from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from datetime import UTC, datetime
from types import TracebackType
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ClauseElement

from app.adapters.base import MarketplacePage, NormalizedMessage, ProviderMessageResolution
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, MessageType
from app.models.marketplace_account import MarketplaceAccount
from app.services.marketplace_ingest_service import InvalidNormalizedRecord, MarketplaceIngestService

_NOW = datetime(2026, 9, 24, tzinfo=UTC)


class _Savepoint(AbstractAsyncContextManager[None]):
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> bool:
        return False


class _Session:
    def __init__(self, messages: list[CustomerMessage] | None = None, reply_message_ids: set[UUID] | None = None) -> None:
        self.messages = messages or []
        self.reply_message_ids = reply_message_ids or set()
        self.pending: CustomerMessage | None = None

    def begin_nested(self) -> _Savepoint:
        return _Savepoint()

    def add(self, value: object) -> None:
        assert isinstance(value, CustomerMessage)
        value.id = uuid4()
        self.pending = value

    async def flush(self) -> None:
        assert self.pending is not None
        self.messages.append(self.pending)
        self.pending = None

    async def scalar(self, statement: object) -> object | None:
        compiled = cast(ClauseElement, statement).compile()
        values = set(cast(dict[str, object], compiled.params).values())
        sql = str(compiled)
        if "FROM replies" in sql:
            assert "replies.organization_id" in sql and "replies.message_id" in sql
            return uuid4() if any(message_id in values for message_id in self.reply_message_ids) else None
        assert "customer_messages.organization_id" in sql
        assert "customer_messages.marketplace_account_id" in sql
        assert "customer_messages.external_id" in sql
        for message in self.messages:
            if {message.organization_id, message.marketplace_account_id, message.external_id}.issubset(values):
                return message
        return None


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        display_name="Synthetic Avito",
        seller_id="123",
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        credentials_status="valid",
        scopes_json={},
    )


def _review(review_id: str = "92312343") -> NormalizedMessage:
    return NormalizedMessage(
        external_id=review_id,
        message_type=MessageType.REVIEW,
        rating=5,
        customer_display_name=None,
        customer_text="",
        customer_photos=(),
        marketplace_created_at=_NOW,
        product=None,
        metadata={"source": "avito.reviews"},
    )


def _existing(account: MarketplaceAccount, review_id: str, status: MessageStatus = MessageStatus.NEEDS_REPLY) -> CustomerMessage:
    return CustomerMessage(
        id=uuid4(),
        organization_id=account.organization_id,
        marketplace_account_id=account.id,
        marketplace=Marketplace.AVITO.value,
        external_id=review_id,
        type=MessageType.REVIEW.value,
        status=status.value,
        customer_text="",
        marketplace_created_at=_NOW,
        imported_at=_NOW,
        last_synced_at=_NOW,
        metadata_json={},
    )


@pytest.mark.asyncio
async def test_avito_review_with_empty_text_and_no_item_is_inserted_without_fabrication() -> None:
    account = _account()
    session = _Session()
    stats = await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(account, MarketplacePage(items=(_review(),), next_cursor=None), _NOW)

    assert stats.created_messages == 1
    assert len(session.messages) == 1
    assert session.messages[0].product_id is None
    assert session.messages[0].customer_text == ""


@pytest.mark.asyncio
async def test_provider_resolutions_update_only_untouched_same_account_reviews() -> None:
    account = _account()
    other = _account()
    published = _existing(account, "1")
    blocked = _existing(account, "2")
    queued = _existing(account, "3")
    other_tenant = _existing(other, "1")
    session = _Session([published, blocked, queued, other_tenant], {queued.id})
    page = MarketplacePage(
        items=(),
        next_cursor=None,
        resolutions=(
            ProviderMessageResolution("1", MessageType.REVIEW, MessageStatus.ANSWERED),
            ProviderMessageResolution("2", MessageType.REVIEW, MessageStatus.BLOCKED_BY_MARKETPLACE),
            ProviderMessageResolution("3", MessageType.REVIEW, MessageStatus.ANSWERED),
            ProviderMessageResolution("4", MessageType.REVIEW, MessageStatus.ANSWERED),
        ),
    )

    await MarketplaceIngestService(cast(AsyncSession, session)).ingest_page(account, page, _NOW)

    assert published.status == MessageStatus.ANSWERED.value
    assert blocked.status == MessageStatus.BLOCKED_BY_MARKETPLACE.value
    assert queued.status == MessageStatus.NEEDS_REPLY.value
    assert other_tenant.status == MessageStatus.NEEDS_REPLY.value
    assert len(session.messages) == 4


@pytest.mark.asyncio
async def test_non_avito_review_still_requires_nonempty_text_and_product() -> None:
    account = _account()
    account.marketplace = Marketplace.WILDBERRIES.value
    with pytest.raises(InvalidNormalizedRecord):
        await MarketplaceIngestService(cast(AsyncSession, _Session())).ingest_page(account, MarketplacePage(items=(_review(),), next_cursor=None), _NOW)
