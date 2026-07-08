"""wildberries sync inbox indexes

Revision ID: 20260708_0004
Revises: 20260708_0003
Create Date: 2026-07-08
"""

from alembic import op

revision: str = "20260708_0004"
down_revision: str | None = "20260708_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_customer_messages_org_marketplace_status_created",
        "customer_messages",
        ["organization_id", "marketplace", "status", "marketplace_created_at"],
    )
    op.create_index(
        "ix_products_org_account_external",
        "products",
        ["organization_id", "marketplace_account_id", "external_id"],
    )
    op.create_index(
        "ix_sync_jobs_org_account_created",
        "sync_jobs",
        ["organization_id", "marketplace_account_id", "created_at"],
    )
    op.create_index(
        "ix_integration_events_org_account_created",
        "integration_events",
        ["organization_id", "marketplace_account_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_integration_events_org_account_created", table_name="integration_events")
    op.drop_index("ix_sync_jobs_org_account_created", table_name="sync_jobs")
    op.drop_index("ix_products_org_account_external", table_name="products")
    op.drop_index("ix_customer_messages_org_marketplace_status_created", table_name="customer_messages")
