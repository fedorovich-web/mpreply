from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password, verify_password
from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.core.config import get_settings
from app.core.errors import bad_request, forbidden, unauthorized
from app.models.auth_token import AuthToken
from app.models.user import User
from app.services.audit_service import AuditService

VERIFY_EMAIL_PURPOSE = "verify_email"
RESET_PASSWORD_PURPOSE = "reset_password"


@dataclass(frozen=True, slots=True)
class AuthTokenGrant:
    raw_token: str
    expires_at: datetime


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)
        self.settings = get_settings()

    async def register_user(self, *, email: str, password: str, name: str | None) -> tuple[User, bool]:
        normalized_email = email.strip().lower()
        existing = await self._find_user_by_email(normalized_email)
        if existing is not None:
            return existing, False

        user = User(
            email=normalized_email,
            name=name.strip() if name else None,
            password_hash=hash_password(password),
            status="active",
            email_verified_at=None,
            auth_version=0,
        )
        try:
            async with self.session.begin_nested():
                self.session.add(user)
                await self.session.flush()
        except IntegrityError:
            existing = await self._find_user_by_email(normalized_email)
            if existing is not None:
                return existing, False
            raise

        await self.audit.write(
            action="auth.user.registered",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={"email": normalized_email},
        )
        return user, True

    async def authenticate_user(self, *, email: str, password: str) -> User:
        normalized_email = email.strip().lower()
        user = await self._find_user_by_email(normalized_email)
        if user is None or not verify_password(password, user.password_hash):
            raise unauthorized("Invalid email or password")
        if user.status != "active":
            raise unauthorized("User account is not active")
        if user.email_verified_at is None:
            raise forbidden("Email verification is required")

        await self.audit.write(
            action="auth.user.login",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={"email": normalized_email},
        )
        return user

    async def issue_verification_token(self, user: User) -> AuthTokenGrant | None:
        if user.email_verified_at is not None or user.status != "active":
            return None
        return await self._issue_action_token(
            user=user,
            purpose=VERIFY_EMAIL_PURPOSE,
            ttl=timedelta(hours=self.settings.auth_email_verification_ttl_hours),
        )

    async def request_verification(self, *, email: str) -> tuple[User, AuthTokenGrant] | None:
        user = await self._find_user_by_email(email.strip().lower())
        if user is None:
            return None
        grant = await self.issue_verification_token(user)
        return (user, grant) if grant is not None else None

    async def verify_email(self, *, raw_token: str) -> User:
        action_token = await self._get_usable_action_token(raw_token=raw_token, purpose=VERIFY_EMAIL_PURPOSE)
        user = await self._get_user(action_token.user_id)
        now = datetime.now(UTC)
        action_token.consumed_at = now
        if user.email_verified_at is None:
            user.email_verified_at = now
            await self.audit.write(
                action="auth.user.email_verified",
                entity_type="user",
                actor_user_id=user.id,
                entity_id=str(user.id),
                metadata={},
            )
        return user

    async def request_password_reset(self, *, email: str) -> tuple[User, AuthTokenGrant] | None:
        user = await self._find_user_by_email(email.strip().lower())
        if user is None or user.status != "active" or user.email_verified_at is None:
            return None
        grant = await self._issue_action_token(
            user=user,
            purpose=RESET_PASSWORD_PURPOSE,
            ttl=timedelta(minutes=self.settings.auth_password_reset_ttl_minutes),
        )
        return (user, grant) if grant is not None else None

    async def reset_password(self, *, raw_token: str, new_password: str) -> User:
        action_token = await self._get_usable_action_token(raw_token=raw_token, purpose=RESET_PASSWORD_PURPOSE)
        user = await self._get_user(action_token.user_id)
        now = datetime.now(UTC)
        action_token.consumed_at = now
        user.password_hash = hash_password(new_password)
        user.auth_version += 1
        await self._consume_outstanding_tokens(user_id=user.id, consumed_at=now)
        await self.audit.write(
            action="auth.user.password_reset",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={},
        )
        return user

    async def change_password(self, *, user: User, current_password: str, new_password: str) -> User:
        if not verify_password(current_password, user.password_hash):
            raise bad_request("Current password is incorrect")
        if verify_password(new_password, user.password_hash):
            raise bad_request("New password must be different")

        now = datetime.now(UTC)
        user.password_hash = hash_password(new_password)
        user.auth_version += 1
        await self._consume_outstanding_tokens(user_id=user.id, consumed_at=now)
        await self.audit.write(
            action="auth.user.password_changed",
            entity_type="user",
            actor_user_id=user.id,
            entity_id=str(user.id),
            metadata={},
        )
        return user

    async def _find_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def _get_user(self, user_id: UUID) -> User:
        result = await self.session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise bad_request("Invalid or expired token")
        return user

    async def _issue_action_token(self, *, user: User, purpose: str, ttl: timedelta) -> AuthTokenGrant | None:
        now = datetime.now(UTC)
        latest_result = await self.session.execute(
            select(AuthToken)
            .where(AuthToken.user_id == user.id, AuthToken.purpose == purpose)
            .order_by(AuthToken.created_at.desc())
            .limit(1)
        )
        latest = latest_result.scalar_one_or_none()
        cooldown = timedelta(seconds=self.settings.auth_action_token_cooldown_seconds)
        if latest is not None and latest.created_at > now - cooldown:
            return None

        await self.session.execute(
            update(AuthToken)
            .where(
                AuthToken.user_id == user.id,
                AuthToken.purpose == purpose,
                AuthToken.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
        raw_token = new_auth_token()
        expires_at = now + ttl
        self.session.add(
            AuthToken(
                user_id=user.id,
                purpose=purpose,
                token_digest=digest_auth_token(raw_token),
                expires_at=expires_at,
                consumed_at=None,
            )
        )
        await self.session.flush()
        return AuthTokenGrant(raw_token=raw_token, expires_at=expires_at)

    async def _get_usable_action_token(self, *, raw_token: str, purpose: str) -> AuthToken:
        result = await self.session.execute(
            select(AuthToken)
            .where(
                AuthToken.token_digest == digest_auth_token(raw_token),
                AuthToken.purpose == purpose,
            )
            .with_for_update()
        )
        action_token = result.scalar_one_or_none()
        now = datetime.now(UTC)
        if action_token is None or action_token.consumed_at is not None or action_token.expires_at <= now:
            raise bad_request("Invalid or expired token")
        return action_token

    async def _consume_outstanding_tokens(self, *, user_id: UUID, consumed_at: datetime) -> None:
        await self.session.execute(
            update(AuthToken)
            .where(AuthToken.user_id == user_id, AuthToken.consumed_at.is_(None))
            .values(consumed_at=consumed_at)
        )
