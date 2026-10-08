from __future__ import annotations

from typing import cast
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult, CredentialValidation
from app.adapters.capabilities import WILDBERRIES_CAPABILITY
from app.adapters.registry import MarketplaceAdapterRegistry
from app.core.config import Settings
from app.core.security import CredentialService
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.services.marketplace_account_service import MarketplaceAccountService


class _Result:
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account

    def scalar_one_or_none(self) -> MarketplaceAccount:
        return self.account


class _Session:
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account

    async def execute(self, _: object) -> _Result:
        return _Result(self.account)

    async def commit(self) -> None:
        return None

    async def flush(self) -> None:
        return None


class _Credentials:
    def decrypt(self, encrypted: str) -> str:
        assert encrypted == "encrypted"
        return "synthetic-token"


class _Adapter:
    marketplace = Marketplace.WILDBERRIES

    async def validate_credentials(self, _: str, __: str | None) -> AdapterResult[CredentialValidation]:
        return AdapterResult(
            False,
            error_code="rate_limited",
            error_message_safe="Wildberries rate limit was exceeded",
            retry_after_seconds=650,
        )


class _Registry:
    def __init__(self) -> None:
        self.adapter = _Adapter()

    def credentials(self, marketplace: Marketplace) -> _Adapter:
        assert marketplace is Marketplace.WILDBERRIES
        return self.adapter

    def capability(self, marketplace: Marketplace) -> object:
        assert marketplace is Marketplace.WILDBERRIES
        return WILDBERRIES_CAPABILITY


def _account() -> MarketplaceAccount:
    return MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.WILDBERRIES.value,
        display_name="Synthetic WB",
        seller_id=None,
        status="active",
        credentials_encrypted="encrypted",
        credentials_fingerprint="fingerprint",
        credentials_status="valid",
        scopes_json={
            "scopes": ["reviews:read", "reviews:write", "questions:read", "questions:write"],
            "checked_at": "2026-10-05T10:00:00+00:00",
        },
        default_response_mode="inherit",
    )


@pytest.mark.asyncio
async def test_transient_validation_error_keeps_previously_validated_access() -> None:
    account = _account()
    session = _Session(account)
    settings = Settings(credentials_encryption_key=SecretStr(Fernet.generate_key().decode()))
    actor = User(id=uuid4(), email="seller@example.test", password_hash="hash", status="active")
    with patch("app.services.marketplace_account_service.get_settings", return_value=settings):
        service = MarketplaceAccountService(cast(AsyncSession, session))
    service.credentials = cast(CredentialService, _Credentials())
    with (
        patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
        patch.object(service.audit, "write", new=AsyncMock()),
        patch.object(service, "_write_integration_event", new=AsyncMock()) as write_event,
    ):
        returned, result = await service.validate_credentials(
            actor=actor,
            account_id=account.id,
            registry=cast(MarketplaceAdapterRegistry, _Registry()),
        )

    assert result.error_code == "rate_limited"
    assert returned is account
    assert account.status == "active"
    assert account.credentials_status == "valid"
    assert account.scopes_json["scopes"] == ["reviews:read", "reviews:write", "questions:read", "questions:write"]
    write_event.assert_awaited_once()
