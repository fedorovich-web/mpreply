from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token
from app.core.auth_tokens import new_auth_token
from app.core.config import Settings, get_settings
from app.core.cookies import ACCESS_COOKIE_NAME, set_access_cookie, set_refresh_cookie
from app.core.rate_limit import enforce_auth_rate_limit
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.providers.yandex_id import YandexIDClient, YandexIDError
from app.services.oauth_state_service import OAuthAttempt, OAuthStateService
from app.services.session_service import SessionService
from app.services.yandex_auth_service import YandexAuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])
_STATE_COOKIE = "mpreply_yandex_state"
_STATE_PATH = "/api/auth/yandex"


class YandexStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    locale: Literal["ru", "en"] = "ru"
    next: str | None = Field(default=None, max_length=2048)
    intent: Literal["connect-marketplace"] | None = None


class AuthorizationURL(BaseModel):
    authorization_url: str


def _state_cookie(response: RedirectResponse, token: str) -> None:
    response.set_cookie(_STATE_COOKIE, token, max_age=600, secure=True, httponly=True, samesite="lax", path=_STATE_PATH)


def _enabled(settings: Settings) -> None:
    if not settings.yandex_oauth_enabled:
        raise HTTPException(status_code=503, detail="Yandex sign-in is not available")


@router.get("/providers")
async def get_auth_providers() -> dict[str, bool]:
    return {"yandex": get_settings().yandex_oauth_enabled}


@router.get("/identities")
async def get_auth_identities(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session)) -> dict[str, bool]:
    identity = await session.scalar(select(AuthIdentity.id).where(AuthIdentity.provider == "yandex", AuthIdentity.user_id == user.id))
    return {"yandex_linked": identity is not None, "can_link_yandex": get_settings().yandex_oauth_enabled and user.status == "active" and identity is None}


@router.get("/yandex/start")
async def start_yandex(
    request: Request, locale: Literal["ru", "en"] = "ru", next: str | None = Query(default=None, max_length=2048),
    intent: Literal["connect-marketplace"] | None = None, session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    settings = get_settings()
    _enabled(settings)
    await enforce_auth_rate_limit(request, scope="yandex-start", identifier=request.client.host if request.client else "unknown", limit=30, window_seconds=300)
    browser_token = new_auth_token()
    grant = await OAuthStateService(session, settings=settings).issue(browser_token=browser_token, mode="login", user=None,
                                                                     locale=locale, next_path=next, intent=intent)
    response = RedirectResponse(YandexIDClient(settings=settings).authorization_url(state=grant.state, code_challenge=grant.code_challenge), status_code=303)
    _state_cookie(response, browser_token)
    return response


@router.post("/yandex/link/start", response_model=AuthorizationURL)
async def start_yandex_link(
    payload: YandexStartRequest, request: Request, user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    settings = get_settings()
    _enabled(settings)
    await enforce_auth_rate_limit(request, scope="yandex-link", identifier=str(user.id), limit=10, window_seconds=300)
    browser_token = new_auth_token()
    grant = await OAuthStateService(session, settings=settings).issue(browser_token=browser_token, mode="link", user=user,
                                                                     locale=payload.locale, next_path=payload.next, intent=payload.intent)
    url = YandexIDClient(settings=settings).authorization_url(state=grant.state, code_challenge=grant.code_challenge)
    response = JSONResponse({"authorization_url": url})
    response.set_cookie(_STATE_COOKIE, browser_token, max_age=600, secure=True, httponly=True, samesite="lax", path=_STATE_PATH)
    return response


@router.get("/yandex/callback")
async def yandex_callback(
    request: Request, state: str | None = Query(default=None, max_length=128), code: str | None = Query(default=None, max_length=2048),
    error: str | None = Query(default=None, max_length=128), session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    settings = get_settings()
    attempt: OAuthAttempt | None = None
    await enforce_auth_rate_limit(request, scope="yandex-callback", identifier=state or "missing", limit=30, window_seconds=300)
    try:
        browser_token = request.cookies.get(_STATE_COOKIE)
        if not state or not browser_token:
            raise YandexIDError("oauth_expired")
        attempt = await OAuthStateService(session, settings=settings).consume(state=state, browser_token=browser_token, now=datetime.now(UTC))
        if error or not code:
            raise YandexIDError("oauth_failed")
        link_user = None
        if attempt.mode == "link":
            link_user = await get_current_user(request=request, session=session, access_cookie=request.cookies.get(ACCESS_COOKIE_NAME),
                                               authorization=request.headers.get("Authorization"))
        profile = await YandexIDClient(settings=settings).exchange_and_profile(code=code, code_verifier=attempt.code_verifier)
        user = await YandexAuthService(session).resolve(profile=profile, attempt=attempt, link_user=link_user, now=datetime.now(UTC))
        grant = await SessionService(session).issue(user_id=user.id, auth_version=user.auth_version)
        response = RedirectResponse(settings.web_app_url.rstrip("/") + attempt.next_path, status_code=303)
        set_access_cookie(response, create_access_token(user_id=user.id, auth_version=user.auth_version))
        set_refresh_cookie(response, grant.raw_token)
        await session.commit()
    except (YandexIDError, HTTPException) as failure:
        await session.rollback()
        locale = attempt.locale if attempt is not None else "ru"
        prefix = "/en" if locale == "en" else ""
        failure_code = failure.code if isinstance(failure, YandexIDError) else "oauth_expired"
        params = {"oauth_error": failure_code}
        if attempt is not None:
            params["next"] = attempt.next_path
            if attempt.intent is not None:
                params["intent"] = attempt.intent
        target = prefix + ("/app/account" if attempt is not None and attempt.mode == "link" else "/auth/login")
        response = RedirectResponse(settings.web_app_url.rstrip("/") + target + "?" + urlencode(params), status_code=303)
    response.delete_cookie(_STATE_COOKIE, path=_STATE_PATH, secure=True, httponly=True, samesite="lax")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response
