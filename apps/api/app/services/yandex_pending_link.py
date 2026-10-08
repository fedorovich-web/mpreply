from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import Settings
from app.core.security import CredentialEncryptionError, CredentialService
from app.models.user import User
from app.providers.yandex_id import YandexIDError, YandexProfile


class PendingYandexLink(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: UUID
    auth_version: int = Field(ge=0)
    subject: str = Field(min_length=1, max_length=128)
    client_id: str = Field(min_length=1, max_length=255)
    expires_at: datetime


def issue_pending_link(*, user: User, profile: YandexProfile, settings: Settings, now: datetime) -> str:
    link = PendingYandexLink(user_id=user.id, auth_version=user.auth_version, subject=profile.subject,
                             client_id=profile.client_id, expires_at=now + timedelta(minutes=10))
    return CredentialService(settings.credentials_encryption_key.get_secret_value()).encrypt(link.model_dump_json())


def verify_pending_link(*, token: str | None, user: User, settings: Settings, now: datetime) -> PendingYandexLink:
    if not token or len(token) > 4096:
        raise YandexIDError("oauth_expired")
    try:
        raw = CredentialService(settings.credentials_encryption_key.get_secret_value()).decrypt(token)
        link = PendingYandexLink.model_validate_json(raw)
    except (CredentialEncryptionError, ValidationError, UnicodeError, ValueError):
        raise YandexIDError("oauth_expired") from None
    if link.expires_at.tzinfo is None or link.expires_at.astimezone(UTC) <= now.astimezone(UTC):
        raise YandexIDError("oauth_expired")
    if link.user_id != user.id:
        raise YandexIDError("identity_conflict")
    if link.auth_version != user.auth_version or link.client_id != settings.yandex_oauth_client_id:
        raise YandexIDError("oauth_expired")
    return link
