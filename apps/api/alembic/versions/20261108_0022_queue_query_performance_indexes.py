"""Add high-performance compound indexes for message inbox, review queues, and analytics.

Revision ID: 20261108_0022
Revises: 20261010_0021
Create Date: 2026-11-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261108_0022"
down_revision: str | None = "20261010_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_customer_messages_org_status_created",
        "customer_messages",
        ["organization_id", "status", "marketplace_created_at"],
    )
    op.create_index(
        "ix_customer_messages_org_assigned_created",
        "customer_messages",
        ["organization_id", "assigned_to", "marketplace_created_at"],
    )
    op.create_index(
        "ix_customer_messages_org_imported",
        "customer_messages",
        ["organization_id", "imported_at"],
    )
    op.create_index(
        "ix_replies_review_queue",
        "replies",
        ["organization_id", "mode", "status", "updated_at", "created_at"],
    )
    op.create_index(
        "ix_replies_org_status_sent",
        "replies",
        ["organization_id", "status", "sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_replies_org_status_sent", table_name="replies")
    op.drop_index("ix_replies_review_queue", table_name="replies")
    op.drop_index("ix_customer_messages_org_imported", table_name="customer_messages")
    op.drop_index("ix_customer_messages_org_assigned_created", table_name="customer_messages")
    op.drop_index("ix_customer_messages_org_status_created", table_name="customer_messages")
