from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CustomerMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customer_messages"
    __table_args__ = (
        Index("ix_customer_messages_org_marketplace_status_created", "organization_id", "marketplace", "status", "marketplace_created_at"),
        Index("ix_customer_messages_org_type_status", "organization_id", "type", "status"),
        UniqueConstraint(
            "organization_id",
            "marketplace_account_id",
            "marketplace",
            "external_id",
            "type",
            name="uq_customer_messages_external",
        ),
        UniqueConstraint(
            "id",
            "organization_id",
            name="uq_customer_messages_id_organization_id",
        ),
        ForeignKeyConstraint(
            ["marketplace_account_id", "organization_id"],
            ["marketplace_accounts.id", "marketplace_accounts.organization_id"],
            name="fk_customer_messages_account_tenant",
        ),
        ForeignKeyConstraint(
            ["product_id", "organization_id", "marketplace_account_id"],
            ["products.id", "products.organization_id", "products.marketplace_account_id"],
            name="fk_customer_messages_product_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "assigned_to"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_customer_messages_assignee_tenant",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    marketplace_account_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    product_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    marketplace: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    customer_display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_text: Mapped[str] = mapped_column(Text, nullable=False)
    customer_photos_json: Mapped[list[object]] = mapped_column(JSONB, default=list)
    marketplace_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_to: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    priority: Mapped[str] = mapped_column(String(32), default="normal")
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
