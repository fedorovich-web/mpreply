from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CustomerMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customer_messages"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "marketplace_account_id",
            "marketplace",
            "external_id",
            "type",
            name="uq_customer_messages_external",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    marketplace_account_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("marketplace_accounts.id"), nullable=False, index=True)
    product_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("products.id"), nullable=True, index=True)
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
