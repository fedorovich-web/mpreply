"""track refresh session families

Revision ID: 20260911_0011
Revises: 20260911_0010
Create Date: 2026-09-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260911_0011"
down_revision: str | None = "20260911_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "auth_sessions",
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("auth_sessions", sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(sa.text("UPDATE auth_sessions SET family_id = id WHERE family_id IS NULL"))
    op.alter_column("auth_sessions", "family_id", nullable=False)
    op.create_index("ix_auth_sessions_family_id", "auth_sessions", ["family_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_family_id", table_name="auth_sessions")
    op.drop_column("auth_sessions", "rotated_at")
    op.drop_column("auth_sessions", "family_id")
