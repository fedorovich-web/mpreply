"""ai usage indexes

Revision ID: 20260708_0005
Revises: 20260708_0004
Create Date: 2026-07-08
"""

from alembic import op

revision: str = "20260708_0005"
down_revision: str | None = "20260708_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_ai_drafts_org_message_created",
        "ai_drafts",
        ["organization_id", "message_id", "created_at"],
    )
    op.create_index(
        "ix_ai_drafts_org_prompt_created",
        "ai_drafts",
        ["organization_id", "prompt_version", "created_at"],
    )
    op.create_index(
        "ix_usage_events_org_user_created",
        "usage_events",
        ["organization_id", "user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_usage_events_org_user_created", table_name="usage_events")
    op.drop_index("ix_ai_drafts_org_prompt_created", table_name="ai_drafts")
    op.drop_index("ix_ai_drafts_org_message_created", table_name="ai_drafts")
