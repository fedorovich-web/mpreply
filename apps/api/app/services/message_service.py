from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import bad_request, not_found
from app.models.customer_message import CustomerMessage
from app.models.product import Product
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService

_ALLOWED_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_ALLOWED_WRITE_ROLES = {"owner", "admin", "manager"}
_ALLOWED_STATUSES = {
    "new",
    "imported",
    "needs_reply",
    "auto_rule_matched",
    "auto_reply_pending",
    "ai_draft_ready",
    "safety_blocked",
    "needs_manual_check",
    "waiting_review",
    "approved",
    "sending",
    "answered",
    "auto_reply_sent",
    "failed",
    "blocked_by_marketplace",
    "duplicate",
    "skipped",
    "archived",
    "escalated",
}
_ALLOWED_PRIORITIES = {"low", "normal", "high", "urgent"}


class MessageService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organization_service = OrganizationService(session)
        self.audit = AuditService(session)

    async def list_messages(
        self,
        *,
        actor: User,
        organization_id: UUID,
        marketplace: str | None = None,
        message_type: str | None = None,
        status: str | None = None,
        rating_min: int | None = None,
        rating_max: int | None = None,
        product_id: UUID | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[tuple[CustomerMessage, Product | None]], int]:
        await self.organization_service.require_membership_role(
            organization_id=organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_READ_ROLES,
        )
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)

        filters = self._build_filter_conditions(
            marketplace=marketplace,
            message_type=message_type,
            status=status,
            rating_min=rating_min,
            rating_max=rating_max,
            product_id=product_id,
            search=search,
        )
        stmt = (
            select(CustomerMessage, Product)
            .outerjoin(Product, CustomerMessage.product_id == Product.id)
            .where(CustomerMessage.organization_id == organization_id, *filters)
        )
        count_stmt = (
            select(func.count())
            .select_from(CustomerMessage)
            .where(CustomerMessage.organization_id == organization_id, *filters)
        )
        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())

        result = await self.session.execute(
            stmt.order_by(CustomerMessage.marketplace_created_at.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        return [(row[0], row[1]) for row in result.all()], total

    async def get_message(self, *, actor: User, message_id: UUID) -> tuple[CustomerMessage, Product | None]:
        result = await self.session.execute(
            select(CustomerMessage, Product)
            .outerjoin(Product, CustomerMessage.product_id == Product.id)
            .where(CustomerMessage.id == message_id)
        )
        row = result.one_or_none()
        if row is None:
            raise not_found("Message not found")
        message, product = row[0], row[1]
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_READ_ROLES,
        )
        return message, product

    async def update_message(
        self,
        *,
        actor: User,
        message_id: UUID,
        status: str | None = None,
        assigned_to: UUID | None = None,
        priority: str | None = None,
    ) -> CustomerMessage:
        message, _ = await self.get_message(actor=actor, message_id=message_id)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_WRITE_ROLES,
        )
        changed: list[str] = []
        if status is not None:
            if status not in _ALLOWED_STATUSES:
                raise bad_request("Unsupported message status")
            message.status = status
            changed.append("status")
        if assigned_to is not None:
            message.assigned_to = assigned_to
            changed.append("assigned_to")
        if priority is not None:
            if priority not in _ALLOWED_PRIORITIES:
                raise bad_request("Unsupported message priority")
            message.priority = priority
            changed.append("priority")
        await self.session.flush()
        await self.audit.write(
            action="customer_message.updated",
            entity_type="customer_message",
            organization_id=message.organization_id,
            actor_user_id=actor.id,
            entity_id=str(message.id),
            metadata={"fields_changed": changed},
        )
        return message

    def to_response(self, message: CustomerMessage, product: Product | None = None):
        from app.schemas.message import CustomerMessageResponse, ProductSummary

        product_summary = None
        if product is not None:
            product_summary = ProductSummary(
                id=product.id,
                external_id=product.external_id,
                sku=product.sku,
                name=product.name,
                brand=product.brand,
                category=product.category,
                image_url=product.image_url,
                product_url=product.product_url,
            )
        return CustomerMessageResponse(
            id=message.id,
            organization_id=message.organization_id,
            marketplace_account_id=message.marketplace_account_id,
            product_id=message.product_id,
            marketplace=message.marketplace,
            external_id=message.external_id,
            type=message.type,
            status=message.status,
            rating=message.rating,
            customer_display_name=message.customer_display_name,
            customer_text=message.customer_text,
            customer_photos_json=message.customer_photos_json or [],
            marketplace_created_at=message.marketplace_created_at,
            imported_at=message.imported_at,
            last_synced_at=message.last_synced_at,
            assigned_to=message.assigned_to,
            priority=message.priority,
            metadata_json=message.metadata_json or {},
            product=product_summary,
            created_at=message.created_at,
            updated_at=message.updated_at,
        )

    @staticmethod
    def _build_filter_conditions(
        *,
        marketplace: str | None,
        message_type: str | None,
        status: str | None,
        rating_min: int | None,
        rating_max: int | None,
        product_id: UUID | None,
        search: str | None,
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = []
        if marketplace:
            conditions.append(CustomerMessage.marketplace == marketplace)
        if message_type:
            conditions.append(CustomerMessage.type == message_type)
        if status:
            conditions.append(CustomerMessage.status == status)
        if rating_min is not None:
            conditions.append(CustomerMessage.rating >= rating_min)
        if rating_max is not None:
            conditions.append(CustomerMessage.rating <= rating_max)
        if product_id is not None:
            conditions.append(CustomerMessage.product_id == product_id)
        if search:
            conditions.append(CustomerMessage.customer_text.ilike(f"%{search}%"))
        return conditions

