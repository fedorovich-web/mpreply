"""allow providers to omit product names

Revision ID: 20260914_0013
Revises: 20260912_0012
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260914_0013"
down_revision: str | None = "20260912_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "products",
        "name",
        existing_type=sa.String(length=500),
        nullable=True,
    )


def downgrade() -> None:
    products = sa.table("products", sa.column("name", sa.String(length=500)))
    null_names = op.get_bind().scalar(sa.select(sa.func.count()).select_from(products).where(products.c.name.is_(None)))
    if null_names:
        raise RuntimeError("cannot restore products.name NOT NULL while provider products without names exist")
    op.alter_column(
        "products",
        "name",
        existing_type=sa.String(length=500),
        nullable=False,
    )
