from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AnswerCreditGrant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "answer_credit_grants"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_credit_grants_org_idempotency"),
        CheckConstraint(
            "source_type IN ('trial', 'purchase', 'manual_adjustment', 'reversal')",
            name="ck_answer_credit_grants_source_type",
        ),
        CheckConstraint("original_quantity > 0", name="ck_answer_credit_grants_original_positive"),
        CheckConstraint("remaining_quantity >= 0", name="ck_answer_credit_grants_remaining_non_negative"),
        CheckConstraint("remaining_quantity <= original_quantity", name="ck_answer_credit_grants_remaining_lte_original"),
        Index(
            "uq_answer_credit_grants_one_trial_per_org",
            "organization_id",
            unique=True,
            postgresql_where=text("source_type = 'trial'"),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    package_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_packages.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    original_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    revoke_reason: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    granted_by_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
