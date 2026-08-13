from __future__ import annotations

from collections.abc import Mapping
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Select, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement, TextClause

from app.models.audit_log import AuditLog
from app.models.customer_message import CustomerMessage
from app.models.knowledge_entry import KnowledgeEntry
from app.models.organization import OrganizationUser
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.knowledge_entry_service import KnowledgeEntryService
from app.services.message_service import MessageService
from app.services.payment_service import PaymentService

ATTACK = "%' OR 1=1; SELECT pg_sleep(10); DROP TABLE customer_messages; --"


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _Scalars:
    def all(self) -> list[object]:
        return []


class _RowsResult:
    def scalars(self) -> _Scalars:
        return _Scalars()


class _AuditSession:
    def __init__(self, membership: OrganizationUser) -> None:
        self.results: list[object] = [_ScalarResult(membership), _RowsResult()]
        self.statements: list[object] = []

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        return self.results.pop(0)


class _KnowledgeSession(_AuditSession):
    pass


class _PaymentSession:
    def __init__(self) -> None:
        self.statement: object | None = None
        self.parameters: Mapping[str, object] | None = None

    async def execute(
        self,
        statement: object,
        parameters: Mapping[str, object] | None = None,
    ) -> object:
        self.statement = statement
        self.parameters = parameters
        return object()


class _MessageServiceProbe(MessageService):
    @staticmethod
    def attack_conditions() -> list[ColumnElement[bool]]:
        return MessageService._build_filter_conditions(
            marketplace=ATTACK,
            message_type=ATTACK,
            status=ATTACK,
            rating_min=None,
            rating_max=None,
            product_id=None,
            search=ATTACK,
        )


class _PaymentServiceProbe(PaymentService):
    async def advisory_lock(self, key: str) -> None:
        await self._advisory_lock(key)


def _compiled(statement: Select[tuple[UUID]]) -> tuple[str, Mapping[str, object]]:
    compiled = statement.compile(dialect=postgresql.dialect())
    return str(compiled), compiled.params


def test_message_filters_keep_sql_payloads_in_bound_parameters() -> None:
    organization_id = uuid4()
    statement = select(CustomerMessage.id).where(
        CustomerMessage.organization_id == organization_id,
        *_MessageServiceProbe.attack_conditions(),
    )

    sql, parameters = _compiled(statement)

    assert ATTACK not in sql
    assert organization_id in parameters.values()
    assert ATTACK in parameters.values()
    assert f"%{ATTACK}%" in parameters.values()


@pytest.mark.asyncio
async def test_audit_filters_keep_sql_payloads_in_bound_parameters() -> None:
    organization_id = uuid4()
    actor = User(
        id=uuid4(),
        email="owner@example.com",
        name="Owner",
        password_hash="hashed",
        status="active",
        is_superadmin=False,
    )
    membership = OrganizationUser(
        id=uuid4(),
        organization_id=organization_id,
        user_id=actor.id,
        role="owner",
        status="active",
    )
    session = _AuditSession(membership)

    await AuditService(cast(AsyncSession, session)).list_for_organization(
        actor=actor,
        organization_id=organization_id,
        action=ATTACK,
        entity_type=ATTACK,
    )
    statement = cast(Select[tuple[AuditLog]], session.statements[1])
    compiled = statement.compile(dialect=postgresql.dialect())
    sql = str(compiled)

    assert ATTACK not in sql
    assert organization_id in compiled.params.values()
    assert list(compiled.params.values()).count(ATTACK) == 2


@pytest.mark.asyncio
async def test_knowledge_search_keeps_sql_payload_in_bound_parameters() -> None:
    organization_id = uuid4()
    actor = User(
        id=uuid4(),
        email="owner@example.com",
        name="Owner",
        password_hash="hashed",
        status="active",
        is_superadmin=False,
    )
    membership = OrganizationUser(
        id=uuid4(),
        organization_id=organization_id,
        user_id=actor.id,
        role="viewer",
        status="active",
    )
    session = _KnowledgeSession(membership)

    await KnowledgeEntryService(cast(AsyncSession, session)).list_for_actor(
        organization_id=organization_id,
        actor=actor,
        search=ATTACK,
        status=None,
        category=None,
    )
    statement = cast(Select[tuple[KnowledgeEntry]], session.statements[1])
    compiled = statement.compile(dialect=postgresql.dialect())

    assert ATTACK not in str(compiled)
    assert f"%{ATTACK}%" in compiled.params.values()


@pytest.mark.asyncio
async def test_payment_lock_keeps_sql_payload_in_named_parameter() -> None:
    session = _PaymentSession()
    service = _PaymentServiceProbe(cast(AsyncSession, session))

    await service.advisory_lock(ATTACK)

    statement = cast(TextClause, session.statement)
    assert ATTACK not in str(statement)
    assert session.parameters == {"lock_key": ATTACK}
