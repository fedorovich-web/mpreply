from __future__ import annotations

from fastapi import Response

from app.core.config import get_settings

ACCESS_COOKIE_NAME = "mpreply_access"
LEGACY_ACCESS_COOKIE_NAME = "respio_access"
_ACCESS_COOKIE_NAMES = (ACCESS_COOKIE_NAME, LEGACY_ACCESS_COOKIE_NAME)


def set_access_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=token,
        max_age=settings.auth_access_token_ttl_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )


def clear_access_cookie(response: Response) -> None:
    settings = get_settings()
    for cookie_name in _ACCESS_COOKIE_NAMES:
        response.delete_cookie(
            key=cookie_name,
            httponly=True,
            secure=settings.auth_cookie_secure,
            samesite=settings.auth_cookie_samesite,
            path="/",
        )
