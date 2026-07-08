from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token
from app.core.cookies import clear_access_cookie, set_access_cookie
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.auth import AuthSessionResponse, LoginRequest, RegisterRequest, UserResponse
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    service = AuthService(session)
    user = await service.register_user(
        email=str(payload.email),
        password=payload.password,
        name=payload.name,
    )
    token = create_access_token(user_id=user.id)
    set_access_cookie(response, token)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> AuthSessionResponse:
    service = AuthService(session)
    user = await service.authenticate_user(email=str(payload.email), password=payload.password)
    token = create_access_token(user_id=user.id)
    set_access_cookie(response, token)
    await session.commit()
    return AuthSessionResponse(user=UserResponse.model_validate(user))


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response) -> MessageResponse:
    clear_access_cookie(response)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
