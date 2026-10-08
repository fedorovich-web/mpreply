from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_tokens import digest_auth_token, new_auth_token
from app.core.config import get_settings
from app.models.auth_session import AuthSession
from app.models.user import User


class SessionError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True, slots=True)
class RefreshSessionGrant:
    raw_token: str
    expires_at: datetime
    user_id: UUID
    auth_version: int
    family_id: UUID


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class SessionService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        now: Callable[[], datetime] | None = None,
        ttl: timedelta | None = None,
    ) -> None:
        settings = get_settings()
        self.session = session
        self._now = now or (lambda: datetime.now(UTC))
        self._ttl = ttl or timedelta(days=settings.auth_refresh_token_ttl_days)

    async def issue(self, *, user_id: UUID, auth_version: int) -> RefreshSessionGrant:
        return await self._issue(user_id=user_id, auth_version=auth_version, family_id=uuid4())

    async def _issue(self, *, user_id: UUID, auth_version: int, family_id: UUID) -> RefreshSessionGrant:
        raw_token = new_auth_token()
        expires_at = self._now() + self._ttl
        self.session.add(
            AuthSession(
                user_id=user_id,
                family_id=family_id,
                token_digest=digest_auth_token(raw_token),
                auth_version=auth_version,
                expires_at=expires_at,
                revoked_at=None,
                rotated_at=None,
            )
        )
        await self.session.flush()
        return RefreshSessionGrant(
            raw_token=raw_token,
            expires_at=expires_at,
            user_id=user_id,
            auth_version=auth_version,
            family_id=family_id,
        )

    async def rotate(self, raw_token: str) -> RefreshSessionGrant:
        now = self._now()
        result = await self.session.execute(select(AuthSession).where(AuthSession.token_digest == digest_auth_token(raw_token)).with_for_update())
        auth_session = result.scalar_one_or_none()
        if auth_session is None:
            raise SessionError("invalid_refresh_session")
        if auth_session.revoked_at is not None:
            if auth_session.rotated_at is not None:
                await self.revoke_family(auth_session.family_id, revoked_at=now)
                raise SessionError("refresh_session_reused")
            raise SessionError("invalid_refresh_session")
        if _as_utc(auth_session.expires_at) <= now:
            raise SessionError("invalid_refresh_session")

        user_result = await self.session.execute(
            select(User).where(
                User.id == auth_session.user_id,
                User.status.in_(("active", "demo")),
            )
        )
        user = user_result.scalar_one_or_none()
        if user is None or user.email_verified_at is None or user.auth_version != auth_session.auth_version:
            raise SessionError("invalid_refresh_session")

        auth_session.revoked_at = now
        auth_session.rotated_at = now
        return await self._issue(
            user_id=user.id,
            auth_version=user.auth_version,
            family_id=auth_session.family_id,
        )

    async def revoke(self, raw_token: str) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.token_digest == digest_auth_token(raw_token),
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=self._now())
        )

    async def revoke_all(self, user_id: UUID, *, revoked_at: datetime | None = None) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at or self._now())
        )

    async def revoke_family(self, family_id: UUID, *, revoked_at: datetime | None = None) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(
                AuthSession.family_id == family_id,
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at or self._now())
        )
