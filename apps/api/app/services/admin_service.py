from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.errors import conflict, forbidden, not_found
from app.models.ai_draft import AIDraft
from app.models.integration_event import IntegrationEvent
from app.models.organization import Organization
from app.models.reply import Reply
from app.models.subscription import Subscription
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.schemas.admin import AdminOverviewResponse, AdminUserAction, AdminUserResponse, AdminUsersResponse
from app.services.audit_service import AuditService
from app.services.session_service import SessionService


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def overview(self) -> AdminOverviewResponse:
        now = datetime.now(UTC)
        since_30d = now - timedelta(days=30)
        since_24h = now - timedelta(hours=24)

        organizations_total = await self._scalar_count(select(func.count(Organization.id)))
        organizations_active = await self._scalar_count(select(func.count(Organization.id)).where(Organization.status == "active"))
        users_total = await self._scalar_count(select(func.count(User.id)))
        subscriptions_active = await self._scalar_count(select(func.count(Subscription.id)).where(Subscription.status.in_({"active", "trialing"})))
        usage_events_30d = await self._scalar_count(select(func.count(UsageEvent.id)).where(UsageEvent.created_at >= since_30d))
        integration_failures_24h = await self._scalar_count(
            select(func.count(IntegrationEvent.id)).where(
                IntegrationEvent.status == "failed",
                IntegrationEvent.created_at >= since_24h,
            )
        )
        replies_failed_24h = await self._scalar_count(
            select(func.count(Reply.id)).where(
                Reply.status == "failed",
                Reply.updated_at >= since_24h,
            )
        )
        cost_result = await self.session.execute(select(func.coalesce(func.sum(AIDraft.cost_estimate), 0)).where(AIDraft.created_at >= since_30d))
        cost_raw = cost_result.scalar_one()
        cost = float(cost_raw) if isinstance(cost_raw, (Decimal, float, int)) else 0.0

        return AdminOverviewResponse(
            generated_at=now,
            organizations_total=organizations_total,
            organizations_active=organizations_active,
            users_total=users_total,
            subscriptions_active=subscriptions_active,
            usage_events_30d=usage_events_30d,
            ai_cost_estimate_30d=cost,
            integration_failures_24h=integration_failures_24h,
            replies_failed_24h=replies_failed_24h,
        )

    async def list_users(self, *, q: str, limit: int, offset: int) -> AdminUsersResponse:
        statement = select(User)
        count = select(func.count(User.id))
        if q:
            match = or_(User.email.icontains(q, autoescape=True), User.name.icontains(q, autoescape=True))
            statement = statement.where(match)
            count = count.where(match)
        users = await self.session.scalars(statement.order_by(User.created_at.desc(), User.id.desc()).limit(limit).offset(offset))
        return AdminUsersResponse(
            items=[AdminUserResponse.model_validate(user) for user in users],
            total=await self._scalar_count(count),
        )

    async def apply_user_action(self, *, actor_id: UUID, user_id: UUID, action: AdminUserAction) -> AdminUserResponse:
        user = await self.session.scalar(
            select(User).where(User.id == user_id).with_for_update(key_share=True).execution_options(populate_existing=True)
        )
        if user is None:
            raise not_found("User not found")
        if user.id == actor_id or user.is_superadmin or user.status == "demo":
            raise forbidden("This account is protected")

        previous_status = user.status
        if action != "revoke_sessions":
            expected_status, new_status = ("active", "blocked") if action == "block" else ("blocked", "active")
            if user.status == new_status:
                return AdminUserResponse.model_validate(user)
            if user.status != expected_status:
                raise conflict("User status does not allow this action")
            user.status = new_status

        # An account blocked outside this route may still have old credentials.
        user.auth_version += 1
        await SessionService(self.session).revoke_all(user.id)

        audit_actions = {
            "block": "admin.user.blocked",
            "unblock": "admin.user.unblocked",
            "revoke_sessions": "admin.user.sessions_revoked",
        }
        await AuditService(self.session).write(
            action=audit_actions[action], entity_type="user", actor_user_id=actor_id, entity_id=str(user.id),
            metadata={"previous_status": previous_status, "status": user.status},
        )
        return AdminUserResponse.model_validate(user)

    async def _scalar_count(self, statement: Select[tuple[int]]) -> int:
        result = await self.session.execute(statement)
        return int(result.scalar_one())
