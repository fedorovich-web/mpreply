from uuid import UUID

from sqlalchemy import Float, ForeignKey, ForeignKeyConstraint, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AIDraft(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_drafts"
    __table_args__ = (
        UniqueConstraint("id", "organization_id", name="uq_ai_drafts_id_organization_id"),
        ForeignKeyConstraint(
            ["message_id", "organization_id"],
            ["customer_messages.id", "customer_messages.organization_id"],
            name="fk_ai_drafts_message_tenant",
        ),
        ForeignKeyConstraint(
            ["organization_id", "created_by"],
            ["organization_users.organization_id", "organization_users.user_id"],
            name="fk_ai_drafts_creator_tenant",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    message_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), default="groq")
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_input_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    draft_text: Mapped[str] = mapped_column(Text, nullable=False)
    tokens_input: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_output: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_estimate: Mapped[float | None] = mapped_column(Numeric(12, 6), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    safety_flags_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
