from __future__ import annotations

from typing import Protocol, cast
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ClauseElement

from app.adapters.registry import MarketplaceAdapterRegistry
from app.core.config import Settings
from app.core.security import CredentialService
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.services.marketplace_account_service import MarketplaceAccountService
from app.services.reply_execution_service import ReplyExecutionService
from app.services.sync_service import MarketplaceSyncService


class _ScalarResult(Protocol):
    def scalar_one_or_none(self) -> object | None: ...


class _EmptyResult:
    def scalar_one_or_none(self) -> None:
        return None


class _Session:
    def __init__(self) -> None:
        self.statements: list[object] = []

    async def execute(self, statement: object) -> _ScalarResult:
        self.statements.append(statement)
        return _EmptyResult()


class _FailRegistry:
    def credentials(self, _: object) -> object:
        raise AssertionError("cross-tenant request must not resolve a provider")

    def capability(self, _: object) -> object:
        raise AssertionError("cross-tenant request must not resolve a provider")


class _FailCredentials:
    def __init__(self) -> None:
        self.decrypt_calls = 0

    def decrypt(self, _: str) -> str:
        self.decrypt_calls += 1
        raise AssertionError("cross-tenant request must not decrypt credentials")


def _actor() -> User:
    return User(
        id=uuid4(),
        email="member@example.test",
        password_hash="not-used",
        status="active",
    )


def _settings() -> Settings:
    return Settings(
        credentials_encryption_key=SecretStr(Fernet.generate_key().decode()),
    )


@pytest.mark.parametrize("seller_id_supplied, expected", [(False, "seller-42"), (True, None)])
@pytest.mark.asyncio
async def test_optional_marketplace_account_reference_can_be_explicitly_cleared(
    seller_id_supplied: bool,
    expected: str | None,
) -> None:
    organization_id = uuid4()
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=organization_id,
        marketplace="wildberries",
        display_name="WB account",
        seller_id="seller-42",
        status="active",
        credentials_encrypted="unused",
        credentials_fingerprint="unused",
        credentials_status="valid",
        scopes_json={"scopes": ["reviews:read", "reviews:write"]},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        patch.object(service.audit, "write", new=AsyncMock()),
    ):
        await service.update_account(
            actor=_actor(),
            account_id=account.id,
            seller_id=None,
            seller_id_supplied=seller_id_supplied,
            status="active",
        )

    assert account.seller_id == expected
    assert account.credentials_status == ("pending_validation" if seller_id_supplied else "valid")
    assert account.status == ("pending_validation" if seller_id_supplied else "active")
    assert account.scopes_json == ({} if seller_id_supplied else {"scopes": ["reviews:read", "reviews:write"]})


@pytest.mark.asyncio
async def test_unchanged_marketplace_account_reference_keeps_validated_scopes() -> None:
    organization_id = uuid4()
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=organization_id,
        marketplace="ozon",
        display_name="Ozon account",
        seller_id="client-42",
        status="active",
        credentials_encrypted="unused",
        credentials_fingerprint="unused",
        credentials_status="valid",
        scopes_json={"scopes": ["reviews:read", "reviews:write"]},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        patch.object(service.audit, "write", new=AsyncMock()),
    ):
        await service.update_account(
            actor=_actor(),
            account_id=account.id,
            seller_id=" client-42 ",
            seller_id_supplied=True,
        )

    assert account.seller_id == "client-42"
    assert account.credentials_status == "valid"
    assert account.status == "active"
    assert account.scopes_json == {"scopes": ["reviews:read", "reviews:write"]}


@pytest.mark.asyncio
async def test_changing_reference_cannot_reactivate_revoked_credentials() -> None:
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="avito",
        display_name="Avito account",
        seller_id="42",
        status="disabled",
        credentials_encrypted="unused",
        credentials_fingerprint="unused",
        credentials_status="revoked",
        scopes_json={"scopes": ["chats:read", "chats:write"]},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        patch.object(service.audit, "write", new=AsyncMock()),
    ):
        await service.update_account(
            actor=_actor(),
            account_id=account.id,
            seller_id="43",
            seller_id_supplied=True,
            status="active",
        )

    assert account.seller_id == "43"
    assert account.credentials_status == "revoked"
    assert account.status == "disabled"
    assert account.scopes_json == {}


@pytest.mark.asyncio
async def test_revoked_credentials_cannot_be_validated_without_rotation() -> None:
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="wildberries",
        display_name="WB account",
        seller_id=None,
        status="disabled",
        credentials_encrypted="unused",
        credentials_fingerprint="unused",
        credentials_status="revoked",
        scopes_json={},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    credentials = _FailCredentials()
    service.credentials = cast(CredentialService, credentials)
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        pytest.raises(HTTPException) as exc_info,
    ):
        await service.validate_credentials(
            actor=_actor(),
            account_id=account.id,
            registry=cast(MarketplaceAdapterRegistry, _FailRegistry()),
        )

    assert exc_info.value.status_code == 409
    assert credentials.decrypt_calls == 0


