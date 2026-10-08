from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SyncStateStatus(StrEnum):
    IDLE = "idle"
    LEASED = "leased"
    ERROR = "error"
    PAUSED = "paused"


def _empty_metadata() -> dict[str, object]:
    return {}


class MarketplaceSyncState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "marketplace_sync_states"
    __table_args__ = (
        UniqueConstraint(
            "marketplace_account_id",
            "stream",
            name="uq_marketplace_sync_states_account_stream",
        ),
        ForeignKeyConstraint(
            ["marketplace_account_id", "organization_id"],
            ["marketplace_accounts.id", "marketplace_accounts.organization_id"],
            name="fk_marketplace_sync_states_account_tenant",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "stream IN ('reviews', 'questions', 'chats')",
            name="ck_marketplace_sync_states_stream",
        ),
        CheckConstraint(
            "status IN ('idle', 'leased', 'error', 'paused')",
            name="ck_marketplace_sync_states_status",
        ),
        CheckConstraint(
            "consecutive_failures >= 0",
            name="ck_marketplace_sync_states_failures_nonnegative",
        ),
        CheckConstraint(
            "((status = 'leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) "
            "OR (status <> 'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL))",
            name="ck_marketplace_sync_states_lease_shape",
        ),
        Index("ix_marketplace_sync_states_account", "marketplace_account_id"),
        Index(
            "ix_marketplace_sync_states_due",
            "status",
            "next_run_at",
            "lease_expires_at",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    marketplace_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    stream: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=SyncStateStatus.IDLE.value)
    cursor: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=_empty_metadata)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lease_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
