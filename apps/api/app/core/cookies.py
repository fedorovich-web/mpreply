from __future__ import annotations

from fastapi import Response

from app.core.config import get_settings

ACCESS_COOKIE_NAME = "mpreply_access"
REFRESH_COOKIE_NAME = "mpreply_refresh"


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


def set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.auth_refresh_token_ttl_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/api/auth",
    )


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=ACCESS_COOKIE_NAME,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/api/auth",
    )


def clear_access_cookie(response: Response) -> None:
    clear_auth_cookies(response)
