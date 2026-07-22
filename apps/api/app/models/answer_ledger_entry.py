from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class AnswerLedgerEntry(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "answer_ledger_entries"
    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_ledger_entries_org_idempotency"),
        CheckConstraint(
            "entry_type IN ('grant', 'reserve', 'release', 'debit', 'reversal')",
            name="ck_answer_ledger_entries_entry_type",
        ),
        CheckConstraint(
            "balance_delta <> 0 OR available_delta <> 0",
            name="ck_answer_ledger_entries_non_zero_delta",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    grant_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_credit_grants.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    reservation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("answer_reservations.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    reply_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("replies.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    balance_delta: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    available_delta: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
