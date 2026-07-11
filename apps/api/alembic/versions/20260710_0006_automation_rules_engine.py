"""automation rules engine foundation

Revision ID: 20260710_0006
Revises: 20260708_0005
Create Date: 2026-07-10
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260710_0006"
down_revision: str | None = "20260708_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "automation_rules",
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("100")),
    )
    op.create_index(
        "ix_automation_rules_org_enabled_priority",
        "automation_rules",
        ["organization_id", "is_enabled", "priority"],
    )
    op.create_index(
        "ix_automation_rules_org_marketplace_account",
        "automation_rules",
        ["organization_id", "marketplace_account_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_automation_rules_org_marketplace_account", table_name="automation_rules")
    op.drop_index("ix_automation_rules_org_enabled_priority", table_name="automation_rules")
    op.drop_column("automation_rules", "priority")
