from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AnswerReservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "answer_reservations"
    __table_args__ = (
        UniqueConstraint("reply_id", name="uq_answer_reservations_reply"),
        CheckConstraint(
            "status IN ('active', 'settled', 'released', 'expired')",
            name="ck_answer_reservations_status",
        ),
        UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_reservations_org_idempotency"),
        CheckConstraint("quantity > 0", name="ck_answer_reservations_quantity_positive"),
        CheckConstraint("revision > 0", name="ck_answer_reservations_revision_positive"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reply_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("replies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    grant_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_credit_grants.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    release_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
