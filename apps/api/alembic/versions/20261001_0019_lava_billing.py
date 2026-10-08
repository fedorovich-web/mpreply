"""Durable manual payment orders, prepaid periods and webhook inbox."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "20261001_0019"
down_revision: str | None = "20260930_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    return [sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade() -> None:
    op.create_table(
        "billing_orders", *_base_columns(),
        sa.Column("organization_id", pg.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("actor_user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idempotency_key", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("correlation", sa.String(128), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("monthly_credits", sa.Integer(), nullable=False),
        sa.Column("addon_credits", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", pg.JSONB(), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("provider_invoice_id", pg.UUID(as_uuid=True)),
        sa.Column("payment_url", sa.Text()),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.String(64)),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_billing_order_request"),
        sa.UniqueConstraint("id", "organization_id", name="uq_billing_order_tenant"),
        sa.UniqueConstraint("provider_invoice_id", name="uq_billing_order_invoice"),
        sa.UniqueConstraint("correlation", name="uq_billing_order_correlation"),
        sa.CheckConstraint("amount_minor > 0 AND currency = 'RUB'", name="ck_billing_order_amount"),
        sa.CheckConstraint("monthly_credits >= 0 AND addon_credits >= 0", name="ck_billing_order_credits"),
        sa.CheckConstraint("kind IN ('plan', 'addon')", name="ck_billing_order_kind"),
        sa.CheckConstraint("state IN ('creating', 'pending', 'review_required', 'paid', 'failed')", name="ck_billing_order_state"),
        sa.CheckConstraint("state <> 'paid' OR (provider_invoice_id IS NOT NULL AND paid_at IS NOT NULL)", name="ck_billing_order_paid_proof"),
    )
    op.create_table(
        "billing_periods", *_base_columns(),
        sa.Column("organization_id", pg.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("order_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_id", pg.UUID(as_uuid=True), sa.ForeignKey("billing_plans.id"), nullable=False),
        sa.Column("calendar_anchor", sa.DateTime(timezone=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("months", sa.Integer(), nullable=False),
        sa.Column("monthly_credits", sa.Integer(), nullable=False),
        sa.Column("next_grant_index", sa.Integer(), nullable=False),
        sa.Column("next_grant_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["order_id", "organization_id"], ["billing_orders.id", "billing_orders.organization_id"],
                                name="fk_billing_period_order_tenant"),
        sa.UniqueConstraint("order_id", name="uq_billing_period_order"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_billing_period_interval"),
        sa.CheckConstraint("months IN (1, 12) AND monthly_credits > 0", name="ck_billing_period_allowance"),
        sa.CheckConstraint("next_grant_index >= 0 AND next_grant_index <= months", name="ck_billing_period_grant_index"),
    )
    op.create_table(
        "billing_webhooks", *_base_columns(),
        sa.Column("event_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload_json", pg.JSONB(), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", pg.UUID(as_uuid=True)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.String(64)),
    )
    for table, columns in {"billing_orders": ["organization_id", "state"],
                           "billing_periods": ["organization_id", "starts_at", "ends_at", "next_grant_at"],
                           "billing_webhooks": ["state", "next_attempt_at"]}.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])
    # Preserve legacy plans/references; only seed approved purchasable plans.
    op.execute("UPDATE billing_plans SET price_month_minor = 129000 WHERE code = 'start' AND price_month_minor IS NULL")
    op.execute("UPDATE billing_plans SET price_month_minor = 349000 WHERE code = 'team' AND price_month_minor IS NULL")
    op.execute("""INSERT INTO billing_plans (id, code, name, price_month_minor, currency, limits_json, features_json,
               is_active, is_default, created_at, updated_at)
               VALUES ('66bfa6c0-9062-4c1b-a1fe-79731a153f8f', 'business', 'Business', 699000, 'RUB', '{}', '{}',
                       true, false, now(), now()) ON CONFLICT (code) DO NOTHING""")
    op.execute("""CREATE FUNCTION protect_billing_order_terms() RETURNS trigger AS $$ BEGIN
      IF (NEW.organization_id, NEW.actor_user_id, NEW.idempotency_key, NEW.request_hash, NEW.correlation,
          NEW.kind, NEW.amount_minor, NEW.currency, NEW.monthly_credits, NEW.addon_credits, NEW.snapshot_json)
         IS DISTINCT FROM
         (OLD.organization_id, OLD.actor_user_id, OLD.idempotency_key, OLD.request_hash, OLD.correlation,
          OLD.kind, OLD.amount_minor, OLD.currency, OLD.monthly_credits, OLD.addon_credits, OLD.snapshot_json)
      THEN RAISE EXCEPTION 'Payment order terms are immutable'; END IF;
      IF OLD.state = 'paid' AND (NEW.state IS DISTINCT FROM OLD.state OR NEW.paid_at IS DISTINCT FROM OLD.paid_at)
      THEN RAISE EXCEPTION 'Paid order is terminal'; END IF;
      IF OLD.provider_invoice_id IS NOT NULL AND NEW.provider_invoice_id IS DISTINCT FROM OLD.provider_invoice_id
      THEN RAISE EXCEPTION 'Payment invoice binding is immutable'; END IF;
      RETURN NEW; END $$ LANGUAGE plpgsql""")
    op.execute("CREATE TRIGGER billing_order_terms BEFORE UPDATE ON billing_orders FOR EACH ROW EXECUTE FUNCTION protect_billing_order_terms()")


def downgrade() -> None:
    op.execute("DROP TRIGGER billing_order_terms ON billing_orders")
    op.execute("DROP FUNCTION protect_billing_order_terms()")
    op.drop_table("billing_webhooks")
    op.drop_table("billing_periods")
    op.drop_table("billing_orders")
    # Catalog values remain: rolling back tables must not remove plans used by organizations.
