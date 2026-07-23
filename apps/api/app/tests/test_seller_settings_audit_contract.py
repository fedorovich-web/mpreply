from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.audit_log import AuditLog
from app.models.organization import OrganizationUser
from app.models.seller_settings import SellerSettings
from app.models.user import User
from app.schemas.seller_settings import SellerSettingsUpdateRequest
from app.services.audit_service import AuditService, decode_audit_cursor, encode_audit_cursor
from app.services.seller_settings_service import SellerPromptSettings, SellerSettingsService

API_ROOT = Path(__file__).resolve().parents[2]


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value

    def scalar_one(self) -> object:
        if self.value is None:
            raise AssertionError("Expected one scalar")
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

    async def execute(self, statement: object) -> object:
        self.statements.append(statement)
        if not self.results:
            raise AssertionError("Unexpected database query")
        return self.results.pop(0)


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


def _audit(*, organization_id: UUID, created_at: datetime) -> AuditLog:
    return AuditLog(
        id=uuid4(),
        organization_id=organization_id,
        actor_user_id=uuid4(),
        action="seller_settings.updated",
        entity_type="seller_settings",
        entity_id=str(uuid4()),
        metadata_json={"changed_fields": ["response_tone"]},
        created_at=created_at,
        updated_at=created_at,
    )


def test_seller_settings_request_normalizes_text_and_phrases() -> None:
    payload = SellerSettingsUpdateRequest(
        response_tone="friendly",
        brand_rules="  Обращаться на Вы  ",
        knowledge_base="  Инструкция  ",
        reply_signature="  Команда магазина  ",
        prohibited_phrases=[" гарантируем ", "ГАРАНТИРУЕМ", "", "точно доставим"],
    )

    assert payload.brand_rules == "Обращаться на Вы"
    assert payload.knowledge_base == "Инструкция"
    assert payload.reply_signature == "Команда магазина"
    assert payload.prohibited_phrases == ["гарантируем", "точно доставим"]


def test_seller_settings_request_allows_explicit_text_clear() -> None:
    payload = SellerSettingsUpdateRequest(brand_rules=None, prohibited_phrases=None)

    assert payload.model_dump(exclude_unset=True) == {
        "brand_rules": None,
        "prohibited_phrases": None,
    }


def test_seller_settings_request_rejects_null_tone() -> None:
    with pytest.raises(ValidationError):
        SellerSettingsUpdateRequest(response_tone=None)


def test_seller_settings_request_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        SellerSettingsUpdateRequest.model_validate({"response_tone": "neutral", "secret": "value"})


def test_seller_settings_request_rejects_overlong_phrase() -> None:
    with pytest.raises(ValidationError):
        SellerSettingsUpdateRequest(prohibited_phrases=["x" * 201])


def test_default_prompt_settings_are_neutral() -> None:
    settings = SellerPromptSettings()

    assert settings.has_customizations is False
    assert settings.resolve(
        tone_override=None,
        brand_rules_override=None,
        knowledge_base_override=None,
    ) == ("neutral", None, None)


def test_prompt_settings_merge_persisted_policy_and_request_override() -> None:
    settings = SellerPromptSettings(
        response_tone="friendly",
        brand_rules="Обращаться на Вы.",
        knowledge_base="Базовая инструкция.",
        reply_signature="Команда магазина",
        prohibited_phrases=("гарантируем", "точно доставим"),
    )

    tone, brand_rules, knowledge_base = settings.resolve(
        tone_override="formal",
        brand_rules_override="Не использовать эмодзи.",  # noqa: RUF001
        knowledge_base_override="Контекст конкретного товара.",
    )

    assert tone == "formal"
    assert brand_rules is not None
    assert "Обращаться на Вы." in brand_rules
    assert "Не использовать эмодзи." in brand_rules  # noqa: RUF001
    assert "гарантируем; точно доставим" in brand_rules
    assert "Команда магазина" in brand_rules
    assert knowledge_base == "Контекст конкретного товара."
    assert settings.has_customizations is True


def test_prompt_settings_fall_back_to_persisted_knowledge_base_for_blank_override() -> None:
    settings = SellerPromptSettings(knowledge_base="Persisted")

    assert settings.resolve(
        tone_override=None,
        brand_rules_override=None,
        knowledge_base_override="   ",
    )[2] == "Persisted"


def test_prompt_settings_flag_prohibited_phrase_case_insensitively() -> None:
    settings = SellerPromptSettings(prohibited_phrases=("точно доставим",))

    assert settings.policy_flags("Мы ТОЧНО ДОСТАВИМ заказ завтра.") == ["seller_prohibited_phrase"]
    assert settings.policy_flags("Передадим заказ в доставку.") == []


def test_audit_cursor_round_trip_is_stable() -> None:
    created_at = datetime(2026, 7, 22, 8, 30, 0, 123456, tzinfo=UTC)
    audit_id = uuid4()

    cursor = encode_audit_cursor(created_at=created_at, audit_id=audit_id)
    decoded = decode_audit_cursor(cursor)

    assert decoded.created_at == created_at
    assert decoded.audit_id == audit_id
    assert "=" not in cursor


