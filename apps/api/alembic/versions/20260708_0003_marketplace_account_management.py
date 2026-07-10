"""marketplace account management fields

Revision ID: 20260708_0003
Revises: 20260708_0002
Create Date: 2026-07-08
"""

import sqlalchemy as sa

from alembic import op

revision: str = "20260708_0003"
down_revision: str | None = "20260708_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("marketplace_accounts", sa.Column("last_success_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("marketplace_accounts", sa.Column("last_error_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("marketplace_accounts", sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("marketplace_accounts", "error_count", server_default=None)
    op.create_index(
        "ix_marketplace_accounts_org_status",
        "marketplace_accounts",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_marketplace_accounts_org_credentials_status",
        "marketplace_accounts",
        ["organization_id", "credentials_status"],
    )


def downgrade() -> None:
    op.drop_index("ix_marketplace_accounts_org_credentials_status", table_name="marketplace_accounts")
    op.drop_index("ix_marketplace_accounts_org_status", table_name="marketplace_accounts")
    op.drop_column("marketplace_accounts", "error_count")
    op.drop_column("marketplace_accounts", "last_error_sync_at")
    op.drop_column("marketplace_accounts", "last_success_sync_at")
