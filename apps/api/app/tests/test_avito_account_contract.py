from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.adapters.avito import AvitoAdapter
from app.adapters.base import AdapterResult
from app.models.enums import Marketplace
from app.models.integration_event import IntegrationEvent
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.services.marketplace_account_service import (
    MarketplaceAccountService,
    normalize_marketplace_seller_id,
)


class _Memberships:
    async def require_membership_role(self, **_: object) -> None:
        return None


class _Audit:
    async def write(self, **_: object) -> None:
        return None


class _Scheduler:
    def __init__(self) -> None:
        self.paused_account_ids: list[object] = []

    async def ensure_account_states(self, **_: object) -> None:
        return None

    async def pause_account_states(self, *, account_id: object) -> None:
        self.paused_account_ids.append(account_id)


class _Session:
    async def flush(self) -> None:
        return None


class _Credentials:
    def decrypt(self, value: str) -> str:
        return value

    def encrypt(self, value: str) -> str:
        return value

    def fingerprint(self, value: str) -> str:
        return f"fingerprint-{value}"

    def mask_fingerprint(self, value: str) -> str:
        return f"masked-{value}"


class _AvitoAccountAdapter(AvitoAdapter):
    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        assert credential == "synthetic-access-token"
        assert seller_id == "123456"
        return AdapterResult(ok=True, data={"scopes": ["must-not-persist"]})


class _AccountServiceHarness(MarketplaceAccountService):
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account
        self.session = _Session()
        self.organization_service = _Memberships()
        self.audit = _Audit()
        self.scheduler = _Scheduler()
        self.credentials = _Credentials()
        self.adapter: AvitoAdapter = _AvitoAccountAdapter()

    async def get_account(self, *, actor: User, account_id: object) -> MarketplaceAccount:
        assert account_id == self.account.id
        return self.account

    def _adapter_for(self, marketplace: str) -> AvitoAdapter:
        assert marketplace == Marketplace.AVITO.value
        return self.adapter

    async def _write_integration_event(self, **_: object) -> IntegrationEvent:
        return cast(IntegrationEvent, SimpleNamespace())


def _account() -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=uuid4(),
            organization_id=uuid4(),
            marketplace=Marketplace.AVITO.value,
            seller_id="123456",
            credentials_encrypted="synthetic-access-token",
            credentials_status="pending_validation",
            credentials_fingerprint="fingerprint",
            status="pending_validation",
            scopes_json={},
            last_error_sync_at=None,
            error_count=0,
            display_name="Avito",
            default_response_mode="inherit",
            last_success_sync_at=None,
            created_at=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
            updated_at=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
        ),
    )


def test_avito_requires_a_positive_decimal_user_id() -> None:
    assert normalize_marketplace_seller_id(Marketplace.AVITO.value, " 123456 ") == "123456"

    for invalid in (None, "", "   ", "0", "-1", "12.3", "user-123"):
        with pytest.raises(HTTPException) as exc_info:
            normalize_marketplace_seller_id(Marketplace.AVITO.value, invalid)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_avito_validation_persists_only_safe_read_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    account = _account()
    service = _AccountServiceHarness(account)
    actor = cast(User, SimpleNamespace(id=uuid4()))

    def _fixed_now(_: object) -> datetime:
        return datetime(2026, 8, 12, 7, 0, tzinfo=UTC)

    monkeypatch.setattr("app.services.marketplace_account_service.datetime", SimpleNamespace(now=_fixed_now))

    validated, result = await service.validate_credentials(actor=actor, account_id=account.id)

    assert result.ok is True
    assert validated.scopes_json == {
        "validated": True,
        "checked_at": "2026-08-12T07:00:00+00:00",
        "scopes": ["fetch_chats"],
    }


@pytest.mark.asyncio
async def test_avito_identity_change_rotation_and_failed_revalidation_clear_stale_metadata() -> None:
    account = _account()
    account.status = "active"
    account.credentials_status = "valid"
    account.scopes_json = {"validated": True, "scopes": ["fetch_chats"]}
    service = _AccountServiceHarness(account)
    actor = cast(User, SimpleNamespace(id=uuid4()))

    changed = await service.update_account(actor=actor, account_id=account.id, seller_id="654321")
    assert changed.status == "pending_validation"
    assert changed.credentials_status == "pending_validation"
    assert changed.scopes_json == {}

    account.status = "active"
    account.credentials_status = "valid"
    account.scopes_json = {"validated": True, "scopes": ["fetch_chats"]}
    rotated = await service.rotate_credentials(
        actor=actor, account_id=account.id, raw_credentials="synthetic-new-token"
    )
    assert rotated.scopes_json == {}

    account.status = "active"
    account.credentials_status = "valid"
    account.scopes_json = {"validated": True, "scopes": ["fetch_chats"]}
    revoked = await service.revoke_credentials(actor=actor, account_id=account.id)
    assert revoked.status == "disabled"
    assert revoked.credentials_status == "revoked"
    assert revoked.scopes_json == {}

    class _FailingAdapter(AvitoAdapter):
        async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
            return AdapterResult(False, error_code="invalid_credentials")

    service.adapter = _FailingAdapter()
    account.scopes_json = {"validated": True, "scopes": ["fetch_chats"]}
    _, result = await service.validate_credentials(actor=actor, account_id=account.id)

    assert result.ok is False
    assert account.scopes_json == {}
    assert service.scheduler.paused_account_ids == [account.id, account.id, account.id]


def test_avito_account_response_omits_raw_user_id() -> None:
    account = _account()
    service = _AccountServiceHarness(account)

    assert service.to_response(account).seller_id is None
