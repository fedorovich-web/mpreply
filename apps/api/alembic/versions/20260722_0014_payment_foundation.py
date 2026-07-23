"""Add payment orders, verified webhook inbox and refund accounting."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260722_0014"
down_revision: str | None = "20260722_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def upgrade() -> None:
    op.drop_constraint(
        "ck_answer_ledger_entries_entry_type",
        "answer_ledger_entries",
        type_="check",
    )
    op.create_check_constraint(
        "ck_answer_ledger_entries_entry_type",
        "answer_ledger_entries",
        "entry_type IN ('grant', 'reserve', 'release', 'debit', 'reversal', 'revoke')",
    )
    op.add_column(
        "answer_credit_grants",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "answer_credit_grants",
        sa.Column("revoke_reason", sa.String(length=128), nullable=True),
    )
    op.create_index(
        op.f("ix_answer_credit_grants_revoked_at"),
        "answer_credit_grants",
        ["revoked_at"],
        unique=False,
    )

    op.create_table(
        "payment_orders",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_payment_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="created"),
        sa.Column("package_code", sa.String(length=64), nullable=False),
        sa.Column("answer_quantity", sa.Integer(), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="RUB"),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("confirmation_url", sa.Text(), nullable=True),
        sa.Column("provider_status", sa.String(length=64), nullable=True),
        sa.Column("last_provider_error", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("amount_minor > 0", name="ck_payment_orders_amount_positive"),
        sa.CheckConstraint("answer_quantity > 0", name="ck_payment_orders_answers_positive"),
        sa.CheckConstraint("currency = upper(currency)", name="ck_payment_orders_currency_uppercase"),
        sa.CheckConstraint(
            "status IN ('created', 'pending', 'succeeded', 'canceled', 'provider_error', "
            "'refund_review_required', 'refunded')",
            name="ck_payment_orders_status",
        ),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["grant_id"], ["answer_credit_grants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["package_id"], ["answer_packages.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_payment_orders_org_idempotency"),
        sa.UniqueConstraint("provider", "provider_payment_id", name="uq_payment_orders_provider_payment"),
    )
    op.create_index(op.f("ix_payment_orders_grant_id"), "payment_orders", ["grant_id"], unique=False)
    op.create_index(op.f("ix_payment_orders_organization_id"), "payment_orders", ["organization_id"], unique=False)
    op.create_index(op.f("ix_payment_orders_package_id"), "payment_orders", ["package_id"], unique=False)
    op.create_index(op.f("ix_payment_orders_provider"), "payment_orders", ["provider"], unique=False)
    op.create_index(op.f("ix_payment_orders_status"), "payment_orders", ["status"], unique=False)

    op.create_table(
        "payment_webhook_events",
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("object_type", sa.String(length=32), nullable=False),
        sa.Column("object_id", sa.String(length=128), nullable=False),
        sa.Column("payload_sha256", sa.String(length=64), nullable=False),
        sa.Column("source_ip", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="received"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=128), nullable=True),
        sa.Column("error_message_safe", sa.Text(), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("attempt_count > 0", name="ck_payment_webhook_events_attempt_positive"),
        sa.CheckConstraint(
            "status IN ('received', 'processed', 'ignored', 'failed')",
            name="ck_payment_webhook_events_status",
        ),
        sa.ForeignKeyConstraint(["order_id"], ["payment_orders.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "event_key", name="uq_payment_webhook_events_provider_key"),
    )
    op.create_index(op.f("ix_payment_webhook_events_event_type"), "payment_webhook_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_payment_webhook_events_object_id"), "payment_webhook_events", ["object_id"], unique=False)
    op.create_index(op.f("ix_payment_webhook_events_order_id"), "payment_webhook_events", ["order_id"], unique=False)
    op.create_index(op.f("ix_payment_webhook_events_provider"), "payment_webhook_events", ["provider"], unique=False)
    op.create_index(op.f("ix_payment_webhook_events_status"), "payment_webhook_events", ["status"], unique=False)

    op.create_table(
        "payment_refunds",
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_refund_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("answer_quantity_revoked", sa.Integer(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("amount_minor > 0", name="ck_payment_refunds_amount_positive"),
        sa.CheckConstraint("currency = upper(currency)", name="ck_payment_refunds_currency_uppercase"),
        sa.CheckConstraint(
            "status IN ('succeeded', 'canceled', 'manual_review')",
            name="ck_payment_refunds_status",
        ),
        sa.ForeignKeyConstraint(["grant_id"], ["answer_credit_grants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["order_id"], ["payment_orders.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_refund_id", name="uq_payment_refunds_provider_refund"),
    )
    op.create_index(op.f("ix_payment_refunds_grant_id"), "payment_refunds", ["grant_id"], unique=False)
    op.create_index(op.f("ix_payment_refunds_order_id"), "payment_refunds", ["order_id"], unique=False)
    op.create_index(op.f("ix_payment_refunds_provider"), "payment_refunds", ["provider"], unique=False)
    op.create_index(op.f("ix_payment_refunds_status"), "payment_refunds", ["status"], unique=False)


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM payment_orders LIMIT 1)
                   OR EXISTS (SELECT 1 FROM payment_webhook_events LIMIT 1)
                   OR EXISTS (SELECT 1 FROM payment_refunds LIMIT 1)
                   OR EXISTS (SELECT 1 FROM answer_credit_grants WHERE revoked_at IS NOT NULL LIMIT 1)
                   OR EXISTS (SELECT 1 FROM answer_ledger_entries WHERE entry_type = 'revoke' LIMIT 1)
                THEN
                    RAISE EXCEPTION 'Cannot downgrade payment foundation while financial records exist';
                END IF;
            END
            $$;
            """
        )
    )
    op.drop_table("payment_refunds")
    op.drop_table("payment_webhook_events")
    op.drop_table("payment_orders")
    op.drop_index(op.f("ix_answer_credit_grants_revoked_at"), table_name="answer_credit_grants")
    op.drop_column("answer_credit_grants", "revoke_reason")
    op.drop_column("answer_credit_grants", "revoked_at")
    op.drop_constraint(
        "ck_answer_ledger_entries_entry_type",
        "answer_ledger_entries",
        type_="check",
    )
    op.create_check_constraint(
        "ck_answer_ledger_entries_entry_type",
        "answer_ledger_entries",
        "entry_type IN ('grant', 'reserve', 'release', 'debit', 'reversal')",
    )
