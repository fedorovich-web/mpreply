from __future__ import annotations

from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import OrganizationUser
from app.models.user import User
from app.services.dashboard_service import DashboardService


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalar_one(self) -> object:
        return self.value


class _FakeSession:
    def __init__(self, values: list[object]) -> None:
        self.values = list(values)
        self.statements: list[object] = []

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        return _ScalarResult(self.values.pop(0))


@pytest.mark.asyncio
async def test_attention_is_tenant_scoped_and_orders_actionable_counts() -> None:
    organization_id = uuid4()
    user = User(id=uuid4(), email="owner@example.com", name="Owner", password_hash="hash", status="active", is_superadmin=False)
    membership = OrganizationUser(id=uuid4(), organization_id=organization_id, user_id=user.id, role="owner", status="active")
    session = _FakeSession([membership, 3, 2, 1, 0])

    response = await DashboardService(cast(AsyncSession, session)).attention(organization_id=organization_id, actor=user)

    assert [item.key for item in response.items] == ["failed", "manual_review", "needs_reply"]
    assert [item.count for item in response.items] == [2, 3, 1]
    assert response.integration_issues == 0
    for raw_statement in session.statements[1:]:
        statement = cast(Select[tuple[int]], raw_statement)
        assert organization_id in statement.compile().params.values()
