"""indexes for bounded reply credit maintenance

Revision ID: 20260930_0017
Revises: 20260930_0016
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260930_0017"
down_revision: str | None = "20260930_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_reply_credit_grants_expiry_due", "reply_credit_grants", ["expires_at"], postgresql_where=sa.text("expires_at IS NOT NULL AND available > 0")
    )
    op.create_index("ix_reply_credit_operations_recovery_due", "reply_credit_operations", ["lease_expires_at"], postgresql_where=sa.text("state = 'reserved'"))


def downgrade() -> None:
    op.drop_index("ix_reply_credit_operations_recovery_due", table_name="reply_credit_operations")
    op.drop_index("ix_reply_credit_grants_expiry_due", table_name="reply_credit_grants")
