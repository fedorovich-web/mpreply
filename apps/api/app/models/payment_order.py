from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PaymentOrder(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payment_orders"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_payment_orders_org_idempotency"),
        UniqueConstraint("provider", "provider_payment_id", name="uq_payment_orders_provider_payment"),
        CheckConstraint(
            "status IN ('created', 'pending', 'succeeded', 'canceled', 'provider_error', "
            "'refund_review_required', 'refunded')",
            name="ck_payment_orders_status",
        ),
        CheckConstraint("amount_minor > 0", name="ck_payment_orders_amount_positive"),
        CheckConstraint("answer_quantity > 0", name="ck_payment_orders_answers_positive"),
        CheckConstraint("currency = upper(currency)", name="ck_payment_orders_currency_uppercase"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    package_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_packages.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    grant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_credit_grants.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="created", index=True)
    package_code: Mapped[str] = mapped_column(String(64), nullable=False)
    answer_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="RUB")
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    confirmation_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_provider_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
