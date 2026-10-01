from __future__ import annotations

import hmac
import secrets
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.core.config import Settings, get_settings
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.oauth_state import OAuthState
from app.models.user import User
from app.providers.yandex_id import YandexIDError, pkce_challenge
from app.services.reply_credit_service import utc


@dataclass(frozen=True, slots=True)
class OAuthStart:
    state: str = field(repr=False)
    code_challenge: str


@dataclass(frozen=True, slots=True)
class OAuthAttempt:
    mode: str
    user_id: UUID | None
    auth_version: int | None
    locale: str
    next_path: str
    intent: str | None
    code_verifier: str = field(repr=False)


def safe_next_path(value: str | None, *, locale: str, intent: str | None) -> str:
    prefix = "/en/app" if locale == "en" else "/app"
    default = prefix + ("/integrations" if intent == "connect-marketplace" else "/dashboard")
    if not value or len(value) > 2048 or any(ord(char) < 32 for char in value) or "\\" in value:
        return default
    try:
        parsed = urlsplit(value)
    except ValueError:
        return default
    if (parsed.scheme or parsed.netloc or parsed.fragment or "%" in parsed.path
            or any(part in {".", ".."} for part in parsed.path.split("/")) or "//" in parsed.path
            or not (parsed.path == prefix or parsed.path.startswith(prefix + "/"))):
        return default
    return value


class OAuthStateService:
    def __init__(self, session: AsyncSession, *, settings: Settings | None = None) -> None:
        self.session = session
        self.settings = settings or get_settings()

    async def issue(
        self, *, browser_token: str, mode: str, user: User | None, locale: str, next_path: str | None, intent: str | None,
    ) -> OAuthStart:
        if not self.settings.yandex_oauth_enabled:
            raise YandexIDError("oauth_disabled")
        if mode not in {"login", "link"} or locale not in {"ru", "en"} or intent not in {None, "connect-marketplace"}:
            raise YandexIDError("oauth_invalid_request")
        if mode == "link" and (user is None or user.status != "active"):
            raise YandexIDError("oauth_invalid_request")
        state, verifier = new_auth_token(), secrets.token_urlsafe(48)
        self.session.add(OAuthState(state_digest=digest_auth_token(state), browser_digest=digest_auth_token(browser_token),
                                    verifier_encrypted=CredentialService(self.settings.credentials_encryption_key.get_secret_value()).encrypt(verifier),
                                    mode=mode, user_id=user.id if mode == "link" and user is not None else None,
                                    auth_version=user.auth_version if mode == "link" and user is not None else None,
                                    locale=locale, next_path=safe_next_path(next_path, locale=locale, intent=intent), intent=intent,
                                    expires_at=datetime.now(UTC) + timedelta(minutes=10)))
        await self.session.commit()
        return OAuthStart(state, pkce_challenge(verifier))

    async def consume(self, *, state: str, browser_token: str, now: datetime) -> OAuthAttempt:
        if not self.settings.yandex_oauth_enabled or len(state) > 128 or len(browser_token) > 128:
            raise YandexIDError("oauth_expired")
        row = await self.session.scalar(select(OAuthState).where(OAuthState.state_digest == digest_auth_token(state)).with_for_update())
        if (row is None or row.consumed_at is not None or utc(row.expires_at) <= utc(now)
                or not hmac.compare_digest(row.browser_digest, digest_auth_token(browser_token))):
            raise YandexIDError("oauth_expired")
        row.consumed_at = now
        encrypted = row.verifier_encrypted
        data = (row.mode, row.user_id, row.auth_version, row.locale, row.next_path, row.intent)
        row.verifier_encrypted = ""  # A consumed verifier must not remain decryptable in the database.
        await self.session.commit()  # Consume before code exchange, including canceled/error callbacks.
        try:
            verifier = CredentialService(self.settings.credentials_encryption_key.get_secret_value()).decrypt(encrypted)
        except CredentialEncryptionError:
            raise YandexIDError("oauth_expired") from None
        return OAuthAttempt(*data, code_verifier=verifier)
