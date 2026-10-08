from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BillingOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_orders"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_billing_order_request"),
        UniqueConstraint("id", "organization_id", name="uq_billing_order_tenant"),
        UniqueConstraint("provider_invoice_id", name="uq_billing_order_invoice"),
        UniqueConstraint("correlation", name="uq_billing_order_correlation"),
        CheckConstraint("amount_minor > 0 AND currency = 'RUB'", name="ck_billing_order_amount"),
        CheckConstraint("monthly_credits >= 0 AND addon_credits >= 0", name="ck_billing_order_credits"),
        CheckConstraint("kind IN ('plan', 'addon')", name="ck_billing_order_kind"),
        CheckConstraint("state IN ('creating', 'pending', 'review_required', 'paid', 'failed')", name="ck_billing_order_state"),
        CheckConstraint("state <> 'paid' OR (provider_invoice_id IS NOT NULL AND paid_at IS NOT NULL)", name="ck_billing_order_paid_proof"),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    actor_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    idempotency_key: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    correlation: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB")
    monthly_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    addon_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    snapshot_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="creating", index=True)
    provider_invoice_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    payment_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(64), nullable=True)
