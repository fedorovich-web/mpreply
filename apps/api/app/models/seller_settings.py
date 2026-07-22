from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SellerSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "seller_settings"
    __table_args__ = (
        UniqueConstraint("organization_id", name="uq_seller_settings_organization"),
        CheckConstraint(
            "response_tone IN ('neutral', 'friendly', 'formal', 'apologetic')",
            name="ck_seller_settings_response_tone",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    response_tone: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    brand_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_base: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_signature: Mapped[str | None] = mapped_column(String(500), nullable=True)
    prohibited_phrases_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
