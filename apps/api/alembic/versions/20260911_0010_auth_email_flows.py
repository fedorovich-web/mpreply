"""auth email verification, recovery, and sessions

Revision ID: 20260911_0010
Revises: 20260710_0009
Create Date: 2026-09-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260911_0010"
down_revision: str | None = "20260710_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0"))
    # Existing accounts predate mandatory verification; preserve their ability to log in.
    op.execute(sa.text("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL"))

    op.create_table(
        "auth_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"])
    op.create_index("ix_auth_tokens_purpose", "auth_tokens", ["purpose"])
    op.create_index("ix_auth_tokens_token_digest", "auth_tokens", ["token_digest"], unique=True)
    op.create_index("ix_auth_tokens_user_purpose_created", "auth_tokens", ["user_id", "purpose", "created_at"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("auth_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index(
        "ix_auth_sessions_token_digest",
        "auth_sessions",
        ["token_digest"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_token_digest", table_name="auth_sessions")
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("ix_auth_tokens_user_purpose_created", table_name="auth_tokens")
    op.drop_index("ix_auth_tokens_token_digest", table_name="auth_tokens")
    op.drop_index("ix_auth_tokens_purpose", table_name="auth_tokens")
    op.drop_index("ix_auth_tokens_user_id", table_name="auth_tokens")
    op.drop_table("auth_tokens")
    op.drop_column("users", "auth_version")
    op.drop_column("users", "email_verified_at")
