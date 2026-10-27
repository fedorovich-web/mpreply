from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import bad_request, conflict, not_found
from app.models.customer_message import CustomerMessage
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.user import User
from app.schemas.message import CustomerMessageResponse, ProductSummary
from app.services.audit_service import AuditService
from app.services.organization_service import OrganizationService

_ALLOWED_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_ALLOWED_WRITE_ROLES = {"owner", "admin", "manager"}
_MANUAL_STATUSES = {"archived", "escalated"}
_PROTECTED_STATUSES = {"approved", "auto_reply_pending", "sending", "answered", "auto_reply_sent"}
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
        assigned_to: UUID | None = None,
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
            assigned_to=assigned_to,
            search=search,
        )
        stmt = (
            select(CustomerMessage, Product)
            .outerjoin(
                Product,
                (CustomerMessage.product_id == Product.id)
                & (CustomerMessage.organization_id == Product.organization_id)
                & (CustomerMessage.marketplace_account_id == Product.marketplace_account_id),
            )
            .where(CustomerMessage.organization_id == organization_id, *filters)
        )
        count_stmt = select(func.count()).select_from(CustomerMessage).where(CustomerMessage.organization_id == organization_id, *filters)
        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())

        result = await self.session.execute(
            stmt.order_by(CustomerMessage.marketplace_created_at.desc(), CustomerMessage.id.desc())
            .limit(page_size).offset((page - 1) * page_size)
        )
        return [(row[0], row[1]) for row in result.all()], total

    async def get_message(self, *, actor: User, message_id: UUID, for_update: bool = False) -> tuple[CustomerMessage, Product | None]:
        stmt = (
            select(CustomerMessage, Product)
            .join(
                OrganizationUser,
                OrganizationUser.organization_id == CustomerMessage.organization_id,
            )
            .outerjoin(
                Product,
                (CustomerMessage.product_id == Product.id)
                & (CustomerMessage.organization_id == Product.organization_id)
                & (CustomerMessage.marketplace_account_id == Product.marketplace_account_id),
            )
            .where(
                CustomerMessage.id == message_id,
                OrganizationUser.user_id == actor.id,
                OrganizationUser.status == "active",
                OrganizationUser.role.in_(_ALLOWED_READ_ROLES),
            )
        )
        if for_update:
            stmt = stmt.with_for_update(of=CustomerMessage).execution_options(populate_existing=True)
        result = await self.session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            raise not_found("Message not found")
        message, product = row[0], row[1]
        return message, product

    async def update_message(
        self,
        *,
        actor: User,
        message_id: UUID,
        status: str | None = None,
        assigned_to: UUID | None = None,
        assigned_to_supplied: bool = False,
        priority: str | None = None,
    ) -> CustomerMessage:
        message, _ = await self.get_message(actor=actor, message_id=message_id, for_update=True)
        await self.organization_service.require_membership_role(
            organization_id=message.organization_id,
            user_id=actor.id,
            allowed_roles=_ALLOWED_WRITE_ROLES,
        )
        changed: list[str] = []
        if status is not None:
            if status not in _MANUAL_STATUSES:
                raise bad_request("Unsupported message status")
            if message.status in _PROTECTED_STATUSES:
                raise conflict("Message is already handled or is being sent")
            message.status = status
            changed.append("status")
        if assigned_to is not None:
            membership_result = await self.session.execute(
                select(OrganizationUser.id).where(
                    OrganizationUser.organization_id == message.organization_id,
                    OrganizationUser.user_id == assigned_to,
                    OrganizationUser.status == "active",
                )
            )
            if membership_result.scalar_one_or_none() is None:
                raise bad_request("Assigned user must be an active organization member")
        if assigned_to_supplied or assigned_to is not None:
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

    def to_response(
        self,
        message: CustomerMessage,
        product: Product | None = None,
    ) -> CustomerMessageResponse:
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
        assigned_to: UUID | None = None,
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
        if assigned_to is not None:
            conditions.append(CustomerMessage.assigned_to == assigned_to)
        if search:
            literal_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            conditions.append(CustomerMessage.customer_text.ilike(f"%{literal_search}%", escape="\\"))
        return conditions
