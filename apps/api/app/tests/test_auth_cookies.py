from __future__ import annotations

import pytest
from fastapi import Response

from app.core import cookies as cookie_module
from app.core.config import Settings
from app.core.cookies import clear_refresh_cookie, set_refresh_cookie


def hardened_settings() -> Settings:
    return Settings(auth_cookie_secure=True, auth_refresh_token_ttl_days=30)


def test_refresh_cookie_is_persistent_and_hardened(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = hardened_settings()
    monkeypatch.setattr(cookie_module, "get_settings", lambda: settings)
    response = Response()

    set_refresh_cookie(response, "opaque-refresh-token")

    cookie = response.headers["set-cookie"]
    assert cookie.startswith("respio_refresh=opaque-refresh-token;")
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/api/auth" in cookie
    assert "Max-Age=2592000" in cookie
    assert "Domain=" not in cookie


def test_refresh_cookie_removal_uses_same_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = hardened_settings()
    monkeypatch.setattr(cookie_module, "get_settings", lambda: settings)
    response = Response()

    clear_refresh_cookie(response)

    cookie = response.headers["set-cookie"]
    assert cookie.startswith('respio_refresh="";')
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/api/auth" in cookie
    assert "Max-Age=0" in cookie
