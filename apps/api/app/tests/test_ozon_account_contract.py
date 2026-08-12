from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.adapters.base import AdapterResult
from app.adapters.ozon import OzonAdapter
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
    async def ensure_account_states(self, **_: object) -> None:
        return None

    async def pause_account_states(self, **_: object) -> None:
        return None


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


class _OzonAccountAdapter(OzonAdapter):
    async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
        assert credential == "synthetic-api-key"
        assert seller_id == "client-123"
        return AdapterResult(
            ok=True,
            data={
                "scopes": ["fetch_reviews", "send_review_reply"],
                "expires_at": "2026-12-01T00:00:00Z",
                "roles": [{"methods": ["must-not-persist"]}],
            },
        )


class _AccountServiceHarness(MarketplaceAccountService):
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account
        self.session = _Session()
        self.organization_service = _Memberships()
        self.audit = _Audit()
        self.scheduler = _Scheduler()
        self.credentials = _Credentials()
        self.adapter: OzonAdapter = _OzonAccountAdapter()

    async def get_account(self, *, actor: User, account_id: object) -> MarketplaceAccount:
        assert account_id == self.account.id
        return self.account

    def _adapter_for(self, marketplace: str) -> OzonAdapter:
        assert marketplace == Marketplace.OZON.value
        return self.adapter

    async def _write_integration_event(self, **_: object) -> IntegrationEvent:
        return cast(IntegrationEvent, SimpleNamespace())


def _account() -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=uuid4(),
            organization_id=uuid4(),
            marketplace=Marketplace.OZON.value,
            seller_id="client-123",
            credentials_encrypted="synthetic-api-key",
            credentials_status="pending_validation",
            credentials_fingerprint="fingerprint",
            status="pending_validation",
            scopes_json={},
            last_error_sync_at=None,
            error_count=0,
            display_name="Ozon",
            default_response_mode="inherit",
            last_success_sync_at=None,
            created_at=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
            updated_at=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
        ),
    )


def test_ozon_requires_nonempty_client_id() -> None:
    assert normalize_marketplace_seller_id(Marketplace.OZON.value, " client-123 ") == "client-123"

    for invalid in (None, "", "   "):
        with pytest.raises(HTTPException) as exc_info:
            normalize_marketplace_seller_id(Marketplace.OZON.value, invalid)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_ozon_validation_retains_only_safe_normalized_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
        "scopes": ["fetch_reviews", "send_review_reply"],
        "expires_at": "2026-12-01T00:00:00Z",
    }
    assert "roles" not in validated.scopes_json


@pytest.mark.asyncio
async def test_changing_ozon_client_id_invalidates_stale_validation_scopes() -> None:
    account = _account()
    account.status = "active"
    account.credentials_status = "valid"
    account.scopes_json = {"validated": True, "scopes": ["fetch_reviews"]}
    service = _AccountServiceHarness(account)
    actor = cast(User, SimpleNamespace(id=uuid4()))

    updated = await service.update_account(actor=actor, account_id=account.id, seller_id="client-456")

    assert updated.seller_id == "client-456"
    assert updated.status == "pending_validation"
    assert updated.credentials_status == "pending_validation"
    assert updated.scopes_json == {}


@pytest.mark.asyncio
async def test_ozon_rotate_and_validation_failure_clear_stale_scopes() -> None:
    account = _account()
    account.status = "active"
    account.credentials_status = "valid"
    account.scopes_json = {"validated": True, "scopes": ["fetch_reviews"]}
    service = _AccountServiceHarness(account)
    actor = cast(User, SimpleNamespace(id=uuid4()))

    rotated = await service.rotate_credentials(actor=actor, account_id=account.id, raw_credentials="synthetic-new-key")

    assert rotated.scopes_json == {}

    class _FailingAdapter(OzonAdapter):
        async def validate_credentials(self, credential: str, seller_id: str | None = None) -> AdapterResult:
            return AdapterResult(False, error_code="invalid_credentials")

    service.adapter = _FailingAdapter()
    account.scopes_json = {"validated": True, "scopes": ["fetch_reviews"]}
    _, result = await service.validate_credentials(actor=actor, account_id=account.id)

    assert result.ok is False
    assert account.scopes_json == {}


def test_ozon_account_response_omits_raw_client_id() -> None:
    account = _account()
    service = _AccountServiceHarness(account)

    response = service.to_response(account)

    assert response.seller_id is None
