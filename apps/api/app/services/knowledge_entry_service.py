from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy import Select, and_, case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request, forbidden, not_found
from app.models.knowledge_entry import KnowledgeEntry
from app.models.marketplace_account import MarketplaceAccount
from app.models.organization import OrganizationUser
from app.models.product import Product
from app.models.user import User
from app.schemas.knowledge_entry import (
    KnowledgeCategory,
    KnowledgeEntryCreateRequest,
    KnowledgeEntryResponse,
    KnowledgeEntryUpdateRequest,
    KnowledgeStatus,
)
from app.services.audit_service import AuditService

_READ_ROLES = {"owner", "admin", "manager", "viewer"}
_WRITE_ROLES = {"owner", "admin"}


class KnowledgeEntryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.audit = AuditService(session)

    async def list_for_actor(
        self,
        *,
        organization_id: UUID,
        actor: User,
        search: str | None,
        status: KnowledgeStatus | None,
        category: KnowledgeCategory | None,
    ) -> list[KnowledgeEntry]:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_READ_ROLES)
        statement = self._list_statement(
            organization_id=organization_id,
            search=search,
            status=status,
            category=category,
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        organization_id: UUID,
        actor: User,
        payload: KnowledgeEntryCreateRequest,
    ) -> KnowledgeEntry:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        account_id, product_id = await self._validated_scope(
            organization_id=organization_id,
            marketplace_account_id=payload.marketplace_account_id,
            product_id=payload.product_id,
        )
        entry = KnowledgeEntry(
            organization_id=organization_id,
            marketplace_account_id=account_id,
            product_id=product_id,
            category=payload.category,
            title=payload.title,
            content=payload.content,
            status=payload.status,
            created_by=actor.id,
            updated_by=actor.id,
        )
        self.session.add(entry)
        await self.session.flush()
        await self.audit.write(
            action="knowledge_entry.created",
            entity_type="knowledge_entry",
            organization_id=organization_id,
            actor_user_id=actor.id,
            entity_id=str(entry.id),
            metadata={"category": entry.category, "scope": self._scope_name(entry)},
        )
        return entry

    async def update(
        self,
        *,
        organization_id: UUID,
        entry_id: UUID,
        actor: User,
        payload: KnowledgeEntryUpdateRequest,
    ) -> KnowledgeEntry:
        await self._require_role(organization_id=organization_id, user_id=actor.id, allowed_roles=_WRITE_ROLES)
        result = await self.session.execute(
            select(KnowledgeEntry)
            .where(KnowledgeEntry.id == entry_id, KnowledgeEntry.organization_id == organization_id)
            .with_for_update()
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            raise not_found("Knowledge entry not found")

        changes = payload.model_dump(exclude_unset=True)
        if "marketplace_account_id" in changes or "product_id" in changes:
            account_id, product_id = await self._validated_scope(
                organization_id=organization_id,
                marketplace_account_id=cast(UUID | None, changes.get("marketplace_account_id", entry.marketplace_account_id)),
                product_id=cast(UUID | None, changes.get("product_id", entry.product_id)),
            )
            changes["marketplace_account_id"] = account_id
            changes["product_id"] = product_id

        changed_fields: list[str] = []
        for field_name, value in changes.items():
            if getattr(entry, field_name) == value:
                continue
            setattr(entry, field_name, value)
            changed_fields.append(field_name)
        if changed_fields:
            entry.updated_by = actor.id
            await self.session.flush()
            await self.audit.write(
                action="knowledge_entry.updated",
                entity_type="knowledge_entry",
                organization_id=organization_id,
                actor_user_id=actor.id,
                entity_id=str(entry.id),
                metadata={"changed_fields": changed_fields},
            )
        return entry

    async def context_for_message(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
        product_id: UUID | None,
        max_characters: int = 8000,
    ) -> str | None:
        character_limit = min(max(max_characters, 1), 8000)
        global_scope = and_(
            KnowledgeEntry.marketplace_account_id.is_(None),
            KnowledgeEntry.product_id.is_(None),
        )
        scope_conditions = [global_scope]
        if marketplace_account_id is not None:
            scope_conditions.append(
                and_(
                    KnowledgeEntry.marketplace_account_id == marketplace_account_id,
                    KnowledgeEntry.product_id.is_(None),
                )
            )
        if product_id is not None:
            scope_conditions.append(KnowledgeEntry.product_id == product_id)

        scope_order = case(
            (KnowledgeEntry.product_id.is_not(None), 0),
            (KnowledgeEntry.marketplace_account_id.is_not(None), 1),
            else_=2,
        )
        result = await self.session.execute(
            select(KnowledgeEntry)
            .where(
                KnowledgeEntry.organization_id == organization_id,
                KnowledgeEntry.status == "active",
                or_(*scope_conditions),
            )
            .order_by(scope_order, KnowledgeEntry.updated_at.desc(), KnowledgeEntry.id)
        )
        entries = list(result.scalars().all())
        entries.sort(key=self._context_sort_key)

        sections: list[str] = []
        used = 0
        for entry in entries:
            section = f"[{entry.category}] {entry.title}\n{entry.content.strip()}"
            separator_size = 2 if sections else 0
            if used + separator_size + len(section) > character_limit:
                break
            sections.append(section)
            used += separator_size + len(section)
        return "\n\n".join(sections) or None

    @staticmethod
    def _list_statement(
        *,
        organization_id: UUID,
        search: str | None,
        status: KnowledgeStatus | None,
        category: KnowledgeCategory | None,
    ) -> Select[tuple[KnowledgeEntry]]:
        statement = select(KnowledgeEntry).where(KnowledgeEntry.organization_id == organization_id)
        if status is not None:
            statement = statement.where(KnowledgeEntry.status == status)
        if category is not None:
            statement = statement.where(KnowledgeEntry.category == category)
        if search is not None and search.strip():
            pattern = f"%{search.strip()}%"
            statement = statement.where(
                or_(KnowledgeEntry.title.ilike(pattern), KnowledgeEntry.content.ilike(pattern))
            )
        return statement.order_by(KnowledgeEntry.updated_at.desc(), KnowledgeEntry.id)

    async def _validated_scope(
        self,
        *,
        organization_id: UUID,
        marketplace_account_id: UUID | None,
        product_id: UUID | None,
    ) -> tuple[UUID | None, UUID | None]:
        account: MarketplaceAccount | None = None
        if marketplace_account_id is not None:
            result = await self.session.execute(
                select(MarketplaceAccount).where(MarketplaceAccount.id == marketplace_account_id)
            )
            account = result.scalar_one_or_none()
            if account is None or account.organization_id != organization_id:
                raise not_found("Marketplace account not found")

        if product_id is None:
            return marketplace_account_id, None
        result = await self.session.execute(select(Product).where(Product.id == product_id))
        product = result.scalar_one_or_none()
        if product is None or product.organization_id != organization_id:
            raise not_found("Product not found")
        if account is not None and product.marketplace_account_id != account.id:
            raise bad_request("Product does not belong to the selected marketplace account")
        return product.marketplace_account_id, product.id

    @staticmethod
    def _context_sort_key(entry: KnowledgeEntry) -> tuple[int, float, str]:
        priority = 0 if entry.product_id is not None else 1 if entry.marketplace_account_id is not None else 2
        return priority, -entry.updated_at.timestamp(), str(entry.id)

    @staticmethod
    def _scope_name(entry: KnowledgeEntry) -> str:
        if entry.product_id is not None:
            return "product"
        if entry.marketplace_account_id is not None:
            return "marketplace_account"
        return "organization"

    @staticmethod
    def to_response(entry: KnowledgeEntry) -> KnowledgeEntryResponse:
        return KnowledgeEntryResponse(
            id=entry.id,
            organization_id=entry.organization_id,
            marketplace_account_id=entry.marketplace_account_id,
            product_id=entry.product_id,
            category=cast(KnowledgeCategory, entry.category),
            title=entry.title,
            content=entry.content,
            status=cast(KnowledgeStatus, entry.status),
            created_by=entry.created_by,
            updated_by=entry.updated_by,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )

    async def _require_role(
        self,
        *,
        organization_id: UUID,
        user_id: UUID,
        allowed_roles: set[str],
    ) -> OrganizationUser:
        result = await self.session.execute(
            select(OrganizationUser).where(
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.user_id == user_id,
                OrganizationUser.status == "active",
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            raise not_found("Organization membership not found")
        if membership.role not in allowed_roles:
            raise forbidden("You do not have permission to perform this action")
        return membership
