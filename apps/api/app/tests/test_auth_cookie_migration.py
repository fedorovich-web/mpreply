from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import Response

from app.core import cookies
from app.dependencies.auth import _resolve_access_token


def _cookie_settings() -> SimpleNamespace:
    return SimpleNamespace(
        auth_access_token_ttl_minutes=30,
        auth_cookie_secure=True,
        auth_cookie_samesite="lax",
    )


def test_set_access_cookie_uses_mpreply_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cookies, "get_settings", _cookie_settings)
    response = Response()

    cookies.set_access_cookie(response, "token-value")

    header = response.headers["set-cookie"]
    assert "mpreply_access=token-value" in header
    assert "respio_access=" not in header
    assert "HttpOnly" in header
    assert "Secure" in header
    assert "SameSite=lax" in header


def test_clear_access_cookie_clears_primary_and_legacy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cookies, "get_settings", _cookie_settings)
    response = Response()

    cookies.clear_access_cookie(response)

    headers = response.headers.getlist("set-cookie")
    assert len(headers) == 2
    assert any("mpreply_access=" in header and "Max-Age=0" in header for header in headers)
    assert any("respio_access=" in header and "Max-Age=0" in header for header in headers)
    assert all("HttpOnly" in header and "Secure" in header and "SameSite=lax" in header for header in headers)


def test_access_token_resolution_prefers_primary_cookie() -> None:
    token = _resolve_access_token(
        access_cookie="primary-token",
        legacy_access_cookie="legacy-token",
        authorization="Bearer header-token",
    )

    assert token == "primary-token"


def test_access_token_resolution_accepts_legacy_cookie_fallback() -> None:
    token = _resolve_access_token(
        access_cookie=None,
        legacy_access_cookie="legacy-token",
        authorization="Bearer header-token",
    )

    assert token == "legacy-token"


def test_access_token_resolution_keeps_bearer_fallback() -> None:
    token = _resolve_access_token(
        access_cookie=None,
        legacy_access_cookie=None,
        authorization="Bearer header-token",
    )

    assert token == "header-token"
