"""Align ORM metadata with migration-managed indexes and remove redundant indexes.

Revision ID: 20261010_0021
Revises: 20261001_0020
Create Date: 2026-10-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261010_0021"
down_revision: str | None = "20261001_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_billing_plans_code", table_name="billing_plans")
    op.drop_index("ix_products_org_account_external", table_name="products")


def downgrade() -> None:
    op.create_index("ix_products_org_account_external", "products", ["organization_id", "marketplace_account_id", "external_id"])
    op.create_index("ix_billing_plans_code", "billing_plans", ["code"])
