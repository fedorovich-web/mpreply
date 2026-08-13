from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import CheckConstraint, Select, Table
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_entry import KnowledgeEntry
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.user import User
from app.schemas.knowledge_entry import KnowledgeEntryCreateRequest, KnowledgeEntryUpdateRequest
from app.services.knowledge_entry_service import KnowledgeEntryService


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _Scalars:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values


class _RowsResult:
    def __init__(self, values: Sequence[object]) -> None:
        self.values = list(values)

    def scalars(self) -> _Scalars:
        return _Scalars(self.values)


class _FakeSession:
    def __init__(self, results: Sequence[object]) -> None:
        self.results = list(results)
        self.statements: list[object] = []
        self.added: list[object] = []

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        if not self.results:
            raise AssertionError("Unexpected database query")
        return self.results.pop(0)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        return None


def _user() -> User:
    return User(
        id=uuid4(),
        email="owner@example.com",
        name="Owner",
        password_hash="hashed",
        status="active",
        is_superadmin=False,
    )


def _membership(*, organization_id: UUID, user_id: UUID, role: str) -> OrganizationUser:
    return OrganizationUser(
        id=uuid4(),
        organization_id=organization_id,
        user_id=user_id,
        role=role,
        status="active",
    )


def _entry(
    *,
    organization_id: UUID,
    title: str,
    content: str,
    marketplace_account_id: UUID | None = None,
    product_id: UUID | None = None,
    status: str = "active",
    updated_at: datetime | None = None,
) -> KnowledgeEntry:
    timestamp = updated_at or datetime.now(UTC)
    return KnowledgeEntry(
        id=uuid4(),
        organization_id=organization_id,
        marketplace_account_id=marketplace_account_id,
        product_id=product_id,
        category="product" if product_id else "company",
        title=title,
        content=content,
        status=status,
        created_at=timestamp,
        updated_at=timestamp,
    )


def test_knowledge_request_normalizes_fields_and_rejects_unknown_values() -> None:
    payload = KnowledgeEntryCreateRequest(
        category="delivery",
        title="  Сроки доставки  ",
        content="  Срок зависит от региона покупателя.  ",
        status="active",
    )

    assert payload.title == "Сроки доставки"
    assert payload.content == "Срок зависит от региона покупателя."
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest.model_validate({"category": "pricing", "title": "Цена", "content": "Текст"})
    with pytest.raises(ValidationError):
        KnowledgeEntryUpdateRequest.model_validate({"status": "deleted"})
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest.model_validate(
            {"category": "company", "title": "Правила", "content": "Текст", "secret": True}
        )


def test_knowledge_request_enforces_meaningful_title_and_content_bounds() -> None:
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest(category="company", title=" ", content="Текст")
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest(category="company", title="Заголовок", content=" ")
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest(category="company", title="x" * 161, content="Текст")
    with pytest.raises(ValidationError):
        KnowledgeEntryCreateRequest(category="company", title="Заголовок", content="x" * 12001)


def test_knowledge_model_has_scope_and_status_integrity_constraints() -> None:
    table = cast(Table, KnowledgeEntry.__table__)
    constraints = " ".join(
        str(constraint.sqltext)
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    )

    assert "knowledge_entries" in table.name
    assert "draft" in constraints and "active" in constraints and "archived" in constraints
    assert "product_id" in constraints and "marketplace_account_id" in constraints


