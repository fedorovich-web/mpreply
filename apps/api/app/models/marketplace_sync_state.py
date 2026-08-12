from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import MarketplaceSyncStateStatus


class MarketplaceSyncState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "marketplace_sync_states"
    __table_args__ = (
        UniqueConstraint("marketplace_account_id", "stream", name="uq_marketplace_sync_states_account_stream"),
        CheckConstraint("stream IN ('reviews', 'questions', 'chats')", name="ck_marketplace_sync_states_stream"),
        CheckConstraint(
            "status IN ('idle', 'leased', 'error', 'paused')",
            name="ck_marketplace_sync_states_status",
        ),
        CheckConstraint("consecutive_failures >= 0", name="ck_marketplace_sync_states_failures_nonnegative"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    marketplace_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("marketplace_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stream: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=MarketplaceSyncStateStatus.PAUSED.value,
        index=True,
    )
    cursor: Mapped[str | None] = mapped_column(String(512), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    cycle_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_cycle_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_token: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    last_worker_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
