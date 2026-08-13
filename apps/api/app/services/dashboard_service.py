from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.user import User
from app.schemas.dashboard import DashboardAttentionItem, DashboardAttentionResponse
from app.services.organization_service import OrganizationService


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organizations = OrganizationService(session)

    async def attention(self, *, organization_id: UUID, actor: User) -> DashboardAttentionResponse:
        await self.organizations.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles={"owner", "admin", "manager", "viewer"},
        )
        manual_review = await self._message_count(
            organization_id,
            {"waiting_review", "needs_manual_check", "escalated"},
        )
        failed = await self._message_count(
            organization_id,
            {"failed", "blocked_by_marketplace", "safety_blocked"},
        )
        needs_reply = await self._message_count(organization_id, {"new", "imported", "needs_reply"})
        integration_result = await self.session.execute(
            select(func.count()).select_from(MarketplaceAccount).where(
                MarketplaceAccount.organization_id == organization_id,
                or_(
                    MarketplaceAccount.status != "active",
                    MarketplaceAccount.credentials_status != "valid",
                    MarketplaceAccount.error_count > 0,
                ),
            )
        )
        integration_issues = int(integration_result.scalar_one())
        candidates = [
            DashboardAttentionItem(key="failed", title="Ошибки обработки", count=failed, href="/app/inbox?status=failed", severity="danger"),
            DashboardAttentionItem(key="manual_review", title="Нужна ручная проверка", count=manual_review, href="/app/review-queue", severity="warning"),
            DashboardAttentionItem(key="needs_reply", title="Ждут ответа", count=needs_reply, href="/app/inbox?status=needs_reply", severity="info"),
        ]
        return DashboardAttentionResponse(
            organization_id=organization_id,
            items=[item for item in candidates if item.count > 0],
            integration_issues=integration_issues,
        )

    async def _message_count(self, organization_id: UUID, statuses: set[str]) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(CustomerMessage).where(
                CustomerMessage.organization_id == organization_id,
                CustomerMessage.status.in_(statuses),
            )
        )
        return int(result.scalar_one())
