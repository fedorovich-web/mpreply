"""manual review and semi-automatic reply workflow

Revision ID: 20260710_0008
Revises: 20260710_0007
Create Date: 2026-07-10
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260710_0008"
down_revision: str | None = "20260710_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "replies",
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("replies", sa.Column("submitted_for_review_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("replies", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("replies", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("replies", sa.Column("rejection_reason", sa.Text(), nullable=True))

    op.create_index(
        "ix_replies_org_mode_status_created",
        "replies",
        ["organization_id", "mode", "status", "created_at"],
    )
    op.alter_column("replies", "revision", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_replies_org_mode_status_created", table_name="replies")
    op.drop_column("replies", "rejection_reason")
    op.drop_column("replies", "rejected_at")
    op.drop_column("replies", "approved_at")
    op.drop_column("replies", "submitted_for_review_at")
    op.drop_column("replies", "revision")
