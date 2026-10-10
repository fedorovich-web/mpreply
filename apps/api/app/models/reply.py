from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ReplyStatus


class Reply(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "replies"
    __table_args__ = (
        ForeignKeyConstraint(
            ["message_id", "organization_id"],
            ["customer_messages.id", "customer_messages.organization_id"],
            name="fk_replies_message_tenant",
        ),
        ForeignKeyConstraint(
            ["ai_draft_id", "organization_id"],
            ["ai_drafts.id", "ai_drafts.organization_id"],
            name="fk_replies_ai_draft_tenant",
        ),
        ForeignKeyConstraint(
            ["automation_rule_id", "organization_id"],
            ["automation_rules.id", "automation_rules.organization_id"],
            name="fk_replies_automation_rule_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "created_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_replies_creator_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "approved_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_replies_approver_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "sent_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_replies_sender_tenant",
        ),
        CheckConstraint(
            "dispatch_attempt_count >= 0",
            name="ck_replies_dispatch_attempt_count_nonnegative",
        ),
        CheckConstraint(
            "((dispatch_owner IS NULL AND dispatch_lease_expires_at IS NULL) OR (dispatch_owner IS NOT NULL AND dispatch_lease_expires_at IS NOT NULL))",
            name="ck_replies_dispatch_lease_shape",
        ),
        Index("ux_replies_idempotency_key", "idempotency_key", unique=True),
        Index("ix_replies_org_status_created", "organization_id", "status", "created_at"),
        Index("ix_replies_org_rule_sent", "organization_id", "automation_rule_id", "sent_at"),
        Index("ix_replies_org_mode_status_created", "organization_id", "mode", "status", "created_at"),
        Index(
            "ix_replies_dispatch_due",
            "status",
            "next_retry_at",
            "last_dispatched_at",
            "dispatch_lease_expires_at",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    message_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    ai_draft_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    automation_rule_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(64), default=ReplyStatus.DRAFT.value, nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    worker_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dispatch_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dispatch_lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatch_attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_dispatch_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_for_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    marketplace_reply_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
