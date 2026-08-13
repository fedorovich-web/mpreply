from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, decode_access_claims
from app.core.config import get_settings
from app.core.cookies import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    set_access_cookie,
    set_refresh_cookie,
)
from app.core.errors import not_found, unauthorized
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.dependencies.rate_limit import get_auth_rate_limiter
from app.models.user import User
from app.schemas.auth import AuthSessionResponse, LoginRequest, RegisterRequest, UserResponse
from app.schemas.common import MessageResponse
from app.schemas.session import AuthSessionInfo
from app.services.auth_rate_limit_service import AuthRateLimiter
from app.services.auth_service import AuthService
from app.services.auth_session_service import AuthSessionService

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_metadata(request: Request) -> tuple[str | None, str | None]:
    ip_address = request.client.host if request.client is not None else None
    user_agent = request.headers.get("user-agent")
    return ip_address, user_agent[:500] if user_agent else None


async def _set_new_session(
    *,
    response: Response,
    request: Request,
    session: AsyncSession,
    user: User,
) -> None:
    settings = get_settings()
    ip_address, user_agent = _client_metadata(request)
    issued = await AuthSessionService(session).issue(
        user=user,
        ttl_days=settings.auth_refresh_token_ttl_days,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    access_token = create_access_token(user_id=user.id, session_id=issued.session.id)
    set_access_cookie(response, access_token)
    set_refresh_cookie(response, issued.refresh_token)


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    request: Request,
    rate_limiter: AuthRateLimiter = Depends(get_auth_rate_limiter),
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    await rate_limiter.enforce_registration(
        email=str(payload.email),
        client_ip=request.client.host if request.client is not None else None,
    )
    service = AuthService(session)
    user = await service.register_user(email=str(payload.email), password=payload.password, name=payload.name)
    await _set_new_session(response=response, request=request, session=session, user=user)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    rate_limiter: AuthRateLimiter = Depends(get_auth_rate_limiter),
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    await rate_limiter.enforce_login(
        email=str(payload.email),
        client_ip=request.client.host if request.client is not None else None,
    )
    service = AuthService(session)
    user = await service.authenticate_user(email=str(payload.email), password=payload.password)
    await _set_new_session(response=response, request=request, session=session, user=user)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=AuthSessionResponse)
async def refresh(
    response: Response,
    request: Request,
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    rate_limiter: AuthRateLimiter = Depends(get_auth_rate_limiter),
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    if not refresh_cookie:
        raise unauthorized("Refresh session required")
    await rate_limiter.enforce_refresh(
        refresh_token=refresh_cookie,
        client_ip=request.client.host if request.client is not None else None,
    )
    settings = get_settings()
    ip_address, user_agent = _client_metadata(request)
    try:
        rotated = await AuthSessionService(session).rotate(
            refresh_token=refresh_cookie,
            ttl_days=settings.auth_refresh_token_ttl_days,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except HTTPException:
        await session.commit()
        clear_auth_cookies(response)
        raise
    set_access_cookie(
        response,
        create_access_token(user_id=rotated.user.id, session_id=rotated.session.id),
    )
    set_refresh_cookie(response, rotated.refresh_token)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(rotated.user))


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    request: Request,
    refresh_cookie: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    ip_address, user_agent = _client_metadata(request)
    await AuthSessionService(session).revoke_by_refresh_token(
        refresh_token=refresh_cookie,
        actor_user_id=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    clear_auth_cookies(response)
    await session.commit()
    return MessageResponse(message="Logged out")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    await AuthSessionService(session).revoke_all(user_id=current_user.id, actor_user_id=current_user.id)
    clear_auth_cookies(response)
    await session.commit()
    return MessageResponse(message="All sessions revoked")


@router.get("/sessions", response_model=list[AuthSessionInfo])
async def list_sessions(
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[AuthSessionInfo]:
    current_session_id = None
    if access_cookie:
        current_session_id = decode_access_claims(access_cookie).session_id
    sessions = await AuthSessionService(session).list_for_user(user_id=current_user.id)
    return [
        AuthSessionInfo(
            id=item.id,
            status=item.status,
            expires_at=item.expires_at,
            last_used_at=item.last_used_at,
            ip_address=item.ip_address,
            user_agent=item.user_agent,
            current=item.id == current_session_id,
            created_at=item.created_at,
        )
        for item in sessions
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: UUID,
    response: Response,
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    revoked = await AuthSessionService(session).revoke_for_user(
        user_id=current_user.id,
        session_id=session_id,
        actor_user_id=current_user.id,
    )
    if not revoked:
        raise not_found("Session not found")
    if access_cookie and decode_access_claims(access_cookie).session_id == session_id:
        clear_auth_cookies(response)
    await session.commit()
    return MessageResponse(message="Session revoked")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
