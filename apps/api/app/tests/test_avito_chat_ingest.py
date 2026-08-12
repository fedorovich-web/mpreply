from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal, cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.conversation import AvitoChat, AvitoMessage
from app.models.customer_message import CustomerMessage
from app.models.enums import Marketplace, MessageStatus, ReplyStatus, ResponseMode
from app.models.marketplace_account import MarketplaceAccount
from app.models.product import Product
from app.models.reply import Reply
from app.services.avito_chat_ingest_service import AvitoChatIngestService


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def all(self) -> list[object]:
        return self._values


class _Result:
    def __init__(self, values: list[object]) -> None:
        self._values = values

    def scalar_one_or_none(self) -> object | None:
        if len(self._values) > 1:
            raise AssertionError("scalar query returned multiple test rows")
        return self._values[0] if self._values else None

    def scalars(self) -> _Scalars:
        return _Scalars(self._values)


_Rows = list[object] | Callable[["_Session"], list[object]]


class _Session:
    def __init__(self, execute_results: list[_Rows]) -> None:
        self.execute_results = list(execute_results)
        self.added: list[object] = []
        self.statements: list[object] = []
        self.flush_count = 0

    async def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        if "FROM marketplace_accounts" in str(statement):
            return _Result([])
        if not self.execute_results:
            raise AssertionError("unexpected database query")
        configured = self.execute_results.pop(0)
        values = configured(self) if callable(configured) else configured
        if values and all(isinstance(value, Reply) for value in values):
            query_text = str(
                cast(Select[tuple[object]], statement).compile(
                    dialect=postgresql.dialect(),
                    compile_kwargs={"literal_binds": True},
                )
            )
            excluded = query_text.partition("NOT IN")[2]
            values = [
                value
                for value in values
                if not isinstance(value, Reply) or f"'{value.status}'" not in excluded
            ]
        return _Result(values)

    def add(self, value: object) -> None:
        if isinstance(value, (CustomerMessage, Product)) and getattr(value, "id", None) is None:
            value.id = uuid4()
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


def _added_messages(session: _Session) -> list[CustomerMessage]:
    return [value for value in session.added if isinstance(value, CustomerMessage)]


def _current_message(session: _Session) -> list[object]:
    return cast(list[object], _added_messages(session)[-1:])


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        display_name="Synthetic Avito account",
        seller_id="123456",
        credentials_encrypted="synthetic-token",
        credentials_fingerprint="fingerprint",
        status="active",
        credentials_status="valid",
        scopes_json={"validated": True, "scopes": ["fetch_chats"]},
        default_response_mode=ResponseMode.AUTO.value,
        error_count=0,
    )


def _chat(
    *,
    chat_type: str | None = "u2u",
    item_id: int | None = None,
    item_title: str | None = None,
    item_url: str | None = None,
) -> AvitoChat:
    return AvitoChat(
        id="chat-123",
        created_unix=1_700_000_000,
        updated_unix=1_700_000_200,
        chat_type=chat_type,
        item_id=item_id,
        item_title=item_title,
        item_url=item_url,
        customer_id=654321,
        customer_name="Synthetic customer",
    )


def _message(
    message_id: str,
    created_unix: int,
    *,
    direction: Literal["in", "out"] = "in",
    is_read: bool = False,
    kind: str = "text",
    text: str | None = "Synthetic message",
    author_id: int = 654321,
) -> AvitoMessage:
    return AvitoMessage(
        id=message_id,
        author_id=author_id,
        created_unix=created_unix,
        direction=direction,
        is_read=is_read,
        read_unix=None,
        kind=kind,
        text=text,
    )


def _stored_message(
    account: MarketplaceAccount,
    *,
    external_id: str,
    status: str = MessageStatus.NEEDS_REPLY.value,
    organization_id: UUID | None = None,
) -> CustomerMessage:
    now = datetime(2026, 8, 12, 8, 0, tzinfo=UTC)
    return CustomerMessage(
        id=uuid4(),
        organization_id=organization_id if organization_id is not None else account.organization_id,
        marketplace_account_id=account.id,
        product_id=None,
        marketplace=Marketplace.AVITO.value,
        external_id=external_id,
        type="chat",
        status=status,
        rating=None,
        customer_display_name="Synthetic customer",
        customer_text="Older synthetic message",
        customer_photos_json=[],
        marketplace_created_at=now,
        imported_at=now,
        last_synced_at=now,
        priority="normal",
        metadata_json={"avito_chat_id": "chat-123"},
    )


