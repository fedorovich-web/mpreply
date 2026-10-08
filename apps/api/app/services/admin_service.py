from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.models.ai_draft import AIDraft
from app.models.integration_event import IntegrationEvent
from app.models.organization import Organization
from app.models.reply import Reply
from app.models.subscription import Subscription
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.schemas.admin import AdminOverviewResponse


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

    async def _scalar_count(self, statement: Select[tuple[int]]) -> int:
        result = await self.session.execute(statement)
        return int(result.scalar_one())
