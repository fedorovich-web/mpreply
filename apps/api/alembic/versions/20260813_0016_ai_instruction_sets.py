"""AI instruction sets and marketplace assignment

Revision ID: 20260813_0016
Revises: 20260812_0015
Create Date: 2026-08-13 11:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260813_0016"
down_revision: str | None = "20260812_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_instruction_sets",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("response_tone", sa.String(length=32), nullable=False, server_default="neutral"),
        sa.Column("brand_rules", sa.Text(), nullable=True),
        sa.Column("reply_signature", sa.String(length=500), nullable=True),
        sa.Column("prohibited_phrases_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="active"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("response_tone IN ('neutral', 'friendly', 'formal', 'apologetic')", name="ck_ai_instruction_sets_response_tone"),
        sa.CheckConstraint("status IN ('active', 'archived')", name="ck_ai_instruction_sets_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_ai_instruction_sets_org_name"),
    )
    op.create_index(op.f("ix_ai_instruction_sets_organization_id"), "ai_instruction_sets", ["organization_id"], unique=False)
    op.create_index(
        "uq_ai_instruction_sets_active_default",
        "ai_instruction_sets",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("is_default AND status = 'active'"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO ai_instruction_sets (
                id, organization_id, name, response_tone, brand_rules,
                reply_signature, prohibited_phrases_json, status, is_default,
                created_by, updated_by, created_at, updated_at
            )
            SELECT
                md5('mpreply:instruction-set:' || organization_id::text)::uuid,
                organization_id,
                'Основной набор',
                response_tone,
                brand_rules,
                reply_signature,
                prohibited_phrases_json,
                'active',
                true,
                created_by,
                updated_by,
                created_at,
                updated_at
            FROM seller_settings
            """
        )
    )
    op.add_column("marketplace_accounts", sa.Column("ai_instruction_set_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_marketplace_accounts_ai_instruction_set_id",
        "marketplace_accounts",
        "ai_instruction_sets",
        ["ai_instruction_set_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_marketplace_accounts_ai_instruction_set_id"),
        "marketplace_accounts",
        ["ai_instruction_set_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_marketplace_accounts_ai_instruction_set_id"), table_name="marketplace_accounts")
    op.drop_constraint("fk_marketplace_accounts_ai_instruction_set_id", "marketplace_accounts", type_="foreignkey")
    op.drop_column("marketplace_accounts", "ai_instruction_set_id")
    op.drop_index("uq_ai_instruction_sets_active_default", table_name="ai_instruction_sets")
    op.drop_index(op.f("ix_ai_instruction_sets_organization_id"), table_name="ai_instruction_sets")
    op.drop_table("ai_instruction_sets")
