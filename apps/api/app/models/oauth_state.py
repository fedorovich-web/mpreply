from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class OAuthState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "oauth_states"
    state_digest: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    browser_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    verifier_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    auth_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    locale: Mapped[str] = mapped_column(String(2), nullable=False)
    next_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    intent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
