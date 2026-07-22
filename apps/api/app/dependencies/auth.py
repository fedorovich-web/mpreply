from __future__ import annotations

from fastapi import Cookie, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_access_claims
from app.core.cookies import ACCESS_COOKIE_NAME
from app.core.errors import unauthorized
from app.db.session import get_db_session
from app.models.user import User
from app.services.auth_session_service import AuthSessionService


async def get_current_user(
    session: AsyncSession = Depends(get_db_session),
    access_cookie: str | None = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> User:
    token = access_cookie
    if token is None and authorization:
        prefix = "Bearer "
        if authorization.startswith(prefix):
            token = authorization[len(prefix) :].strip()

    if not token:
        raise unauthorized("Authentication required")

    claims = decode_access_claims(token)
    result = await session.execute(select(User).where(User.id == claims.user_id))
    user = result.scalar_one_or_none()
    if user is None or user.status != "active":
        raise unauthorized("User account is not active")
    if claims.session_id is not None:
        await AuthSessionService(session).require_active(session_id=claims.session_id, user_id=user.id)
    return user
