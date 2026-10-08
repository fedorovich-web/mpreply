from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AutomaticDraftJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "automatic_draft_jobs"
    __table_args__ = (
        UniqueConstraint("message_id", name="uq_automatic_draft_job_message"),
        ForeignKeyConstraint(
            ["message_id", "organization_id"], ["customer_messages.id", "customer_messages.organization_id"],
            name="fk_automatic_draft_job_message_tenant",
        ),
        ForeignKeyConstraint(
            ["draft_id", "organization_id"], ["ai_drafts.id", "ai_drafts.organization_id"],
            name="fk_automatic_draft_job_draft_tenant",
        ),
        CheckConstraint("state IN ('pending', 'dispatched', 'processing', 'completed', 'failed')", name="ck_automatic_draft_job_state"),
        CheckConstraint("attempt_count >= 0 AND attempt_count <= 4", name="ck_automatic_draft_job_attempts"),
        Index("ix_automatic_draft_jobs_due", "state", "next_attempt_at", "lease_expires_at"),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    message_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    operation_key: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    state: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lease_token: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    draft_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(64), nullable=True)
