from __future__ import annotations

from typing import cast
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import httpx
import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.avito_account import AvitoCredentialAdapter
from app.adapters.capabilities import AVITO_CAPABILITY, MarketplaceStream, streams_for_scopes
from app.adapters.http import ReadRetryPolicy
from app.adapters.registry import MarketplaceAdapterRegistry
from app.core.config import Settings
from app.core.security import CredentialService
from app.models.enums import Marketplace
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.services.marketplace_account_service import MarketplaceAccountService
from app.tests.marketplace_fixtures import SequenceTransport, response

_CREDENTIAL = '{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}'
_NO_RETRY = ReadRetryPolicy(max_attempts=1)


def _token() -> httpx.Response:
    return response(200, json={"access_token": "synthetic-token", "token_type": "Bearer", "expires_in": 3600})


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("chat_response", "review_response", "expected_scopes"),
    [
        (response(200, json={"chats": []}), response(403), ("chats:read", "chats:write")),
        (response(403), response(200, json={"reviews": [], "total": 0}), ("reviews:read", "reviews:write")),
        (
            response(200, json={"chats": []}),
            response(200, json={"reviews": [], "total": 0}),
            ("chats:read", "chats:write", "reviews:read", "reviews:write"),
        ),
        (response(403), response(403), ()),
    ],
)
async def test_avito_chat_and_reviews_access_are_checked_independently(
    chat_response: httpx.Response,
    review_response: httpx.Response,
    expected_scopes: tuple[str, ...],
) -> None:
    transport = SequenceTransport([_token(), chat_response, review_response])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoCredentialAdapter(client, read_retry_policy=_NO_RETRY).validate_credentials(_CREDENTIAL, "123")

    assert result.ok is bool(expected_scopes)
    if expected_scopes:
        assert result.data is not None
        assert result.data.scopes == expected_scopes
        assert result.data.write_verification == "not_probed"
    assert [request.url.path for request in transport.requests] == [
        "/token",
        "/messenger/v2/accounts/123/chats",
        "/ratings/v1/reviews",
    ]
    assert all(request.method != "POST" or request.url.path == "/token" for request in transport.requests)


@pytest.mark.asyncio
async def test_invalid_avito_credential_fails_before_access_probes() -> None:
    transport = SequenceTransport([])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoCredentialAdapter(client, read_retry_policy=_NO_RETRY).validate_credentials("not-json", "123")

    assert result.ok is False
    assert result.error_code == "invalid_credentials"
    assert transport.requests == []


@pytest.mark.asyncio
async def test_reviews_only_account_does_not_require_messenger_account_id() -> None:
    transport = SequenceTransport([_token(), response(200, json={"reviews": [], "total": 0})])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        result = await AvitoCredentialAdapter(client, read_retry_policy=_NO_RETRY).validate_credentials(_CREDENTIAL, None)

    assert result.ok and result.data is not None
    assert result.data.scopes == ("reviews:read", "reviews:write")
    assert [request.url.path for request in transport.requests] == ["/token", "/ratings/v1/reviews"]
    assert streams_for_scopes(AVITO_CAPABILITY.streams, {"scopes": list(result.data.scopes)}) == frozenset({MarketplaceStream.REVIEWS})


class _Result:
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account

    def scalar_one_or_none(self) -> MarketplaceAccount:
        return self.account


class _Session:
    def __init__(self, account: MarketplaceAccount) -> None:
        self.account = account

    async def execute(self, statement: object) -> _Result:
        assert statement is not None
        return _Result(self.account)

    async def commit(self) -> None:
        return None

    async def flush(self) -> None:
        return None


class _Credentials:
    def decrypt(self, encrypted: str) -> str:
        assert encrypted == "synthetic-encrypted"
        return _CREDENTIAL


class _Registry:
    def __init__(self, adapter: AvitoCredentialAdapter) -> None:
        self.adapter = adapter

    def credentials(self, marketplace: Marketplace) -> AvitoCredentialAdapter:
        assert marketplace is Marketplace.AVITO
        return self.adapter


@pytest.mark.asyncio
async def test_account_persists_review_access_without_claiming_verified_write_permission() -> None:
    account = MarketplaceAccount(
        id=uuid4(),
        organization_id=uuid4(),
        marketplace=Marketplace.AVITO.value,
        display_name="Synthetic Avito",
        seller_id=None,
        status="pending_validation",
        credentials_encrypted="synthetic-encrypted",
        credentials_fingerprint="synthetic-fingerprint",
        credentials_status="pending_validation",
        scopes_json={},
    )
    session = _Session(account)
    settings = Settings(credentials_encryption_key=SecretStr(Fernet.generate_key().decode()))
    with patch("app.services.marketplace_account_service.get_settings", return_value=settings):
        service = MarketplaceAccountService(cast(AsyncSession, session))
    service.credentials = cast(CredentialService, _Credentials())
    actor = User(id=uuid4(), email="synthetic@example.test", password_hash="hash", status="active")
    transport = SequenceTransport([_token(), response(200, json={"reviews": [], "total": 0})])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=transport.mock()) as client:
        with (
            patch.object(service, "get_account", new=AsyncMock(return_value=account)),
            patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
            patch.object(service.audit, "write", new=AsyncMock()),
            patch.object(service, "_write_integration_event", new=AsyncMock()),
        ):
            _, validation = await service.validate_credentials(
                actor=actor,
                account_id=account.id,
                registry=cast(MarketplaceAdapterRegistry, _Registry(AvitoCredentialAdapter(client, read_retry_policy=_NO_RETRY))),
            )

    assert validation.ok is True
    assert account.scopes_json["scopes"] == ["reviews:read", "reviews:write"]
    assert account.scopes_json["write_verification"] == "not_probed"
    assert "checked_at" in account.scopes_json
    assert "synthetic-secret" not in repr(account.scopes_json)
    assert "synthetic-token" not in repr(account.scopes_json)
    assert all(request.url.path != "/ratings/v1/answers" for request in transport.requests)

    denied_transport = SequenceTransport([_token(), response(403)])
    async with httpx.AsyncClient(base_url="https://api.avito.ru", transport=denied_transport.mock()) as client:
        with (
            patch.object(service, "get_account", new=AsyncMock(return_value=account)),
            patch.object(service.organization_service, "require_membership_role", new=AsyncMock()),
            patch.object(service.audit, "write", new=AsyncMock()),
            patch.object(service, "_write_integration_event", new=AsyncMock()),
        ):
            _, failed = await service.validate_credentials(
                actor=actor,
                account_id=account.id,
                registry=cast(MarketplaceAdapterRegistry, _Registry(AvitoCredentialAdapter(client, read_retry_policy=_NO_RETRY))),
            )

    assert failed.ok is False
    assert account.scopes_json == {}
