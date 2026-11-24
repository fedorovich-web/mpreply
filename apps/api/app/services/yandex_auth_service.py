from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_identity import AuthIdentity
from app.models.user import User
from app.providers.yandex_id import YandexIDError, YandexProfile
from app.services.audit_service import AuditService
from app.services.oauth_state_service import OAuthAttempt


def _active(user: User) -> User:
    if user.status != "active" or user.email_verified_at is None:
        raise YandexIDError("oauth_account_unavailable")
    return user


class YandexAuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def _identity_user(self, subject: str, *, lock_for_login: bool = False) -> User | None:
        statement = select(User).join(AuthIdentity, AuthIdentity.user_id == User.id).where(
            AuthIdentity.provider == "yandex", AuthIdentity.subject == subject,
        )
        if lock_for_login:
            statement = statement.with_for_update(of=User, key_share=True).execution_options(populate_existing=True)
        return await self.session.scalar(statement)

    async def resolve(self, *, profile: YandexProfile, attempt: OAuthAttempt, now: datetime, link_user: User | None = None) -> User:
        existing = await self._identity_user(profile.subject, lock_for_login=attempt.mode == "login")
        if attempt.mode == "link":
            if link_user is None or link_user.id != attempt.user_id:
                raise YandexIDError("oauth_expired")
            user = await self.session.scalar(select(User).where(User.id == link_user.id).with_for_update()
                                             .execution_options(populate_existing=True))
            if user is None or user.auth_version != attempt.auth_version:
                raise YandexIDError("oauth_expired")
            _active(user)
            if existing is not None:
                if existing.id != user.id:
                    raise YandexIDError("identity_conflict")
                return user
            current = await self.session.scalar(select(AuthIdentity.id).where(AuthIdentity.provider == "yandex", AuthIdentity.user_id == user.id))
            if current is not None:
                raise YandexIDError("identity_conflict")
            try:
                async with self.session.begin_nested():
                    self.session.add(AuthIdentity(provider="yandex", subject=profile.subject, user_id=user.id))
                    await self.session.flush()
            except IntegrityError:
                raise YandexIDError("identity_conflict") from None
            await self.audit.write(action="auth.identity.linked", entity_type="user", actor_user_id=user.id, entity_id=str(user.id),
                                   metadata={"provider": "yandex"})
            return user
        if attempt.mode != "login":
            raise YandexIDError("oauth_invalid_request")
        if existing is not None:
            return _active(existing)
        if profile.default_email is None:
            raise YandexIDError("email_required")
        email = profile.default_email.strip().lower()
        if await self.session.scalar(select(User.id).where(User.email == email)) is not None:
            existing = await self._identity_user(profile.subject, lock_for_login=True)
            if existing is not None:
                return _active(existing)
            raise YandexIDError("account_link_required")
        user = User(email=email, name=profile.name, password_hash=None, status="active", email_verified_at=now, auth_version=0)
        try:
            async with self.session.begin_nested():
                self.session.add(user)
                await self.session.flush()
                self.session.add(AuthIdentity(provider="yandex", subject=profile.subject, user_id=user.id))
                await self.session.flush()
        except IntegrityError:
            existing = await self._identity_user(profile.subject, lock_for_login=True)
            if existing is not None:
                return _active(existing)
            if await self.session.scalar(select(User.id).where(User.email == email)) is not None:
                raise YandexIDError("account_link_required") from None
            raise
        await self.audit.write(action="auth.user.registered", entity_type="user", actor_user_id=user.id, entity_id=str(user.id),
                               metadata={"provider": "yandex", "email_confirmation_source": "yandex_id_default_email"})
        return user
