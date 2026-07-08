from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ResponseMode


class MarketplaceAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "marketplace_accounts"

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    marketplace: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    seller_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="pending")
    credentials_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    credentials_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    credentials_last_rotated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    credentials_status: Mapped[str] = mapped_column(String(64), default="pending")
    scopes_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    default_response_mode: Mapped[str] = mapped_column(String(32), default=ResponseMode.INHERIT.value)
    last_success_sync_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error_sync_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
