from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReplyCreditGrant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reply_credit_grants"
    __table_args__ = (
        Index("ix_reply_credit_grants_expiry_due", "expires_at", postgresql_where=text("expires_at IS NOT NULL AND available > 0")),
        UniqueConstraint("organization_id", "source_key", name="uq_reply_credit_grant_source"),
        UniqueConstraint("id", "organization_id", name="uq_reply_credit_grant_tenant"),
        CheckConstraint("quantity > 0 AND available >= 0 AND reserved >= 0 AND consumed >= 0 AND expired >= 0", name="ck_reply_credit_grant_nonnegative"),
        CheckConstraint("quantity = available + reserved + consumed + expired", name="ck_reply_credit_grant_conservation"),
        CheckConstraint("kind IN ('trial', 'monthly', 'addon')", name="ck_reply_credit_grant_kind"),
        CheckConstraint("(kind = 'trial' AND expires_at IS NOT NULL) OR (kind <> 'trial' AND expires_at IS NULL)", name="ck_reply_credit_grant_expiry"),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    source_key: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    available: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expired: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ReplyCreditOperation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reply_credit_operations"
    __table_args__ = (
        Index("ix_reply_credit_operations_recovery_due", "lease_expires_at", postgresql_where=text("state = 'reserved'")),
        UniqueConstraint("organization_id", "operation_key", name="uq_reply_credit_operation_key"),
        UniqueConstraint("id", "organization_id", name="uq_reply_credit_operation_tenant"),
        UniqueConstraint("draft_id", name="uq_reply_credit_operation_draft"),
        ForeignKeyConstraint(
            ["grant_id", "organization_id"], ["reply_credit_grants.id", "reply_credit_grants.organization_id"], name="fk_reply_credit_operation_grant_tenant"
        ),
        ForeignKeyConstraint(["draft_id", "organization_id"], ["ai_drafts.id", "ai_drafts.organization_id"], name="fk_reply_credit_operation_draft_tenant"),
        CheckConstraint("state IN ('reserved', 'completed', 'released')", name="ck_reply_credit_operation_state"),
        CheckConstraint(
            "(state = 'completed' AND draft_id IS NOT NULL) OR (state <> 'completed' AND draft_id IS NULL)", name="ck_reply_credit_operation_draft"
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    operation_key: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    grant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    state: Mapped[str] = mapped_column(String(16), default="reserved", nullable=False)
    lease_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    draft_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    release_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ReplyCreditEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reply_credit_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["grant_id", "organization_id"], ["reply_credit_grants.id", "reply_credit_grants.organization_id"], name="fk_reply_credit_event_grant_tenant"
        ),
        ForeignKeyConstraint(
            ["operation_id", "organization_id"],
            ["reply_credit_operations.id", "reply_credit_operations.organization_id"],
            name="fk_reply_credit_event_operation_tenant",
        ),
        CheckConstraint("quantity > 0", name="ck_reply_credit_event_positive"),
        CheckConstraint("kind IN ('grant', 'reserve', 'consume', 'release', 'expire')", name="ck_reply_credit_event_kind"),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    grant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    operation_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ReplyTrialClaim(Base):
    __tablename__ = "reply_trial_claims"
    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_reply_trial_claim_organization"),
        ForeignKeyConstraint(
            ["grant_id", "organization_id"],
            ["reply_credit_grants.id", "reply_credit_grants.organization_id"],
            name="fk_reply_trial_claim_grant_tenant",
        ),
        CheckConstraint("ends_at > starts_at", name="ck_reply_trial_claim_period"),
    )

    owner_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    grant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
