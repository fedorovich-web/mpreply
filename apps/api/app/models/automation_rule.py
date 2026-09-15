from uuid import UUID

from sqlalchemy import Boolean, Float, ForeignKey, ForeignKeyConstraint, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AutomationRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "automation_rules"
    __table_args__ = (
        UniqueConstraint("id", "organization_id", name="uq_automation_rules_id_organization_id"),
        ForeignKeyConstraint(
            ["marketplace_account_id", "organization_id"],
            ["marketplace_accounts.id", "marketplace_accounts.organization_id"],
            name="fk_automation_rules_account_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "created_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_automation_rules_creator_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "updated_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_automation_rules_updater_tenant",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    marketplace_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    applies_to: Mapped[str] = mapped_column(String(32), nullable=False)
    marketplace: Mapped[str | None] = mapped_column(String(64), nullable=True)
    min_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    product_ids_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    category_ids_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    include_keywords_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    exclude_keywords_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    sensitive_topics_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    daily_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hourly_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    require_manual_review_on_flags: Mapped[bool] = mapped_column(Boolean, default=True)
    stop_on_missing_product_context: Mapped[bool] = mapped_column(Boolean, default=True)
    stop_on_low_confidence: Mapped[bool] = mapped_column(Boolean, default=True)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.8)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