@pytest.mark.asyncio
async def test_create_rejects_cross_tenant_account_before_write() -> None:
    organization_id = uuid4()
    actor = _user()
    foreign_account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="wildberries",
        display_name="Foreign",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
    )
    session = _FakeSession(
        [
            _ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner")),
            _ScalarResult(foreign_account),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await KnowledgeEntryService(cast(AsyncSession, session)).create(
            organization_id=organization_id,
            actor=actor,
            payload=KnowledgeEntryCreateRequest(
                category="company",
                title="Правила",
                content="Только подтверждённые сведения.",
                marketplace_account_id=foreign_account.id,
            ),
        )

    assert exc_info.value.status_code == 404
    assert session.added == []


@pytest.mark.asyncio
async def test_create_rejects_cross_tenant_product_before_write() -> None:
    organization_id = uuid4()
    actor = _user()
    product = Product(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace_account_id=uuid4(),
        marketplace="wildberries",
        external_id="sku-1",
        name="Товар",
    )
    session = _FakeSession(
        [
            _ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="admin")),
            _ScalarResult(product),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await KnowledgeEntryService(cast(AsyncSession, session)).create(
            organization_id=organization_id,
            actor=actor,
            payload=KnowledgeEntryCreateRequest(
                category="product",
                title="Состав",
                content="Состав указан на упаковке.",
                product_id=product.id,
            ),
        )

    assert exc_info.value.status_code == 404
    assert session.added == []


@pytest.mark.asyncio
async def test_viewer_can_list_but_cannot_write() -> None:
    organization_id = uuid4()
    actor = _user()
    membership = _membership(organization_id=organization_id, user_id=actor.id, role="viewer")
    list_session = _FakeSession([_ScalarResult(membership), _RowsResult([])])

    rows = await KnowledgeEntryService(cast(AsyncSession, list_session)).list_for_actor(
        organization_id=organization_id,
        actor=actor,
        search=None,
        status=None,
        category=None,
    )

    assert rows == []
    write_session = _FakeSession([_ScalarResult(membership)])
    with pytest.raises(HTTPException) as exc_info:
        await KnowledgeEntryService(cast(AsyncSession, write_session)).create(
            organization_id=organization_id,
            actor=actor,
            payload=KnowledgeEntryCreateRequest(category="company", title="Правила", content="Текст"),
        )
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_context_orders_product_account_global_and_newest_first() -> None:
    organization_id = uuid4()
    account_id = uuid4()
    product_id = uuid4()
    now = datetime.now(UTC)
    rows = [
        _entry(organization_id=organization_id, title="Компания", content="Общие сведения", updated_at=now),
        _entry(
            organization_id=organization_id,
            marketplace_account_id=account_id,
            title="Кабинет",
            content="Правила кабинета",
            updated_at=now - timedelta(minutes=1),
        ),
        _entry(
            organization_id=organization_id,
            product_id=product_id,
            title="Состав",
            content="Хлопок",
            updated_at=now - timedelta(minutes=2),
        ),
        _entry(
            organization_id=organization_id,
            product_id=product_id,
            title="Размер",
            content="Соответствует сетке",
            updated_at=now,
        ),
    ]
    session = _FakeSession([_RowsResult(rows)])

    context = await KnowledgeEntryService(cast(AsyncSession, session)).context_for_message(
        organization_id=organization_id,
        marketplace_account_id=account_id,
        product_id=product_id,
    )

    assert context is not None
    assert context.index("Размер") < context.index("Состав") < context.index("Кабинет") < context.index("Компания")


@pytest.mark.asyncio
async def test_context_excludes_archived_and_unrelated_scopes_in_query() -> None:
    organization_id = uuid4()
    account_id = uuid4()
    product_id = uuid4()
    session = _FakeSession([_RowsResult([])])

    context = await KnowledgeEntryService(cast(AsyncSession, session)).context_for_message(
        organization_id=organization_id,
        marketplace_account_id=account_id,
        product_id=product_id,
    )

    assert context is None
    statement = cast(Select[tuple[KnowledgeEntry]], session.statements[0])
    compiled = statement.compile()
    values = list(compiled.params.values())
    assert organization_id in values
    assert account_id in values
    assert product_id in values
    assert "active" in values


@pytest.mark.asyncio
async def test_context_respects_character_limit_at_entry_boundaries() -> None:
    organization_id = uuid4()
    now = datetime.now(UTC)
    first = _entry(
        organization_id=organization_id,
        title="Первый",
        content="a" * 30,
        updated_at=now,
    )
    second = _entry(
        organization_id=organization_id,
        title="Второй",
        content="b" * 30,
        updated_at=now - timedelta(minutes=1),
    )
    session = _FakeSession([_RowsResult([first, second])])

    context = await KnowledgeEntryService(cast(AsyncSession, session)).context_for_message(
        organization_id=organization_id,
        marketplace_account_id=None,
        product_id=None,
        max_characters=60,
    )

    assert context is not None
    assert "Первый" in context
    assert "Второй" not in context
    assert len(context) <= 60
