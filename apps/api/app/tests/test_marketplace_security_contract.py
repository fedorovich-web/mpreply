from __future__ import annotations

from typing import Protocol, cast
from unittest.mock import patch
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


@pytest.mark.parametrize("operation", ["validate", "rotate", "revoke"])
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
        else:
            await service.revoke_credentials(actor=actor, account_id=account_id)

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
