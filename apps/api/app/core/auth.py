from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.errors import unauthorized

_password_hash = PasswordHash.recommended()


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: UUID
    auth_version: int


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def create_access_token(
    *,
    user_id: UUID,
    auth_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + (expires_delta or timedelta(minutes=settings.auth_access_token_ttl_minutes))
    payload: dict[str, object] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "typ": "access",
        "ver": auth_version,
    }
    return jwt.encode(payload, settings.auth_secret_key.get_secret_value(), algorithm="HS256")


def decode_access_token_claims(token: str) -> AccessTokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key.get_secret_value(),
            algorithms=["HS256"],
            options={"require": ["sub", "iat", "exp", "typ", "ver"]},
        )
    except jwt.PyJWTError as exc:
        raise unauthorized("Invalid or expired session") from exc

    if payload.get("typ") != "access":
        raise unauthorized("Invalid session type")
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise unauthorized("Invalid session subject")
    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise unauthorized("Invalid session subject") from exc

    auth_version = payload.get("ver")
    if type(auth_version) is not int or auth_version < 0:
        raise unauthorized("Invalid session version")
    return AccessTokenClaims(user_id=user_id, auth_version=auth_version)


def decode_access_token(token: str) -> UUID:
    return decode_access_token_claims(token).user_id
