from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class IntegrationEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "integration_events"

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    marketplace_account_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("marketplace_accounts.id"), nullable=True, index=True)
    marketplace: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    error_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message_safe: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
