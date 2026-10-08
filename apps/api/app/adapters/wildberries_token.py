from __future__ import annotations

import base64
import binascii
import json
from hashlib import sha256
from typing import cast
from uuid import UUID


def token_payload(credential: str) -> dict[str, object] | None:
    """Decode routing metadata only; WB remains the signature/auth authority."""
    if not credential or credential != credential.strip() or len(credential) > 16_384:
        return None
    segments = credential.split(".")
    if len(segments) != 3 or not segments[1]:
        return None
    try:
        payload: object = json.loads(base64.b64decode(
            segments[1] + "=" * (-len(segments[1]) % 4), altchars=b"-_", validate=True,
        ), object_pairs_hook=_unique_object)
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return None
    return cast(dict[str, object], payload) if isinstance(payload, dict) else None


def quota_identity(credential: str) -> str:
    payload = token_payload(credential)
    seller = payload.get("sid") if payload else None
    if isinstance(seller, str):
        try:
            return f"seller:{UUID(seller)}"
        except ValueError:
            pass
    return f"credential:{credential}"


def seller_identity_hash(credential: str) -> str | None:
    """Bind an own installation to a seller, without exposing its UUID or key."""
    payload = token_payload(credential)
    seller = payload.get("sid") if payload else None
    if not isinstance(seller, str):
        return None
    try:
        identity = f"seller:{UUID(seller)}"
    except ValueError:
        return None
    return sha256(identity.encode()).hexdigest()


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result
