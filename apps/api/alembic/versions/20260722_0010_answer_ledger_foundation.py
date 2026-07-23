"""answer package, entitlement and ledger foundation

Revision ID: 20260722_0010
Revises: 20260710_0009
Create Date: 2026-07-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260722_0010"
down_revision: str | None = "20260710_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TRIAL_PACKAGE_ID = "50000000-0000-4000-8000-000000000400"
_START_PACKAGE_ID = "50000000-0000-4000-8000-000000000500"
_OPTIMAL_PACKAGE_ID = "50000000-0000-4000-8000-000000005000"
_BUSINESS_PACKAGE_ID = "50000000-0000-4000-8000-000000010000"
_SCALE_PACKAGE_ID = "50000000-0000-4000-8000-000000015000"
_ENTERPRISE_PACKAGE_ID = "50000000-0000-4000-8000-000000099999"


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def upgrade() -> None:
    op.create_table(
        "answer_packages",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("answer_count", sa.Integer(), nullable=True),
        sa.Column("price_minor", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="RUB"),
        sa.Column("validity_days", sa.Integer(), nullable=True),
        sa.Column("marketplace_limit", sa.Integer(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint("kind IN ('trial', 'paid', 'custom')", name="ck_answer_packages_kind"),
        sa.CheckConstraint("answer_count IS NULL OR answer_count > 0", name="ck_answer_packages_answer_count_positive"),
        sa.CheckConstraint("price_minor IS NULL OR price_minor >= 0", name="ck_answer_packages_price_non_negative"),
        sa.CheckConstraint("validity_days IS NULL OR validity_days > 0", name="ck_answer_packages_validity_positive"),
        sa.CheckConstraint("marketplace_limit IS NULL OR marketplace_limit > 0", name="ck_answer_packages_marketplace_limit_positive"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_answer_packages_code"), "answer_packages", ["code"], unique=False)
    op.create_index(op.f("ix_answer_packages_is_active"), "answer_packages", ["is_active"], unique=False)
    op.create_index(op.f("ix_answer_packages_kind"), "answer_packages", ["kind"], unique=False)

    op.execute(
        sa.text(
            f"""
            INSERT INTO answer_packages (
                id, code, name, kind, answer_count, price_minor, currency,
                validity_days, marketplace_limit, display_order, is_active, metadata_json
            )
            VALUES
                ('{_TRIAL_PACKAGE_ID}'::uuid, 'trial-400', 'Trial', 'trial', 400, 0, 'RUB', 7, 2, 0, true,
                    '{{"public_key": "trial", "non_expiring": false}}'::jsonb),
                ('{_START_PACKAGE_ID}'::uuid, 'start-500', 'Старт', 'paid', 500, 116000, 'RUB', NULL, NULL, 10, true,
                    '{{"public_key": "start", "non_expiring": true}}'::jsonb),
                ('{_OPTIMAL_PACKAGE_ID}'::uuid, 'optimal-5000', 'Оптимальный', 'paid', 5000, 629000, 'RUB', NULL, NULL, 20, true,
                    '{{"public_key": "optimal", "non_expiring": true}}'::jsonb),
                ('{_BUSINESS_PACKAGE_ID}'::uuid, 'business-10000', 'Бизнес', 'paid', 10000, 899000, 'RUB', NULL, NULL, 30, true,
                    '{{"public_key": "business", "non_expiring": true}}'::jsonb),
                ('{_SCALE_PACKAGE_ID}'::uuid, 'scale-15000', 'Масштаб', 'paid', 15000, 1259000, 'RUB', NULL, NULL, 40, true,
                    '{{"public_key": "scale", "non_expiring": true}}'::jsonb),
                ('{_ENTERPRISE_PACKAGE_ID}'::uuid, 'enterprise-custom', 'Enterprise', 'custom', NULL, NULL, 'RUB', NULL, NULL, 50, true,
                    '{{"public_key": "enterprise", "requires_quote": true}}'::jsonb)
            """
        )
    )

    op.create_table(
        "answer_credit_grants",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("original_quantity", sa.Integer(), nullable=False),
        sa.Column("remaining_quantity", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reference_type", sa.String(length=64), nullable=True),
        sa.Column("reference_id", sa.String(length=255), nullable=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("granted_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "source_type IN ('trial', 'purchase', 'manual_adjustment', 'reversal')",
            name="ck_answer_credit_grants_source_type",
        ),
        sa.CheckConstraint("original_quantity > 0", name="ck_answer_credit_grants_original_positive"),
        sa.CheckConstraint("remaining_quantity >= 0", name="ck_answer_credit_grants_remaining_non_negative"),
        sa.CheckConstraint("remaining_quantity <= original_quantity", name="ck_answer_credit_grants_remaining_lte_original"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["answer_packages.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_credit_grants_org_idempotency"),
    )
    op.create_index(op.f("ix_answer_credit_grants_expires_at"), "answer_credit_grants", ["expires_at"], unique=False)
    op.create_index(op.f("ix_answer_credit_grants_organization_id"), "answer_credit_grants", ["organization_id"], unique=False)
    op.create_index(op.f("ix_answer_credit_grants_package_id"), "answer_credit_grants", ["package_id"], unique=False)
    op.create_index(op.f("ix_answer_credit_grants_source_type"), "answer_credit_grants", ["source_type"], unique=False)
    op.create_index(
        "uq_answer_credit_grants_one_trial_per_org",
        "answer_credit_grants",
        ["organization_id"],
        unique=True,
        postgresql_where=sa.text("source_type = 'trial'"),
    )

    op.create_table(
        "answer_reservations",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reply_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("release_reason", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "status IN ('active', 'settled', 'released', 'expired')",
            name="ck_answer_reservations_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_answer_reservations_quantity_positive"),
        sa.CheckConstraint("revision > 0", name="ck_answer_reservations_revision_positive"),
        sa.ForeignKeyConstraint(["grant_id"], ["answer_credit_grants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_id"], ["replies.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_reservations_org_idempotency"),
        sa.UniqueConstraint("reply_id", name="uq_answer_reservations_reply"),
    )
    op.create_index(op.f("ix_answer_reservations_expires_at"), "answer_reservations", ["expires_at"], unique=False)
    op.create_index(op.f("ix_answer_reservations_grant_id"), "answer_reservations", ["grant_id"], unique=False)
    op.create_index(op.f("ix_answer_reservations_organization_id"), "answer_reservations", ["organization_id"], unique=False)
    op.create_index(op.f("ix_answer_reservations_reply_id"), "answer_reservations", ["reply_id"], unique=False)
    op.create_index(op.f("ix_answer_reservations_status"), "answer_reservations", ["status"], unique=False)

    op.create_table(
        "answer_ledger_entries",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reservation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reply_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entry_type", sa.String(length=32), nullable=False),
        sa.Column("balance_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.CheckConstraint(
            "entry_type IN ('grant', 'reserve', 'release', 'debit', 'reversal')",
            name="ck_answer_ledger_entries_entry_type",
        ),
        sa.CheckConstraint("balance_delta <> 0 OR available_delta <> 0", name="ck_answer_ledger_entries_non_zero_delta"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["grant_id"], ["answer_credit_grants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reply_id"], ["replies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reservation_id"], ["answer_reservations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_answer_ledger_entries_org_idempotency"),
    )
    op.create_index(op.f("ix_answer_ledger_entries_created_at"), "answer_ledger_entries", ["created_at"], unique=False)
    op.create_index(op.f("ix_answer_ledger_entries_entry_type"), "answer_ledger_entries", ["entry_type"], unique=False)
    op.create_index(op.f("ix_answer_ledger_entries_grant_id"), "answer_ledger_entries", ["grant_id"], unique=False)
    op.create_index(op.f("ix_answer_ledger_entries_organization_id"), "answer_ledger_entries", ["organization_id"], unique=False)
    op.create_index(op.f("ix_answer_ledger_entries_reply_id"), "answer_ledger_entries", ["reply_id"], unique=False)
    op.create_index(op.f("ix_answer_ledger_entries_reservation_id"), "answer_ledger_entries", ["reservation_id"], unique=False)

    op.execute(
        sa.text(
            """
            CREATE FUNCTION prevent_answer_ledger_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'answer_ledger_entries is append-only';
            END;
            $$ LANGUAGE plpgsql
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER trg_answer_ledger_entries_append_only
            BEFORE UPDATE OR DELETE ON answer_ledger_entries
            FOR EACH ROW EXECUTE FUNCTION prevent_answer_ledger_mutation()
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER trg_answer_ledger_entries_no_truncate
            BEFORE TRUNCATE ON answer_ledger_entries
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_answer_ledger_mutation()
            """
        )
    )

    op.execute(
        sa.text(
            f"""
            INSERT INTO answer_credit_grants (
                id, organization_id, package_id, source_type, original_quantity, remaining_quantity,
                expires_at, reference_type, reference_id, idempotency_key, metadata_json, created_at, updated_at
            )
            SELECT
                md5('mpreply:trial-grant:' || organization.id::text)::uuid,
                organization.id,
                '{_TRIAL_PACKAGE_ID}'::uuid,
                'trial',
                400,
                400,
                now() + interval '7 days',
                'organization',
                organization.id::text,
                'trial:organization:' || organization.id::text,
                '{{"bootstrap": "migration_20260722_0010"}}'::jsonb,
                now(),
                now()
            FROM organizations AS organization
            ON CONFLICT (organization_id, idempotency_key) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO answer_ledger_entries (
                id, organization_id, grant_id, entry_type, balance_delta, available_delta,
                idempotency_key, reason, metadata_json, created_at
            )
            SELECT
                md5('mpreply:trial-ledger:' || credit_grant.organization_id::text)::uuid,
                credit_grant.organization_id,
                credit_grant.id,
                'grant',
                credit_grant.original_quantity,
                credit_grant.original_quantity,
                'ledger:trial:organization:' || credit_grant.organization_id::text,
                'trial_bootstrap',
                '{"bootstrap": "migration_20260722_0010"}'::jsonb,
                credit_grant.created_at
            FROM answer_credit_grants AS credit_grant
            WHERE credit_grant.source_type = 'trial'
              AND credit_grant.idempotency_key = 'trial:organization:' || credit_grant.organization_id::text
            ON CONFLICT (organization_id, idempotency_key) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_answer_ledger_entries_no_truncate ON answer_ledger_entries"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_answer_ledger_entries_append_only ON answer_ledger_entries"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS prevent_answer_ledger_mutation()"))
    op.drop_table("answer_ledger_entries")
    op.drop_table("answer_reservations")
    op.drop_table("answer_credit_grants")
    op.drop_table("answer_packages")
