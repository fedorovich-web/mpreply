from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.errors import unauthorized

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: UUID
    session_id: UUID | None


def create_access_token(
    *,
    user_id: UUID,
    session_id: UUID | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + (expires_delta or timedelta(minutes=settings.auth_access_token_ttl_minutes))
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "typ": "access",
    }
    if session_id is not None:
        payload["sid"] = str(session_id)
    return jwt.encode(payload, settings.auth_secret_key.get_secret_value(), algorithm="HS256")


def decode_access_claims(token: str) -> AccessTokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.auth_secret_key.get_secret_value(), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise unauthorized("Invalid or expired session") from exc

    if payload.get("typ") != "access":
        raise unauthorized("Invalid session token type")

    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise unauthorized("Invalid session subject")
    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise unauthorized("Invalid session subject") from exc

    raw_session_id = payload.get("sid")
    if raw_session_id is None:
        session_id = None
    elif isinstance(raw_session_id, str):
        try:
            session_id = UUID(raw_session_id)
        except ValueError as exc:
            raise unauthorized("Invalid session identifier") from exc
    else:
        raise unauthorized("Invalid session identifier")
    return AccessTokenClaims(user_id=user_id, session_id=session_id)


def decode_access_token(token: str) -> UUID:
    return decode_access_claims(token).user_id
