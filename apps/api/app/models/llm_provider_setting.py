from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LLMProviderSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "llm_provider_settings"
    __table_args__ = (
        CheckConstraint(
            "(review_model IS NULL AND negative_review_model IS NULL AND question_model IS NULL "
            "AND chat_model IS NULL AND safety_retry_model IS NULL AND fallback_model IS NULL) OR "
            "(review_model IS NOT NULL AND negative_review_model IS NOT NULL AND question_model IS NOT NULL "
            "AND chat_model IS NOT NULL AND safety_retry_model IS NOT NULL AND fallback_model IS NOT NULL)",
            name="ck_llm_provider_settings_routes_complete",
        ),
    )

    provider: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    credential_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    review_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    negative_review_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    question_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    chat_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    safety_retry_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fallback_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