@pytest.mark.parametrize("operation", ["rotate", "revoke"])
@pytest.mark.asyncio
async def test_credential_change_removes_stale_validated_scopes(operation: str) -> None:
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace="ozon",
        display_name="Ozon account",
        seller_id="client-42",
        status="active",
        credentials_encrypted="unused",
        credentials_fingerprint="unused",
        credentials_status="valid",
        scopes_json={"scopes": ["reviews:read", "reviews:write"]},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        patch.object(service.audit, "write", new=AsyncMock()),
    ):
        if operation == "rotate":
            await service.rotate_credentials(actor=_actor(), account_id=account.id, raw_credentials="new-key-123")
        else:
            await service.revoke_credentials(actor=_actor(), account_id=account.id)

    assert account.scopes_json == {}
    assert account.credentials_status == ("pending_validation" if operation == "rotate" else "revoked")
    assert account.status == ("pending_validation" if operation == "rotate" else "disabled")


@pytest.mark.asyncio
@pytest.mark.parametrize("marketplace", ["wildberries", "ozon", "yandex_market", "avito"])
async def test_delete_marketplace_connection_destroys_secret_and_preserves_history(marketplace: str) -> None:
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=marketplace,
        display_name="WB account",
        seller_id=None,
        status="disabled",
        credentials_encrypted="unused",
        credentials_fingerprint="fingerprint",
        credentials_status="revoked",
        scopes_json={},
        default_response_mode="inherit",
    )
    session = AsyncMock(spec=AsyncSession)
    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(session)
    actor = _actor()
    with (
        patch.object(service, "get_account", new=AsyncMock(return_value=account)),
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()) as require_role,
        patch.object(service.audit, "write", new=AsyncMock()) as write_audit,
    ):
        deleted = await service.delete_account(actor=actor, account_id=account.id)

    require_role.assert_awaited_once_with(
        organization_id=account.organization_id,
        user_id=actor.id,
        allowed_roles={"owner", "admin"},
    )
    write_audit.assert_awaited_once()
    session.delete.assert_not_awaited()
    assert account.status == "deleted"
    assert account.credentials_status == "revoked"
    assert account.credentials_encrypted == ""
    assert account.scopes_json == {}
    assert deleted is account

    rendered = [str(cast(ClauseElement, call.args[0]).compile(dialect=postgresql.dialect())) for call in session.execute.await_args_list]
    assert len(rendered) == 2
    assert "UPDATE marketplace_sync_states" in rendered[0]
    assert "UPDATE automation_rules" in rendered[1]
    assert not any("DELETE" in sql for sql in rendered)


@pytest.mark.parametrize("operation", ["validate", "rotate", "revoke", "delete"])
@pytest.mark.asyncio
async def test_cross_tenant_marketplace_account_mutation_stops_at_scoped_lookup(operation: str) -> None:
    session = _Session()
    actor = _actor()
    account_id = uuid4()
    registry = cast(MarketplaceAdapterRegistry, _FailRegistry())

    with patch("app.services.marketplace_account_service.get_settings", return_value=_settings()):
        service = MarketplaceAccountService(cast(AsyncSession, session))
    credentials = _FailCredentials()
    service.credentials = cast(CredentialService, credentials)

    with pytest.raises(HTTPException) as exc_info:
        if operation == "validate":
            await service.validate_credentials(actor=actor, account_id=account_id, registry=registry)
        elif operation == "rotate":
            await service.rotate_credentials(actor=actor, account_id=account_id, raw_credentials="credential-value")
        elif operation == "revoke":
            await service.revoke_credentials(actor=actor, account_id=account_id)
        else:
            await service.delete_account(actor=actor, account_id=account_id)

    assert exc_info.value.status_code == 404
    assert credentials.decrypt_calls == 0
    assert len(session.statements) == 1
    sql = str(cast(ClauseElement, session.statements[0]).compile(dialect=postgresql.dialect()))
    assert "JOIN organization_users" in sql
    assert "organization_users.user_id" in sql


@pytest.mark.asyncio
async def test_cross_tenant_manual_sync_does_not_resolve_marketplace_capability() -> None:
    session = _Session()
    service = MarketplaceSyncService(
        cast(AsyncSession, session),
        registry=cast(MarketplaceAdapterRegistry, _FailRegistry()),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.request_sync(actor=_actor(), account_id=uuid4())

    assert exc_info.value.status_code == 404
    assert len(session.statements) == 1
    sql = str(cast(ClauseElement, session.statements[0]).compile(dialect=postgresql.dialect()))
    assert "JOIN organization_users" in sql
    assert "organization_users.user_id" in sql


@pytest.mark.asyncio
async def test_cross_tenant_reply_retry_stops_at_membership_scoped_lookup() -> None:
    session = _Session()
    with patch("app.services.reply_execution_service.get_settings", return_value=_settings()):
        service = ReplyExecutionService(cast(AsyncSession, session))

    with pytest.raises(HTTPException) as exc_info:
        await service.prepare_retry(actor=_actor(), reply_id=uuid4())

    assert exc_info.value.status_code == 404
    assert len(session.statements) == 1
    sql = str(cast(ClauseElement, session.statements[0]).compile(dialect=postgresql.dialect()))
    assert "JOIN organization_users" in sql
    assert "organization_users.user_id" in sql
