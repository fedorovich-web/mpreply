"""analytics, billing and internal admin foundation

Revision ID: 20260710_0009
Revises: 20260710_0008
Create Date: 2026-07-10
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260710_0009"
down_revision: str | None = "20260710_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_START_PLAN_ID = "11111111-1111-4111-8111-111111111111"
_GROWTH_PLAN_ID = "22222222-2222-4222-8222-222222222222"
_TEAM_PLAN_ID = "33333333-3333-4333-8333-333333333333"
_AGENCY_PLAN_ID = "44444444-4444-4444-8444-444444444444"


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "billing_plans",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("price_month_minor", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="RUB"),
        sa.Column("limits_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("features_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(op.f("ix_billing_plans_code"), "billing_plans", ["code"], unique=False)
    op.create_index(op.f("ix_billing_plans_is_active"), "billing_plans", ["is_active"], unique=False)

    op.execute(
        sa.text(
            f"""
            INSERT INTO billing_plans (
                id, code, name, price_month_minor, currency, limits_json, features_json,
                is_active, is_default, created_at, updated_at
            )
            VALUES
                (
                    '{_START_PLAN_ID}'::uuid, 'start', 'Start', NULL, 'RUB', '{{}}'::jsonb,
                    '{{"auto_replies": true, "safety_gate": true, "analytics": "basic"}}'::jsonb,
                    true, true, now(), now()
                ),
                (
                    '{_GROWTH_PLAN_ID}'::uuid, 'growth', 'Growth', NULL, 'RUB', '{{}}'::jsonb,
                    '{{"auto_replies": true, "safety_gate": true, "analytics": "extended"}}'::jsonb,
                    true, false, now(), now()
                ),
                (
                    '{_TEAM_PLAN_ID}'::uuid, 'team', 'Team', NULL, 'RUB', '{{}}'::jsonb,
                    '{{"rbac": true, "review_queue": true, "audit_log": true}}'::jsonb,
                    true, false, now(), now()
                ),
                (
                    '{_AGENCY_PLAN_ID}'::uuid, 'agency', 'Agency', NULL, 'RUB', '{{}}'::jsonb,
                    '{{"multi_workspace": true, "custom_limits": true, "reporting": true}}'::jsonb,
                    true, false, now(), now()
                )
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE organizations AS organization
            SET plan_id = NULL
            WHERE plan_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM billing_plans AS plan WHERE plan.id = organization.plan_id
              )
            """
        )
    )

    op.create_foreign_key(
        "fk_organizations_plan_id_billing_plans",
        "organizations",
        "billing_plans",
        ["plan_id"],
        ["id"],
    )
    op.create_index(op.f("ix_organizations_plan_id"), "organizations", ["plan_id"], unique=False)

    op.create_table(
        "subscriptions",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("provider_customer_id", sa.String(length=255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("provider_metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_provider_event_id", sa.String(length=255), nullable=True),
        sa.Column("last_provider_error", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["billing_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", name="uq_subscriptions_organization"),
    )
    op.create_index(op.f("ix_subscriptions_organization_id"), "subscriptions", ["organization_id"], unique=False)
    op.create_index(op.f("ix_subscriptions_plan_id"), "subscriptions", ["plan_id"], unique=False)
    op.create_index(op.f("ix_subscriptions_status"), "subscriptions", ["status"], unique=False)

    op.execute(
        sa.text(
            """
            UPDATE organizations
            SET plan_id = CAST(:plan_id AS uuid)
            WHERE plan_id IS NULL
            """
        ).bindparams(plan_id=_START_PLAN_ID)
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_index(op.f("ix_organizations_plan_id"), table_name="organizations")
    op.drop_constraint("fk_organizations_plan_id_billing_plans", "organizations", type_="foreignkey")
    op.drop_table("billing_plans")
    op.drop_column("users", "is_superadmin")
