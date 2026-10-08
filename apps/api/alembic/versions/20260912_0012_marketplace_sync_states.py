"""add marketplace synchronization states

Revision ID: 20260912_0012
Revises: 20260911_0011
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260912_0012"
down_revision: str | None = "20260911_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_marketplace_accounts_id_organization_id",
        "marketplace_accounts",
        ["id", "organization_id"],
    )
    op.create_table(
        "marketplace_sync_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stream", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="idle"),
        sa.Column("cursor", sa.String(length=2048), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_owner", sa.String(length=128), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error_code", sa.String(length=64), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "stream IN ('reviews', 'questions', 'chats')",
            name="ck_marketplace_sync_states_stream",
        ),
        sa.CheckConstraint(
            "status IN ('idle', 'leased', 'error', 'paused')",
            name="ck_marketplace_sync_states_status",
        ),
        sa.CheckConstraint(
            "consecutive_failures >= 0",
            name="ck_marketplace_sync_states_failures_nonnegative",
        ),
        sa.CheckConstraint(
            "((status = 'leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) "
            "OR (status <> 'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL))",
            name="ck_marketplace_sync_states_lease_shape",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_marketplace_sync_states_organization_id_organizations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["marketplace_account_id", "organization_id"],
            ["marketplace_accounts.id", "marketplace_accounts.organization_id"],
            name="fk_marketplace_sync_states_account_tenant",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_marketplace_sync_states"),
        sa.UniqueConstraint(
            "marketplace_account_id",
            "stream",
            name="uq_marketplace_sync_states_account_stream",
        ),
    )
    op.create_index(
        "ix_marketplace_sync_states_account",
        "marketplace_sync_states",
        ["marketplace_account_id"],
    )
    op.create_index(
        "ix_marketplace_sync_states_due",
        "marketplace_sync_states",
        ["status", "next_run_at", "lease_expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_marketplace_sync_states_due", table_name="marketplace_sync_states")
    op.drop_index("ix_marketplace_sync_states_account", table_name="marketplace_sync_states")
    op.drop_table("marketplace_sync_states")
    op.drop_constraint(
        "uq_marketplace_accounts_id_organization_id",
        "marketplace_accounts",
        type_="unique",
    )
