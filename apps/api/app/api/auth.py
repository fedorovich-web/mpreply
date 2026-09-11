from __future__ import annotations

from urllib.parse import urlencode

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token
from app.core.config import Settings, get_settings
from app.core.cookies import (
    REFRESH_COOKIE_NAME,
    clear_access_cookie,
    clear_refresh_cookie,
    set_access_cookie,
    set_refresh_cookie,
)
from app.core.rate_limit import enforce_auth_rate_limit
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthSessionResponse,
    EmailActionRequest,
    LoginRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    RegisterRequest,
    TokenActionRequest,
    UserResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService
from app.services.session_service import SessionError, SessionService
from app.services.transactional_email import (
    EmailDeliveryError,
    ResendEmailClient,
    TransactionalEmail,
    build_password_changed_email,
    build_password_reset_email,
    build_verification_email,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = structlog.get_logger(__name__)

_REGISTERED_MESSAGE = "Если адрес доступен для регистрации, мы отправили письмо для подтверждения email."
_RESEND_MESSAGE = "Если аккаунту требуется подтверждение, новое письмо будет отправлено."
_RESET_REQUEST_MESSAGE = "Если аккаунт существует, мы отправим инструкции по восстановлению пароля."


def _action_url(settings: Settings, path: str, token: str) -> str:
    return f"{settings.web_app_url.rstrip('/')}{path}?{urlencode({'token': token})}"


async def _deliver(message: TransactionalEmail, settings: Settings, *, kind: str) -> bool:
    try:
        await ResendEmailClient(settings).send(message)
        return True
    except EmailDeliveryError as exc:
        logger.warning("transactional_email_delivery_failed", kind=kind, error_type=type(exc).__name__)
        return False


async def _notify_best_effort(message: TransactionalEmail, settings: Settings, *, kind: str) -> None:
    await _deliver(message, settings, kind=kind)


def _clear_session_cookies(response: Response) -> None:
    clear_access_cookie(response)
    clear_refresh_cookie(response)


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def register(
    payload: RegisterRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    normalized_email = str(payload.email).strip().lower()
    await enforce_auth_rate_limit(
        request,
        scope="register",
        identifier=normalized_email,
        limit=5,
        window_seconds=3600,
    )

    service = AuthService(session)
    user, created = await service.register_user(
        email=normalized_email,
        password=payload.password,
        name=payload.name,
    )
    grant = await service.issue_verification_token(user)

    if grant is not None:
        delivered = await _deliver(
            build_verification_email(
                recipient=user.email,
                verification_url=_action_url(settings, "/auth/verify-email", grant.raw_token),
                sender=settings.transactional_email_from,
                reply_to=settings.support_email,
            ),
            settings,
            kind="verification",
        )
        if not delivered:
            await session.rollback()
            if created:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Email delivery is temporarily unavailable",
                )
            return MessageResponse(message=_REGISTERED_MESSAGE)

    await session.commit()
    return MessageResponse(message=_REGISTERED_MESSAGE)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    payload: TokenActionRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    await enforce_auth_rate_limit(
        request,
        scope="verify-email",
        identifier=payload.token,
        limit=10,
        window_seconds=900,
    )
    service = AuthService(session)
    await service.verify_email(raw_token=payload.token)
    await session.commit()
    return MessageResponse(message="Email подтверждён. Теперь можно войти в аккаунт.")


@router.post("/resend-verification", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def resend_verification(
    payload: EmailActionRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    normalized_email = str(payload.email).strip().lower()
    await enforce_auth_rate_limit(
        request,
        scope="resend-verification",
        identifier=normalized_email,
        limit=5,
        window_seconds=3600,
    )
    service = AuthService(session)
    verification_request = await service.request_verification(email=normalized_email)
    if verification_request is not None:
        user, grant = verification_request
        delivered = await _deliver(
            build_verification_email(
                recipient=user.email,
                verification_url=_action_url(settings, "/auth/verify-email", grant.raw_token),
                sender=settings.transactional_email_from,
                reply_to=settings.support_email,
            ),
            settings,
            kind="verification",
        )
        if not delivered:
            await session.rollback()
            return MessageResponse(message=_RESEND_MESSAGE)
    await session.commit()
    return MessageResponse(message=_RESEND_MESSAGE)


@router.post("/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: EmailActionRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    normalized_email = str(payload.email).strip().lower()
    await enforce_auth_rate_limit(
        request,
        scope="forgot-password",
        identifier=normalized_email,
        limit=5,
        window_seconds=3600,
    )
    service = AuthService(session)
    reset_request = await service.request_password_reset(email=normalized_email)
    if reset_request is not None:
        user, grant = reset_request
        delivered = await _deliver(
            build_password_reset_email(
                recipient=user.email,
                reset_url=_action_url(settings, "/auth/reset-password", grant.raw_token),
                expires_at=grant.expires_at,
                sender=settings.transactional_email_from,
                reply_to=settings.support_email,
            ),
            settings,
            kind="password-reset",
        )
        if not delivered:
            await session.rollback()
            return MessageResponse(message=_RESET_REQUEST_MESSAGE)
    await session.commit()
    return MessageResponse(message=_RESET_REQUEST_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: PasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    await enforce_auth_rate_limit(
        request,
        scope="reset-password",
        identifier=payload.token,
        limit=10,
        window_seconds=900,
    )
    service = AuthService(session)
    user = await service.reset_password(raw_token=payload.token, new_password=payload.new_password)
    await session.commit()
    await _notify_best_effort(
        build_password_changed_email(
            recipient=user.email,
            sender=settings.transactional_email_from,
            reply_to=settings.support_email,
        ),
        settings,
        kind="password-changed",
    )
    return MessageResponse(message="Пароль изменён. Войдите с новым паролем.")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    await enforce_auth_rate_limit(
        request,
        scope="change-password",
        identifier=str(current_user.id),
        limit=5,
        window_seconds=3600,
    )
    service = AuthService(session)
    user = await service.change_password(
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    await session.commit()
    _clear_session_cookies(response)
    await _notify_best_effort(
        build_password_changed_email(
            recipient=user.email,
            sender=settings.transactional_email_from,
            reply_to=settings.support_email,
        ),
        settings,
        kind="password-changed",
    )
    return MessageResponse(message="Пароль изменён. Войдите снова.")


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    normalized_email = str(payload.email).strip().lower()
    await enforce_auth_rate_limit(
        request,
        scope="login",
        identifier=normalized_email,
        limit=10,
        window_seconds=300,
    )
    service = AuthService(session)
    user = await service.authenticate_user(email=normalized_email, password=payload.password)
    refresh_grant = await SessionService(session).issue(
        user_id=user.id,
        auth_version=user.auth_version,
    )
    access_token = create_access_token(user_id=user.id, auth_version=user.auth_version)
    set_access_cookie(response, access_token)
    set_refresh_cookie(response, refresh_grant.raw_token)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=MessageResponse)
async def refresh_session(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_refresh_token:
        _clear_session_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session is missing",
        )

    session_service = SessionService(session)
    try:
        grant = await session_service.rotate(raw_refresh_token)
    except SessionError as exc:
        await session.rollback()
        _clear_session_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh session is invalid or expired",
        ) from exc

    access_token = create_access_token(
        user_id=grant.user_id,
        auth_version=grant.auth_version,
    )
    set_access_cookie(response, access_token)
    set_refresh_cookie(response, grant.raw_token)
    await session.commit()
    return MessageResponse(message="Session refreshed")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    raw_refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_refresh_token:
        await SessionService(session).revoke(raw_refresh_token)
        await session.commit()
    _clear_session_cookies(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
