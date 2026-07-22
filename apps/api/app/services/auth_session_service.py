from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import unauthorized
from app.models.auth_session import AuthSession
from app.models.user import User
from app.services.audit_service import AuditService

_REFRESH_TOKEN_BYTES = 48


@dataclass(frozen=True)
class IssuedSession:
    session: AuthSession
    refresh_token: str


@dataclass(frozen=True)
class RotatedSession:
    user: User
    session: AuthSession
    refresh_token: str


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(_REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuthSessionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def issue(
        self,
        *,
        user: User,
        ttl_days: int,
        ip_address: str | None,
        user_agent: str | None,
        family_id: UUID | None = None,
    ) -> IssuedSession:
        raw_token = generate_refresh_token()
        now = datetime.now(UTC)
        auth_session = AuthSession(
            user_id=user.id,
            family_id=family_id or uuid4(),
            token_hash=hash_refresh_token(raw_token),
            status="active",
            expires_at=now + timedelta(days=ttl_days),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.session.add(auth_session)
        await self.session.flush()
        await self.audit.write(
            action="auth.session.created",
            entity_type="auth_session",
            actor_user_id=user.id,
            entity_id=str(auth_session.id),
            metadata={"family_id": str(auth_session.family_id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return IssuedSession(session=auth_session, refresh_token=raw_token)

    async def rotate(
        self,
        *,
        refresh_token: str,
        ttl_days: int,
        ip_address: str | None,
        user_agent: str | None,
    ) -> RotatedSession:
        token_hash = hash_refresh_token(refresh_token)
        result = await self.session.execute(
            select(AuthSession).where(AuthSession.token_hash == token_hash).with_for_update()
        )
        current = result.scalar_one_or_none()
        if current is None:
            raise unauthorized("Invalid or expired refresh session")

        now = datetime.now(UTC)
        if current.status != "active":
            await self._revoke_family(
                family_id=current.family_id,
                reason="refresh_token_reuse",
                actor_user_id=current.user_id,
                now=now,
            )
            raise unauthorized("Refresh session reuse detected")
        if current.expires_at <= now:
            current.status = "expired"
            current.revoked_at = now
            await self.session.flush()
            raise unauthorized("Invalid or expired refresh session")

        user_result = await self.session.execute(select(User).where(User.id == current.user_id))
        user = user_result.scalar_one_or_none()
        if user is None or user.status != "active":
            await self._revoke_family(
                family_id=current.family_id,
                reason="inactive_user",
                actor_user_id=current.user_id,
                now=now,
            )
            raise unauthorized("User account is not active")

        issued = await self.issue(
            user=user,
            ttl_days=ttl_days,
            ip_address=ip_address,
            user_agent=user_agent,
            family_id=current.family_id,
        )
        current.status = "rotated"
        current.last_used_at = now
        current.revoked_at = now
        current.replaced_by_session_id = issued.session.id
        await self.session.flush()
        await self.audit.write(
            action="auth.session.rotated",
            entity_type="auth_session",
            actor_user_id=user.id,
            entity_id=str(current.id),
            metadata={"replacement_session_id": str(issued.session.id)},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return RotatedSession(user=user, session=issued.session, refresh_token=issued.refresh_token)

    async def require_active(self, *, session_id: UUID, user_id: UUID) -> AuthSession:
        result = await self.session.execute(
            select(AuthSession).where(AuthSession.id == session_id, AuthSession.user_id == user_id)
        )
        auth_session = result.scalar_one_or_none()
        if auth_session is None or auth_session.status != "active" or auth_session.expires_at <= datetime.now(UTC):
            raise unauthorized("Session is no longer active")
        return auth_session

    async def revoke_by_refresh_token(
        self,
        *,
        refresh_token: str | None,
        actor_user_id: UUID | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        if not refresh_token:
            return
        result = await self.session.execute(
            select(AuthSession).where(AuthSession.token_hash == hash_refresh_token(refresh_token)).with_for_update()
        )
        auth_session = result.scalar_one_or_none()
        if auth_session is None or auth_session.status != "active":
            return
        now = datetime.now(UTC)
        auth_session.status = "revoked"
        auth_session.revoked_at = now
        await self.session.flush()
        await self.audit.write(
            action="auth.session.revoked",
            entity_type="auth_session",
            actor_user_id=actor_user_id or auth_session.user_id,
            entity_id=str(auth_session.id),
            metadata={"scope": "current"},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def revoke_for_user(
        self,
        *,
        user_id: UUID,
        session_id: UUID,
        actor_user_id: UUID,
    ) -> bool:
        result = await self.session.execute(
            select(AuthSession)
            .where(
                AuthSession.id == session_id,
                AuthSession.user_id == user_id,
                AuthSession.status == "active",
            )
            .with_for_update()
        )
        auth_session = result.scalar_one_or_none()
        if auth_session is None:
            return False
        if auth_session.status == "active":
            auth_session.status = "revoked"
            auth_session.revoked_at = datetime.now(UTC)
            await self.session.flush()
            await self.audit.write(
                action="auth.session.revoked",
                entity_type="auth_session",
                actor_user_id=actor_user_id,
                entity_id=str(auth_session.id),
                metadata={"scope": "selected"},
            )
        return True

    async def revoke_all(self, *, user_id: UUID, actor_user_id: UUID) -> int:
        now = datetime.now(UTC)
        result = await self.session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.status == "active")
            .values(status="revoked", revoked_at=now)
            .returning(AuthSession.id)
        )
        count = len(list(result.scalars().all()))
        await self.audit.write(
            action="auth.sessions.revoked_all",
            entity_type="auth_session",
            actor_user_id=actor_user_id,
            metadata={"revoked_count": count},
        )
        return count

    async def list_for_user(self, *, user_id: UUID) -> list[AuthSession]:
        result = await self.session.execute(
            select(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.status == "active",
                AuthSession.expires_at > datetime.now(UTC),
            )
            .order_by(AuthSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def _revoke_family(
        self,
        *,
        family_id: UUID,
        reason: str,
        actor_user_id: UUID,
        now: datetime,
    ) -> None:
        await self.session.execute(
            update(AuthSession)
            .where(AuthSession.family_id == family_id, AuthSession.status == "active")
            .values(status="reuse_detected", revoked_at=now)
        )
        await self.audit.write(
            action="auth.session.family_revoked",
            entity_type="auth_session",
            actor_user_id=actor_user_id,
            entity_id=str(family_id),
            metadata={"reason": reason},
        )
