"""four marketplace sync-state foundation

Revision ID: 20260925_0010
Revises: 20260710_0009
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260925_0010"
down_revision: str | None = "20260710_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "marketplace_sync_states",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stream", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="paused"),
        sa.Column("cursor", sa.String(length=512), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cycle_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_cycle_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lease_token", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_worker_message_id", sa.String(length=128), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
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
        sa.ForeignKeyConstraint(
            ["marketplace_account_id"],
            ["marketplace_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "marketplace_account_id",
            "stream",
            name="uq_marketplace_sync_states_account_stream",
        ),
    )
    op.create_index(
        op.f("ix_marketplace_sync_states_marketplace_account_id"),
        "marketplace_sync_states",
        ["marketplace_account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketplace_sync_states_organization_id"),
        "marketplace_sync_states",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketplace_sync_states_status"),
        "marketplace_sync_states",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketplace_sync_states_next_run_at"),
        "marketplace_sync_states",
        ["next_run_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketplace_sync_states_lease_expires_at"),
        "marketplace_sync_states",
        ["lease_expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_marketplace_sync_states_due",
        "marketplace_sync_states",
        ["status", "next_run_at", "lease_expires_at"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            INSERT INTO marketplace_sync_states (
                id,
                organization_id,
                marketplace_account_id,
                stream,
                status,
                next_run_at,
                consecutive_failures,
                metadata_json,
                created_at,
                updated_at
            )
            SELECT
                md5('mpreply:marketplace-sync:' || account.id::text || ':' || mapping.stream)::uuid,
                account.organization_id,
                account.id,
                mapping.stream,
                CASE
                    WHEN account.status = 'active' AND account.credentials_status = 'valid' THEN 'idle'
                    ELSE 'paused'
                END,
                CASE
                    WHEN account.status = 'active' AND account.credentials_status = 'valid' THEN now()
                    ELSE NULL
                END,
                0,
                '{}'::jsonb,
                now(),
                now()
            FROM marketplace_accounts AS account
            JOIN (
                VALUES
                    ('wildberries', 'reviews'),
                    ('wildberries', 'questions'),
                    ('ozon', 'reviews'),
                    ('ozon', 'questions'),
                    ('yandex_market', 'reviews'),
                    ('yandex_market', 'questions'),
                    ('avito', 'chats')
            ) AS mapping(marketplace, stream)
              ON mapping.marketplace = account.marketplace
            ON CONFLICT (marketplace_account_id, stream) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_marketplace_sync_states_due", table_name="marketplace_sync_states")
    op.drop_index(op.f("ix_marketplace_sync_states_lease_expires_at"), table_name="marketplace_sync_states")
    op.drop_index(op.f("ix_marketplace_sync_states_next_run_at"), table_name="marketplace_sync_states")
    op.drop_index(op.f("ix_marketplace_sync_states_status"), table_name="marketplace_sync_states")
    op.drop_index(op.f("ix_marketplace_sync_states_organization_id"), table_name="marketplace_sync_states")
    op.drop_index(op.f("ix_marketplace_sync_states_marketplace_account_id"), table_name="marketplace_sync_states")
    op.drop_table("marketplace_sync_states")
