"""durable reply credit grants, reservations and immutable events

Revision ID: 20260930_0016
Revises: 20260914_0015
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260930_0016"
down_revision: str | None = "20260914_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reply_credit_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("source_key", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False),
        sa.Column("consumed", sa.Integer(), nullable=False),
        sa.Column("expired", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "source_key", name="uq_reply_credit_grant_source"),
        sa.UniqueConstraint("id", "organization_id", name="uq_reply_credit_grant_tenant"),
        sa.CheckConstraint("quantity > 0 AND available >= 0 AND reserved >= 0 AND consumed >= 0 AND expired >= 0", name="ck_reply_credit_grant_nonnegative"),
        sa.CheckConstraint("quantity = available + reserved + consumed + expired", name="ck_reply_credit_grant_conservation"),
        sa.CheckConstraint("kind IN ('trial', 'monthly', 'addon')", name="ck_reply_credit_grant_kind"),
        sa.CheckConstraint("(kind = 'trial' AND expires_at IS NOT NULL) OR (kind <> 'trial' AND expires_at IS NULL)", name="ck_reply_credit_grant_expiry"),
    )
    op.create_index("ix_reply_credit_grants_organization_id", "reply_credit_grants", ["organization_id"])
    op.create_table(
        "reply_credit_operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("operation_key", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("draft_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("release_reason", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", "operation_key", name="uq_reply_credit_operation_key"),
        sa.UniqueConstraint("id", "organization_id", name="uq_reply_credit_operation_tenant"),
        sa.UniqueConstraint("draft_id", name="uq_reply_credit_operation_draft"),
        sa.ForeignKeyConstraint(
            ["grant_id", "organization_id"], ["reply_credit_grants.id", "reply_credit_grants.organization_id"], name="fk_reply_credit_operation_grant_tenant"
        ),
        sa.ForeignKeyConstraint(["draft_id", "organization_id"], ["ai_drafts.id", "ai_drafts.organization_id"], name="fk_reply_credit_operation_draft_tenant"),
        sa.CheckConstraint("state IN ('reserved', 'completed', 'released')", name="ck_reply_credit_operation_state"),
        sa.CheckConstraint(
            "(state = 'completed' AND draft_id IS NOT NULL) OR (state <> 'completed' AND draft_id IS NULL)", name="ck_reply_credit_operation_draft"
        ),
    )
    op.create_index("ix_reply_credit_operations_organization_id", "reply_credit_operations", ["organization_id"])
    op.create_index("ix_reply_credit_operations_lease_expires_at", "reply_credit_operations", ["lease_expires_at"])
    op.create_table(
        "reply_credit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["grant_id", "organization_id"], ["reply_credit_grants.id", "reply_credit_grants.organization_id"], name="fk_reply_credit_event_grant_tenant"
        ),
        sa.ForeignKeyConstraint(
            ["operation_id", "organization_id"],
            ["reply_credit_operations.id", "reply_credit_operations.organization_id"],
            name="fk_reply_credit_event_operation_tenant",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_reply_credit_event_positive"),
        sa.CheckConstraint("kind IN ('grant', 'reserve', 'consume', 'release', 'expire')", name="ck_reply_credit_event_kind"),
    )
    op.create_index("ix_reply_credit_events_organization_id", "reply_credit_events", ["organization_id"])
    op.execute("""
        CREATE FUNCTION reject_reply_credit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'Reply credit events are immutable';
        END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER reply_credit_events_immutable
        BEFORE UPDATE OR DELETE ON reply_credit_events
        FOR EACH ROW EXECUTE FUNCTION reject_reply_credit_event_mutation()
    """)
    op.create_table(
        "reply_trial_claims",
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("grant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("organization_id", name="uq_reply_trial_claim_organization"),
        sa.ForeignKeyConstraint(
            ["grant_id", "organization_id"],
            ["reply_credit_grants.id", "reply_credit_grants.organization_id"],
            name="fk_reply_trial_claim_grant_tenant",
        ),
        sa.CheckConstraint("ends_at > starts_at", name="ck_reply_trial_claim_period"),
    )


def downgrade() -> None:
    op.drop_table("reply_trial_claims")
    op.drop_table("reply_credit_events")
    op.execute("DROP FUNCTION reject_reply_credit_event_mutation()")
    op.drop_table("reply_credit_operations")
    op.drop_table("reply_credit_grants")
