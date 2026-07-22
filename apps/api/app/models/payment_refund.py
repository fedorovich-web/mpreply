from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PaymentRefund(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payment_refunds"
    __table_args__ = (
        UniqueConstraint("provider", "provider_refund_id", name="uq_payment_refunds_provider_refund"),
        CheckConstraint(
            "status IN ('succeeded', 'canceled', 'manual_review')",
            name="ck_payment_refunds_status",
        ),
        CheckConstraint("amount_minor > 0", name="ck_payment_refunds_amount_positive"),
        CheckConstraint("currency = upper(currency)", name="ck_payment_refunds_currency_uppercase"),
    )

    order_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("payment_orders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    grant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_credit_grants.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider_refund_id: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    answer_quantity_revoked: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
