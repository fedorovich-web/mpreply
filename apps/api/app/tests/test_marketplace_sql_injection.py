from __future__ import annotations

from collections.abc import Sequence
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ClauseElement

from app.models.organization import OrganizationUser
from app.models.user import User
from app.services.message_service import MessageService

INJECTION_VALUES = (
    "' OR 1=1 --",
    "x'; DROP TABLE marketplace_accounts; --",
    "1 UNION SELECT credentials_encrypted FROM marketplace_accounts",
    "'; SELECT pg_sleep(2); --",
)


class _Result:
    def __init__(self, *, scalar: object | None = None, rows: Sequence[object] = ()) -> None:
        self.scalar = scalar
        self.rows = rows

    def scalar_one(self) -> object:
        return self.scalar

    def scalar_one_or_none(self) -> object | None:
        return self.scalar

    def all(self) -> Sequence[object]:
        return self.rows


class _Session:
    def __init__(self, membership: OrganizationUser) -> None:
        self.results = [_Result(scalar=membership), _Result(scalar=0), _Result(rows=[])]
        self.statements: list[object] = []

    async def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return self.results.pop(0)


@pytest.mark.parametrize("value", INJECTION_VALUES)
@pytest.mark.asyncio
async def test_message_filters_are_bound_as_data(value: str) -> None:
    organization_id = uuid4()
    actor = User(
        id=uuid4(),
        email="member@example.test",
        password_hash="not-used",
        status="active",
    )
    membership = OrganizationUser(
        organization_id=organization_id,
        user_id=actor.id,
        role="viewer",
        status="active",
    )
    session = _Session(membership)

    rows, total = await MessageService(cast(AsyncSession, session)).list_messages(
        actor=actor,
        organization_id=organization_id,
        marketplace=value,
        message_type=value,
        status=value,
        search=value,
    )

    assert rows == []
    assert total == 0
    data_statement = cast(ClauseElement, session.statements[2])
    compiled = data_statement.compile(dialect=postgresql.dialect())
    sql = str(compiled)
    params = compiled.params
    assert params is not None
    assert value not in sql
    assert value in params.values()
    assert f"%{value}%" in params.values()
    assert "DROP TABLE" not in sql
    assert "UNION SELECT" not in sql