def test_audit_cursor_rejects_invalid_payload() -> None:
    with pytest.raises(HTTPException) as exc_info:
        decode_audit_cursor("not-a-valid-cursor")

    assert exc_info.value.status_code == 400


def test_audit_cursor_rejects_naive_timestamp() -> None:
    with pytest.raises(HTTPException) as exc_info:
        encode_audit_cursor(created_at=datetime(2026, 7, 22), audit_id=uuid4())

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_audit_filter_normalization_rejects_blank_values() -> None:
    organization_id = uuid4()
    actor = _user()
    session = _FakeSession(
        [_ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner"))]
    )

    with pytest.raises(HTTPException) as exc_info:
        await AuditService(session).list_for_organization(  # type: ignore[arg-type]
            actor=actor,
            organization_id=organization_id,
            action="   ",
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_audit_datetime_normalization_requires_timezone() -> None:
    organization_id = uuid4()
    actor = _user()
    session = _FakeSession(
        [_ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner"))]
    )

    with pytest.raises(HTTPException) as exc_info:
        await AuditService(session).list_for_organization(  # type: ignore[arg-type]
            actor=actor,
            organization_id=organization_id,
            created_from=datetime(2026, 7, 22),
        )

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_audit_read_rejects_viewer_role() -> None:
    organization_id = uuid4()
    actor = _user()
    session = _FakeSession(
        [_ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="viewer"))]
    )

    with pytest.raises(HTTPException) as exc_info:
        await AuditService(session).list_for_organization(  # type: ignore[arg-type]
            actor=actor,
            organization_id=organization_id,
        )

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_audit_read_returns_keyset_cursor_without_total_count() -> None:
    organization_id = uuid4()
    actor = _user()
    newest = _audit(organization_id=organization_id, created_at=datetime.now(UTC))
    older = _audit(organization_id=organization_id, created_at=datetime.now(UTC) - timedelta(minutes=1))
    session = _FakeSession(
        [
            _ScalarResult(_membership(organization_id=organization_id, user_id=actor.id, role="owner")),
            _RowsResult([newest, older]),
        ]
    )

    page = await AuditService(session).list_for_organization(  # type: ignore[arg-type]
        actor=actor,
        organization_id=organization_id,
        limit=1,
    )

    assert page.items == [newest]
    assert page.has_more is True
    assert page.next_cursor is not None
    decoded = decode_audit_cursor(page.next_cursor)
    assert decoded.audit_id == newest.id
    assert "audit_logs.organization_id" in str(session.statements[1])


@pytest.mark.asyncio
async def test_seller_settings_read_allows_viewer_role() -> None:
    organization_id = uuid4()
    actor = _user()
    membership = _membership(organization_id=organization_id, user_id=actor.id, role="viewer")
    now = datetime.now(UTC)
    settings = SellerSettings(
        id=uuid4(),
        organization_id=organization_id,
        response_tone="neutral",
        prohibited_phrases_json=[],
        created_by=actor.id,
        updated_by=actor.id,
        created_at=now,
        updated_at=now,
    )
    session = _FakeSession([_ScalarResult(membership), _ScalarResult(None), _ScalarResult(settings)])

    resolved = await SellerSettingsService(session).get_for_actor(  # type: ignore[arg-type]
        organization_id=organization_id,
        actor=actor,
    )

    assert resolved is settings


@pytest.mark.asyncio
async def test_seller_settings_write_rejects_manager_role() -> None:
    organization_id = uuid4()
    actor = _user()
    membership = _membership(organization_id=organization_id, user_id=actor.id, role="manager")
    session = _FakeSession([_ScalarResult(membership)])

    with pytest.raises(HTTPException) as exc_info:
        await SellerSettingsService(session).update(  # type: ignore[arg-type]
            organization_id=organization_id,
            actor=actor,
            payload=SellerSettingsUpdateRequest(response_tone="formal"),
        )

    assert exc_info.value.status_code == 403


def test_migration_and_route_contracts_are_present() -> None:
    migration = (
        API_ROOT / "alembic" / "versions" / "20260722_0011_seller_settings_audit_read_api.py"
    ).read_text(encoding="utf-8")
    main = (API_ROOT / "app" / "main.py").read_text(encoding="utf-8")
    ai_service = (API_ROOT / "app" / "services" / "ai_service.py").read_text(encoding="utf-8")

    for token in [
        "seller_settings",
        "ON CONFLICT (organization_id) DO NOTHING",
        "CREATE TRIGGER trg_audit_logs_append_only",
        "CREATE TRIGGER trg_audit_logs_no_truncate",
        "audit_logs is append-only",
    ]:
        assert token in migration
    assert "audit_logs_router" in main
    assert "seller_settings_router" in main
    assert "prompt_settings.resolve" in ai_service
    assert '"seller_settings_applied"' in ai_service
