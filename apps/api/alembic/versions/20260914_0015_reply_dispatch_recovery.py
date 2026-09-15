"""add durable reply dispatch recovery

Revision ID: 20260914_0015
Revises: 20260914_0014
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260914_0015"
down_revision: str | None = "20260914_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("replies", sa.Column("dispatch_owner", sa.String(length=128), nullable=True))
    op.add_column(
        "replies",
        sa.Column("dispatch_lease_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "replies",
        sa.Column(
            "dispatch_attempt_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "replies",
        sa.Column("last_dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "replies",
        sa.Column("last_dispatch_error_code", sa.String(length=64), nullable=True),
    )
    op.create_check_constraint(
        "ck_replies_dispatch_attempt_count_nonnegative",
        "replies",
        "dispatch_attempt_count >= 0",
    )
    op.create_check_constraint(
        "ck_replies_dispatch_lease_shape",
        "replies",
        "((dispatch_owner IS NULL AND dispatch_lease_expires_at IS NULL) OR (dispatch_owner IS NOT NULL AND dispatch_lease_expires_at IS NOT NULL))",
    )
    op.create_index(
        "ix_replies_dispatch_due",
        "replies",
        [
            "status",
            "next_retry_at",
            "last_dispatched_at",
            "dispatch_lease_expires_at",
        ],
    )
    op.alter_column("replies", "dispatch_attempt_count", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_replies_dispatch_due", table_name="replies")
    op.drop_constraint("ck_replies_dispatch_lease_shape", "replies", type_="check")
    op.drop_constraint(
        "ck_replies_dispatch_attempt_count_nonnegative",
        "replies",
        type_="check",
    )
    op.drop_column("replies", "last_dispatch_error_code")
    op.drop_column("replies", "last_dispatched_at")
    op.drop_column("replies", "dispatch_attempt_count")
    op.drop_column("replies", "dispatch_lease_expires_at")
    op.drop_column("replies", "dispatch_owner")
