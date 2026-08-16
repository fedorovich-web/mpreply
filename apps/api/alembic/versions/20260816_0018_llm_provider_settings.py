"""Platform LLM provider settings

Revision ID: 20260816_0018
Revises: 20260813_0017
Create Date: 2026-08-16 11:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260816_0018"
down_revision: str | None = "20260813_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "llm_provider_settings",
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("credential_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("review_model", sa.String(length=255), nullable=True),
        sa.Column("negative_review_model", sa.String(length=255), nullable=True),
        sa.Column("question_model", sa.String(length=255), nullable=True),
        sa.Column("chat_model", sa.String(length=255), nullable=True),
        sa.Column("safety_retry_model", sa.String(length=255), nullable=True),
        sa.Column("fallback_model", sa.String(length=255), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "(review_model IS NULL AND negative_review_model IS NULL AND question_model IS NULL "
            "AND chat_model IS NULL AND safety_retry_model IS NULL AND fallback_model IS NULL) OR "
            "(review_model IS NOT NULL AND negative_review_model IS NOT NULL AND question_model IS NOT NULL "
            "AND chat_model IS NOT NULL AND safety_retry_model IS NOT NULL AND fallback_model IS NOT NULL)",
            name="ck_llm_provider_settings_routes_complete",
        ),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", name="uq_llm_provider_settings_provider"),
    )


def downgrade() -> None:
    op.drop_table("llm_provider_settings")
