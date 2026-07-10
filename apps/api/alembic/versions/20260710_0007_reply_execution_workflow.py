"""worker-backed reply execution workflow

Revision ID: 20260710_0007
Revises: 20260710_0006
Create Date: 2026-07-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260710_0007"
down_revision: str | None = "20260710_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "replies",
        sa.Column("ai_draft_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "replies",
        sa.Column("automation_rule_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("replies", sa.Column("idempotency_key", sa.String(length=128), nullable=True))
    op.add_column("replies", sa.Column("worker_message_id", sa.String(length=128), nullable=True))
    op.add_column(
        "replies",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "replies",
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="4"),
    )
    op.add_column("replies", sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("replies", sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("replies", sa.Column("error_code", sa.String(length=128), nullable=True))
    op.add_column(
        "replies",
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.create_foreign_key("fk_replies_ai_draft_id", "replies", "ai_drafts", ["ai_draft_id"], ["id"])
    op.create_foreign_key(
        "fk_replies_automation_rule_id",
        "replies",
        "automation_rules",
        ["automation_rule_id"],
        ["id"],
    )
    op.create_index("ix_replies_ai_draft_id", "replies", ["ai_draft_id"])
    op.create_index("ix_replies_automation_rule_id", "replies", ["automation_rule_id"])
    op.create_index("ux_replies_idempotency_key", "replies", ["idempotency_key"], unique=True)
    op.create_index(
        "ix_replies_org_status_created",
        "replies",
        ["organization_id", "status", "created_at"],
    )
    op.create_index(
        "ix_replies_org_rule_sent",
        "replies",
        ["organization_id", "automation_rule_id", "sent_at"],
    )

    op.alter_column("replies", "attempt_count", server_default=None)
    op.alter_column("replies", "max_attempts", server_default=None)
    op.alter_column("replies", "metadata_json", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_replies_org_rule_sent", table_name="replies")
    op.drop_index("ix_replies_org_status_created", table_name="replies")
    op.drop_index("ux_replies_idempotency_key", table_name="replies")
    op.drop_index("ix_replies_automation_rule_id", table_name="replies")
    op.drop_index("ix_replies_ai_draft_id", table_name="replies")
    op.drop_constraint("fk_replies_automation_rule_id", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_ai_draft_id", "replies", type_="foreignkey")
    op.drop_column("replies", "metadata_json")
    op.drop_column("replies", "error_code")
    op.drop_column("replies", "next_retry_at")
    op.drop_column("replies", "last_attempt_at")
    op.drop_column("replies", "max_attempts")
    op.drop_column("replies", "attempt_count")
    op.drop_column("replies", "worker_message_id")
    op.drop_column("replies", "idempotency_key")
    op.drop_column("replies", "automation_rule_id")
    op.drop_column("replies", "ai_draft_id")
