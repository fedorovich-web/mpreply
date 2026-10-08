from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from typing import cast
from urllib.parse import urlencode

import httpx
from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.config import Settings, get_settings

_EMAIL: TypeAdapter[EmailStr] = TypeAdapter(EmailStr)


class YandexIDError(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class YandexProfile:
    subject: str
    client_id: str
    default_email: str | None
    name: str | None


def pkce_challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")


class YandexIDClient:
    def __init__(self, *, settings: Settings | None = None, http: httpx.AsyncClient | None = None) -> None:
        self.settings = settings or get_settings()
        self.http = http

    @property
    def redirect_uri(self) -> str:
        return self.settings.api_base_url.rstrip("/") + "/api/auth/yandex/callback"

    def authorization_url(self, *, state: str, code_challenge: str) -> str:
        if not self.settings.yandex_oauth_enabled:
            raise YandexIDError("oauth_disabled")
        return "https://oauth.yandex.ru/authorize?" + urlencode({"response_type": "code", "client_id": self.settings.yandex_oauth_client_id,
                                                               "redirect_uri": self.redirect_uri, "scope": "login:email login:info", "state": state,
                                                               "code_challenge": code_challenge, "code_challenge_method": "S256"})

    async def _request(self, *, method: str, url: str, data: dict[str, str] | None = None, headers: dict[str, str] | None = None) -> dict[str, object]:
        try:
            if self.http is None:
                async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
                    response = await client.request(method, url, data=data, headers=headers)
            else:
                response = await self.http.request(method, url, data=data, headers=headers)
            if not 200 <= response.status_code < 300:
                raise YandexIDError("oauth_provider_failed")
            raw: object = response.json()
            if not isinstance(raw, dict):
                raise YandexIDError("oauth_profile_invalid")
            return cast(dict[str, object], raw)
        except (httpx.HTTPError, ValueError):
            raise YandexIDError("oauth_provider_failed") from None

    async def exchange_and_profile(self, *, code: str, code_verifier: str) -> YandexProfile:
        if not self.settings.yandex_oauth_enabled:
            raise YandexIDError("oauth_disabled")
        result = await self._request(method="POST", url="https://oauth.yandex.ru/token", data={
            "grant_type": "authorization_code", "code": code, "client_id": self.settings.yandex_oauth_client_id,
            "client_secret": self.settings.yandex_oauth_client_secret.get_secret_value(), "code_verifier": code_verifier,
        })
        token = result.get("access_token")
        if not isinstance(token, str) or not token or len(token) > 4096 or any(char.isspace() for char in token):
            raise YandexIDError("oauth_provider_failed")
        profile = await self._request(method="GET", url="https://login.yandex.ru/info?format=json", headers={"Authorization": "OAuth " + token})
        client_id, subject = profile.get("client_id"), profile.get("id")
        if (client_id != self.settings.yandex_oauth_client_id or not isinstance(subject, str) or not subject.isascii()
                or not 0 < len(subject) <= 128 or any(char.isspace() for char in subject)):
            raise YandexIDError("oauth_profile_invalid")
        raw_email = profile.get("default_email")
        email: str | None = None
        if raw_email is not None:
            try:
                email = str(_EMAIL.validate_python(raw_email)).strip().lower()
            except ValidationError:
                raise YandexIDError("email_required") from None
        name = profile.get("real_name", profile.get("display_name"))
        return YandexProfile(subject, self.settings.yandex_oauth_client_id, email, name.strip()[:128] if isinstance(name, str) and name.strip() else None)
