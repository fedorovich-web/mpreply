from __future__ import annotations

import base64
import hashlib
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.providers.yandex_id import YandexIDClient, YandexIDError, pkce_challenge


def yandex_settings(**overrides: object) -> Settings:
    return Settings.model_validate({"yandex_oauth_enabled": True, "yandex_oauth_client_id": "test-client-id-123456789",
                                    "yandex_oauth_client_secret": SecretStr("test-client-secret-123456789"),
                                    "credentials_encryption_key": SecretStr(Fernet.generate_key().decode()),
                                    "api_base_url": "https://api.mpreply.ru", "web_app_url": "https://app.mpreply.ru", **overrides})


@pytest.mark.parametrize("field", ["yandex_oauth_client_id", "yandex_oauth_client_secret", "credentials_encryption_key"])
def test_yandex_enabled_requires_complete_credentials(field: str) -> None:
    with pytest.raises(ValidationError):
        yandex_settings(**{field: ""})


def test_authorization_url_uses_code_fixed_callback_and_s256() -> None:
    settings = yandex_settings()
    challenge = pkce_challenge("a" * 64)
    assert challenge == base64.urlsafe_b64encode(hashlib.sha256(b"a" * 64).digest()).decode().rstrip("=")
    url = urlparse(YandexIDClient(settings=settings).authorization_url(state="random-state", code_challenge=challenge))
    assert url.scheme == "https" and url.netloc == "oauth.yandex.ru" and url.path == "/authorize"
    params = parse_qs(url.query)
    assert params["response_type"] == ["code"]
    assert params["redirect_uri"] == ["https://api.mpreply.ru/api/auth/yandex/callback"]
    assert params["scope"] == ["login:email login:info"]
    assert params["code_challenge_method"] == ["S256"]
    assert "test-client-secret" not in url.query


@pytest.mark.asyncio
async def test_code_exchange_and_profile_stay_on_backend() -> None:
    settings = yandex_settings()
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth.yandex.ru":
            assert request.method == "POST" and request.url.path == "/token"
            params = parse_qs(request.content.decode())
            assert params["code_verifier"] == ["v" * 64]
            assert params["code"] == ["one-use-code"]
            return httpx.Response(200, json={"access_token": "secret-token", "token_type": "bearer"})
        assert request.url.host == "login.yandex.ru" and request.url.path == "/info"
        assert request.headers["Authorization"] == "OAuth secret-token"
        return httpx.Response(200, json={"id": "123", "client_id": settings.yandex_oauth_client_id, "default_email": "Buyer@Example.com",
                                        "real_name": "Buyer", "sex": "male", "birthday": "1990-01-01"})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        profile = await YandexIDClient(settings=settings, http=http).exchange_and_profile(code="one-use-code", code_verifier="v" * 64)
    assert (profile.subject, profile.default_email, profile.name) == ("123", "buyer@example.com", "Buyer")
    assert "secret-token" not in repr(profile)
    assert not hasattr(profile, "sex")


@pytest.mark.asyncio
@pytest.mark.parametrize("override", [{"client_id": "other-client"}, {"id": ""}, {"id": " id "}, {"default_email": "bad-address"}])
async def test_invalid_provider_identity_is_rejected(override: dict[str, str]) -> None:
    settings = yandex_settings()
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth.yandex.ru":
            return httpx.Response(200, json={"access_token": "secret"})
        return httpx.Response(200, json={"id": "123", "client_id": settings.yandex_oauth_client_id, "default_email": "buyer@example.com", **override})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        with pytest.raises(YandexIDError):
            await YandexIDClient(settings=settings, http=http).exchange_and_profile(code="code", code_verifier="v" * 64)