@pytest.mark.asyncio
async def test_ingest_turn_groups_after_latest_outbound_and_persists_exact_context() -> None:
    account = _account()
    older = _stored_message(account, external_id="older-turn")
    foreign = _stored_message(account, external_id="foreign-turn", organization_id=uuid4())
    session = _Session([[older], [], [], [], _current_message])
    service = AvitoChatIngestService(cast(AsyncSession, session))
    chat = _chat(
        chat_type="u2i",
        item_id=987654,
        item_title="Synthetic item",
        item_url="https://example.invalid/items/987654",
    )

    result = await service.ingest_turn(
        account=account,
        chat=chat,
        messages=[
            _message("in-2", 1_700_000_120, text="Second", author_id=654322),
            _message("before-out", 1_700_000_090, text="Ignored"),
            _message("out-1", 1_700_000_100, direction="out", is_read=True, text="Prior reply", author_id=123456),
            _message("in-1", 1_700_000_110, text="First", author_id=654321),
        ],
    )

    created = _added_messages(session)[0]
    product = next(value for value in session.added if isinstance(value, Product))
    assert result.outcome == "created"
    assert result.message_id == created.id
    assert result.can_mark_read is True
    assert created.external_id == "in-2"
    assert created.customer_text == "First\nSecond"
    assert created.marketplace_created_at == datetime.fromtimestamp(1_700_000_120, tz=UTC)
    assert created.product_id == product.id
    assert product.external_id == "987654"
    assert product.name == "Synthetic item"
    assert product.product_url == "https://example.invalid/items/987654"
    assert created.metadata_json == {
        "avito_chat_id": "chat-123",
        "avito_chat_type": "u2i",
        "avito_source_message_ids": ["in-1", "in-2"],
        "avito_source_author_ids": [654321, 654322],
        "avito_source_created_unix": [1_700_000_110, 1_700_000_120],
        "avito_inbound_created_unix": 1_700_000_120,
        "avito_item_id": 987654,
        "avito_item_title": "Synthetic item",
        "avito_item_url": "https://example.invalid/items/987654",
    }
    assert older.status == MessageStatus.ARCHIVED.value
    assert foreign.status == MessageStatus.NEEDS_REPLY.value
    query_text = next(
        str(
            cast(Select[tuple[CustomerMessage]], statement).compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        for statement in session.statements
        if "avito_chat_id"
        in str(
            cast(Select[tuple[CustomerMessage]], statement).compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
    )
    assert "customer_messages.organization_id" in query_text
    assert "customer_messages.marketplace_account_id" in query_text
    assert str(account.organization_id) in query_text
    assert str(account.id) in query_text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "chat",
    [
        _chat(chat_type="u2u"),
        _chat(chat_type="a2u"),
        _chat(chat_type="u2i", item_id=0, item_title="Synthetic item"),
        _chat(chat_type="u2i", item_id=987654, item_title=None),
    ],
)
async def test_chat_without_valid_u2i_context_never_creates_unknown_product(chat: AvitoChat) -> None:
    account = _account()
    session = _Session([[], [], [], _current_message])
    service = AvitoChatIngestService(cast(AsyncSession, session))

    result = await service.ingest_turn(
        account=account,
        chat=chat,
        messages=[_message("in-1", 1_700_000_110)],
    )

    created = _added_messages(session)[0]
    assert result.outcome == "created"
    assert created.product_id is None
    assert not any(isinstance(value, Product) for value in session.added)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_message",
    [
        _message("image-1", 1_700_000_110, kind="image", text=None),
        _message("missing-text", 1_700_000_110, text=None),
        _message("negative-time", -1),
        _message("overflow-time", 10**30),
    ],
)
async def test_unsupported_or_malformed_unread_inbound_blocks_ingest_and_read(
    bad_message: AvitoMessage,
) -> None:
    session = _Session([])
    service = AvitoChatIngestService(cast(AsyncSession, session))

    result = await service.ingest_turn(account=_account(), chat=_chat(), messages=[bad_message])

    assert result.outcome == "skipped"
    assert result.message_id is None
    assert result.can_mark_read is False
    assert session.added == []
    assert session.statements == []


