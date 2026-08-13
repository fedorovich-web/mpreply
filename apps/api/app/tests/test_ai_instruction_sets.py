from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import Index, Table
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_instruction_set import AIInstructionSet
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import OrganizationUser
from app.models.user import User
from app.schemas.ai_instruction_set import AIInstructionSetCreateRequest, AIInstructionSetUpdateRequest
from app.services.ai_instruction_set_service import AIInstructionSetService


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
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def scalars(self) -> _Scalars:
        return _Scalars(self.values)


class _FakeSession:
    def __init__(self, results: list[object]) -> None:
        self.results = list(results)
        self.statements: list[object] = []
        self.added: list[object] = []
        self.flush_count = 0

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        if not self.results:
            raise AssertionError("Unexpected database query")
        return self.results.pop(0)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flush_count += 1


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


def _instruction_set(*, organization_id: UUID, is_default: bool = False, status: str = "active") -> AIInstructionSet:
    now = datetime.now(UTC)
    return AIInstructionSet(
        id=uuid4(),
        organization_id=organization_id,
        name="Основной стиль",
        response_tone="friendly",
        brand_rules="Обращаться на Вы.",
        reply_signature="Команда магазина",
        prohibited_phrases_json=["гарантируем"],
        status=status,
        is_default=is_default,
        created_at=now,
        updated_at=now,
    )


def test_instruction_set_request_normalizes_customer_policy() -> None:
    payload = AIInstructionSetCreateRequest(
        name="  Основной стиль  ",
        response_tone="friendly",
        brand_rules="  Обращаться на Вы.  ",
        reply_signature="  Команда магазина  ",
        prohibited_phrases=[" гарантируем ", "ГАРАНТИРУЕМ", ""],
    )

    assert payload.name == "Основной стиль"
    assert payload.brand_rules == "Обращаться на Вы."
    assert payload.reply_signature == "Команда магазина"
    assert payload.prohibited_phrases == ["гарантируем"]


def test_instruction_set_requests_reject_unknown_fields_and_null_tone() -> None:
    with pytest.raises(ValidationError):
        AIInstructionSetCreateRequest.model_validate({"name": "Основной", "secret": "value"})
    with pytest.raises(ValidationError):
        AIInstructionSetUpdateRequest(response_tone=None)


def test_instruction_set_model_has_one_active_default_integrity_index() -> None:
    table = cast(Table, AIInstructionSet.__table__)
    indexes: dict[str, Index] = {
        str(index.name): index for index in table.indexes if index.name is not None
    }
    index = indexes["uq_ai_instruction_sets_active_default"]
    where_clause = cast(object, index.dialect_options["postgresql"]["where"])

    assert index.unique is True
    assert "is_default" in str(where_clause)
    assert "active" in str(where_clause)


@pytest.mark.asyncio
async def test_resolve_for_account_prefers_assigned_active_set() -> None:
    organization_id = uuid4()
    assigned = _instruction_set(organization_id=organization_id)
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=organization_id,
        marketplace="wildberries",
        display_name="WB",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        ai_instruction_set_id=assigned.id,
    )
    session = _FakeSession([_ScalarResult(account), _ScalarResult(assigned)])

    settings = await AIInstructionSetService(cast(AsyncSession, session)).resolve_for_account(
        organization_id=organization_id,
        marketplace_account_id=account.id,
    )

    assert settings.response_tone == "friendly"
    assert settings.reply_signature == "Команда магазина"
    assert settings.prohibited_phrases == ("гарантируем",)


@pytest.mark.asyncio
async def test_resolve_for_account_falls_back_to_active_default() -> None:
    organization_id = uuid4()
    default = _instruction_set(organization_id=organization_id, is_default=True)
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=organization_id,
        marketplace="wildberries",
        display_name="WB",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        ai_instruction_set_id=None,
    )
    session = _FakeSession([_ScalarResult(account), _ScalarResult(default)])

    settings = await AIInstructionSetService(cast(AsyncSession, session)).resolve_for_account(
        organization_id=organization_id,
        marketplace_account_id=account.id,
    )

    assert settings.brand_rules == "Обращаться на Вы."


@pytest.mark.asyncio
async def test_resolve_for_account_fails_closed_without_active_default() -> None:
    organization_id = uuid4()
    session = _FakeSession([_ScalarResult(None)])

    with pytest.raises(HTTPException) as exc_info:
        await AIInstructionSetService(cast(AsyncSession, session)).resolve_for_account(
            organization_id=organization_id,
            marketplace_account_id=None,
        )

    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_manager_cannot_create_instruction_set() -> None:
    organization_id = uuid4()
    actor = _user()
    session = _FakeSession([_ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="manager"))])

    with pytest.raises(HTTPException) as exc_info:
        await AIInstructionSetService(cast(AsyncSession, session)).create(
            organization_id=organization_id,
            actor=actor,
            payload=AIInstructionSetCreateRequest(name="Новый набор"),
        )

    assert exc_info.value.status_code == 403
    assert session.added == []


@pytest.mark.asyncio
async def test_assigned_or_default_set_cannot_be_archived() -> None:
    organization_id = uuid4()
    actor = _user()
    instruction_set = _instruction_set(organization_id=organization_id, is_default=True)
    session = _FakeSession(
        [
            _ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner")),
            _ScalarResult(instruction_set),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await AIInstructionSetService(cast(AsyncSession, session)).update(
            organization_id=organization_id,
            instruction_set_id=instruction_set.id,
            actor=actor,
            payload=AIInstructionSetUpdateRequest(status="archived"),
        )

    assert exc_info.value.status_code == 409
    assert instruction_set.status == "active"


@pytest.mark.asyncio
async def test_new_organization_can_create_its_required_default_set() -> None:
    organization_id = uuid4()
    actor_id = uuid4()
    session = _FakeSession([_ScalarResult(None)])

    instruction_set = await AIInstructionSetService(cast(AsyncSession, session)).ensure_default(
        organization_id=organization_id,
        actor_user_id=actor_id,
    )

    assert instruction_set.organization_id == organization_id
    assert instruction_set.name == "Основной набор"
    assert instruction_set.is_default is True
    assert instruction_set.status == "active"
    assert instruction_set.created_by == actor_id


@pytest.mark.asyncio
async def test_default_switch_clears_old_default_before_enabling_new_one() -> None:
    organization_id = uuid4()
    actor = _user()
    old_default = _instruction_set(organization_id=organization_id, is_default=True)
    new_default = _instruction_set(organization_id=organization_id)
    session = _FakeSession(
        [
            _ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner")),
            _RowsResult([old_default, new_default]),
        ]
    )

    resolved = await AIInstructionSetService(cast(AsyncSession, session)).make_default(
        organization_id=organization_id,
        instruction_set_id=new_default.id,
        actor=actor,
    )

    assert resolved is new_default
    assert old_default.is_default is False
    assert new_default.is_default is True
    assert session.flush_count == 3
