"""auth rbac foundation

Revision ID: 20260708_0002
Revises: 20260708_0001
Create Date: 2026-07-08
"""
from collections.abc import Sequence

from alembic import op

revision: str = "20260708_0002"
down_revision: str | None = "20260708_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_organization_users_member",
        "organization_users",
        ["organization_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_organization_users_member", "organization_users", type_="unique")