@pytest.mark.asyncio
@pytest.mark.parametrize("reply_status", [ReplyStatus.QUEUED.value, ReplyStatus.FAILED.value])
async def test_nonterminal_reply_routes_new_turn_to_manual_review_without_archiving_active_target(
    reply_status: str,
) -> None:
    account = _account()
    older = _stored_message(account, external_id="older-turn")
    reply = Reply(
        id=uuid4(),
        organization_id=account.organization_id,
        message_id=older.id,
        reply_text="Pending synthetic reply",
        status=reply_status,
        mode=ResponseMode.AUTO.value,
        revision=1,
        attempt_count=0,
        max_attempts=4,
        metadata_json={},
    )
    session = _Session([[older], [reply], [], _current_message])
    service = AvitoChatIngestService(cast(AsyncSession, session))

    result = await service.ingest_turn(
        account=account,
        chat=_chat(),
        messages=[_message("in-2", 1_700_000_120, text="New turn")],
    )

    created = _added_messages(session)[0]
    assert result.outcome == "manual_review"
    assert result.message_id == created.id
    assert result.can_mark_read is True
    assert created.status == MessageStatus.NEEDS_MANUAL_CHECK.value
    assert older.status == MessageStatus.NEEDS_REPLY.value


@pytest.mark.asyncio
async def test_account_lock_serializes_chat_snapshots_before_target_lookup() -> None:
    account = _account()
    session = _Session(
        [
            [],
            [],
            [],
            _current_message,
            lambda current: cast(list[object], _added_messages(current)),
            [],
            [],
            _current_message,
        ]
    )
    service = AvitoChatIngestService(cast(AsyncSession, session))

    first = await service.ingest_turn(
        account=account,
        chat=_chat(),
        messages=[_message("snapshot-1", 1_700_000_110, text="First snapshot")],
    )
    second = await service.ingest_turn(
        account=account,
        chat=_chat(),
        messages=[_message("snapshot-2", 1_700_000_120, text="Second snapshot")],
    )

    stored = _added_messages(session)
    assert first.outcome == "created"
    assert second.outcome == "created"
    assert [message.status for message in stored] == [
        MessageStatus.ARCHIVED.value,
        MessageStatus.NEEDS_REPLY.value,
    ]
    statement_sql = [
        str(
            cast(Select[tuple[object]], statement).compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        for statement in session.statements
    ]
    lock_indexes = [index for index, sql in enumerate(statement_sql) if "FROM marketplace_accounts" in sql]
    target_indexes = [
        index
        for index, sql in enumerate(statement_sql)
        if "FROM customer_messages" in sql and "avito_chat_id" in sql
    ]
    assert len(lock_indexes) == len(target_indexes) == 2
    assert all(statement_sql[index].endswith("FOR UPDATE") for index in lock_indexes)
    assert all(lock_index < target_index for lock_index, target_index in zip(lock_indexes, target_indexes, strict=True))


@pytest.mark.asyncio
async def test_chat_reingest_replaces_avito_owned_metadata_and_removes_stale_item_context() -> None:
    account = _account()
    existing = _stored_message(account, external_id="same-turn")
    existing.product_id = uuid4()
    existing.metadata_json = {
        "avito_chat_id": "chat-123",
        "avito_chat_type": "u2i",
        "avito_source_message_ids": ["same-turn"],
        "avito_source_author_ids": [654321],
        "avito_source_created_unix": [1_700_000_110],
        "avito_inbound_created_unix": 1_700_000_110,
        "avito_item_id": 987654,
        "avito_item_title": "Stale item",
        "avito_item_url": "https://example.invalid/items/987654",
        "preserved_key": "keep",
    }
    session = _Session([[existing], [], [existing], [existing]])
    service = AvitoChatIngestService(cast(AsyncSession, session))

    result = await service.ingest_turn(
        account=account,
        chat=_chat(chat_type="u2u"),
        messages=[_message("same-turn", 1_700_000_120, text="Updated turn")],
    )

    assert result.outcome == "updated"
    assert existing.product_id is None
    assert existing.metadata_json == {
        "preserved_key": "keep",
        "avito_chat_id": "chat-123",
        "avito_chat_type": "u2u",
        "avito_source_message_ids": ["same-turn"],
        "avito_source_author_ids": [654321],
        "avito_source_created_unix": [1_700_000_120],
        "avito_inbound_created_unix": 1_700_000_120,
    }


@pytest.mark.asyncio
async def test_repeated_ingestion_updates_same_provider_turn_without_duplicate() -> None:
    account = _account()
    session = _Session(
        [
            [],
            [],
            [],
            _current_message,
            [],
            [],
            lambda current: cast(list[object], _added_messages(current)),
            _current_message,
        ]
    )
    service = AvitoChatIngestService(cast(AsyncSession, session))
    messages = [_message("in-1", 1_700_000_110, text="Synthetic turn")]

    first = await service.ingest_turn(account=account, chat=_chat(), messages=messages)
    second = await service.ingest_turn(account=account, chat=_chat(), messages=messages)

    assert first.outcome == "created"
    assert second.outcome == "updated"
    assert first.message_id == second.message_id
    assert len(_added_messages(session)) == 1
