from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AIInstructionSet(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_instruction_sets"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_ai_instruction_sets_org_name"),
        CheckConstraint(
            "response_tone IN ('neutral', 'friendly', 'formal', 'apologetic')",
            name="ck_ai_instruction_sets_response_tone",
        ),
        CheckConstraint("status IN ('active', 'archived')", name="ck_ai_instruction_sets_status"),
        Index(
            "uq_ai_instruction_sets_active_default",
            "organization_id",
            unique=True,
            postgresql_where=text("is_default AND status = 'active'"),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    response_tone: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    brand_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_signature: Mapped[str | None] = mapped_column(String(500), nullable=True)
    prohibited_phrases_json: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
