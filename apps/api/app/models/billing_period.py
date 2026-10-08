from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BillingPeriod(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_periods"
    __table_args__ = (
        ForeignKeyConstraint(["order_id", "organization_id"], ["billing_orders.id", "billing_orders.organization_id"],
                             name="fk_billing_period_order_tenant"),
        UniqueConstraint("order_id", name="uq_billing_period_order"),
        CheckConstraint("ends_at > starts_at", name="ck_billing_period_interval"),
        CheckConstraint("months IN (1, 12) AND monthly_credits > 0", name="ck_billing_period_allowance"),
        CheckConstraint("next_grant_index >= 0 AND next_grant_index <= months", name="ck_billing_period_grant_index"),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    order_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("billing_plans.id"), nullable=False)
    calendar_anchor: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    months: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_credits: Mapped[int] = mapped_column(Integer, nullable=False)
    next_grant_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_grant_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
