from __future__ import annotations

from hashlib import sha256
from secrets import token_urlsafe

_TOKEN_BYTES = 32


def new_auth_token() -> str:
    """Return a high-entropy opaque token suitable for one-time email actions."""
    return token_urlsafe(_TOKEN_BYTES)


def digest_auth_token(token: str) -> str:
    """Return the only representation of an action token that may be persisted."""
    return sha256(token.encode("utf-8")).hexdigest()
