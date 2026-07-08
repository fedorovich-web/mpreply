from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, verify_password
from app.core.errors import bad_request, unauthorized
from app.models.user import User
from app.services.audit_service import AuditService


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def register_user(self, *, email: str, password: str, name: str | None) -> User:
        normalized_email = email.strip().lower()
        user = User(
            email=normalized_email,
            name=name.strip() if name else None,
            password_hash=hash_password(password),
            status="active",
        )
        self.session.add(user)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            raise bad_request("User with this email already exists") from exc

        await self.audit.write(
            action="auth.user.registered",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={"email": normalized_email},
        )
        return user

    async def authenticate_user(self, *, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        result = await self.session.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            raise unauthorized("Invalid email or password")
        if user.status != "active":
            raise unauthorized("User account is not active")

        await self.audit.write(
            action="auth.user.login",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={"email": normalized_email},
        )
        return user
