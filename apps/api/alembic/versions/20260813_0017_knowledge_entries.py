"""Structured seller knowledge entries

Revision ID: 20260813_0017
Revises: 20260813_0016
Create Date: 2026-08-13 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260813_0017"
down_revision: str | None = "20260813_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_entries",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "category IN ('company', 'delivery', 'returns', 'warranty', 'product', 'other')",
            name="ck_knowledge_entries_category",
        ),
        sa.CheckConstraint("status IN ('draft', 'active', 'archived')", name="ck_knowledge_entries_status"),
        sa.CheckConstraint(
            "product_id IS NULL OR marketplace_account_id IS NOT NULL",
            name="ck_knowledge_entries_product_requires_account",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["marketplace_account_id"], ["marketplace_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_knowledge_entries_organization_id"), "knowledge_entries", ["organization_id"])
    op.create_index(
        op.f("ix_knowledge_entries_marketplace_account_id"),
        "knowledge_entries",
        ["marketplace_account_id"],
    )
    op.create_index(op.f("ix_knowledge_entries_product_id"), "knowledge_entries", ["product_id"])
    op.execute(
        sa.text(
            """
            INSERT INTO knowledge_entries (
                id, organization_id, marketplace_account_id, product_id,
                category, title, content, status, created_by, updated_by,
                created_at, updated_at
            )
            SELECT
                md5('mpreply:knowledge-entry:' || organization_id::text)::uuid,
                organization_id,
                NULL,
                NULL,
                'company',
                'Общие сведения',
                btrim(knowledge_base),
                'active',
                created_by,
                updated_by,
                created_at,
                updated_at
            FROM seller_settings
            WHERE knowledge_base IS NOT NULL AND btrim(knowledge_base) <> ''
            """
        )
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_knowledge_entries_product_id"), table_name="knowledge_entries")
    op.drop_index(op.f("ix_knowledge_entries_marketplace_account_id"), table_name="knowledge_entries")
    op.drop_index(op.f("ix_knowledge_entries_organization_id"), table_name="knowledge_entries")
    op.drop_table("knowledge_entries")
