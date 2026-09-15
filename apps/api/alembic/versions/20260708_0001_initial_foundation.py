"""initial foundation

Revision ID: 20260708_0001
Revises:
Create Date: 2026-07-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260708_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("default_response_mode", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    op.create_table(
        "organization_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_organization_users_organization_id", "organization_users", ["organization_id"])
    op.create_index("ix_organization_users_user_id", "organization_users", ["user_id"])

    op.create_table(
        "marketplace_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("seller_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("credentials_encrypted", sa.Text(), nullable=False),
        sa.Column("credentials_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("credentials_last_rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("credentials_status", sa.String(length=64), nullable=False),
        sa.Column("scopes_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("default_response_mode", sa.String(length=32), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_marketplace_accounts_organization_id", "marketplace_accounts", ["organization_id"])
    op.create_index("ix_marketplace_accounts_marketplace", "marketplace_accounts", ["marketplace"])

    op.create_table(
        "products",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("marketplace_accounts.id"), nullable=False),
        sa.Column("marketplace", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("brand", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("product_url", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("organization_id", "marketplace_account_id", "external_id", name="uq_products_external"),
    )
    op.create_index("ix_products_organization_id", "products", ["organization_id"])
    op.create_index("ix_products_marketplace_account_id", "products", ["marketplace_account_id"])
    op.create_index("ix_products_marketplace", "products", ["marketplace"])

    op.create_table(
        "customer_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("marketplace_accounts.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("marketplace", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("customer_display_name", sa.String(length=255), nullable=True),
        sa.Column("customer_text", sa.Text(), nullable=False),
        sa.Column("customer_photos_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("marketplace_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("priority", sa.String(length=32), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
        sa.UniqueConstraint("organization_id", "marketplace_account_id", "marketplace", "external_id", "type", name="uq_customer_messages_external"),
    )
    op.create_index("ix_customer_messages_organization_id", "customer_messages", ["organization_id"])
    op.create_index("ix_customer_messages_marketplace_account_id", "customer_messages", ["marketplace_account_id"])
    op.create_index("ix_customer_messages_product_id", "customer_messages", ["product_id"])
    op.create_index("ix_customer_messages_marketplace", "customer_messages", ["marketplace"])
    op.create_index("ix_customer_messages_type", "customer_messages", ["type"])
    op.create_index("ix_customer_messages_status", "customer_messages", ["status"])
    op.create_index("ix_customer_messages_rating", "customer_messages", ["rating"])
    op.create_index("ix_customer_messages_marketplace_created_at", "customer_messages", ["marketplace_created_at"])
    op.create_index("ix_customer_messages_org_type_status", "customer_messages", ["organization_id", "type", "status"])

    op.create_table(
        "replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_messages.id"), nullable=False),
        sa.Column("reply_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sent_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("marketplace_reply_id", sa.String(length=255), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_reason", sa.Text(), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_replies_organization_id", "replies", ["organization_id"])
    op.create_index("ix_replies_message_id", "replies", ["message_id"])
    op.create_index("ix_replies_status", "replies", ["status"])

    op.create_table(
        "ai_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_messages.id"), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("prompt_version", sa.String(length=64), nullable=False),
        sa.Column("prompt_input_hash", sa.String(length=128), nullable=False),
        sa.Column("draft_text", sa.Text(), nullable=False),
        sa.Column("tokens_input", sa.Integer(), nullable=True),
        sa.Column("tokens_output", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("cost_estimate", sa.Numeric(12, 6), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("safety_flags_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_ai_drafts_organization_id", "ai_drafts", ["organization_id"])
    op.create_index("ix_ai_drafts_message_id", "ai_drafts", ["message_id"])

    op.create_table(
        "automation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("marketplace_accounts.id"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("applies_to", sa.String(length=32), nullable=False),
        sa.Column("marketplace", sa.String(length=64), nullable=True),
        sa.Column("min_rating", sa.Integer(), nullable=True),
        sa.Column("max_rating", sa.Integer(), nullable=True),
        sa.Column("product_ids_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("category_ids_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("include_keywords_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("exclude_keywords_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sensitive_topics_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("daily_limit", sa.Integer(), nullable=True),
        sa.Column("hourly_limit", sa.Integer(), nullable=True),
        sa.Column("require_manual_review_on_flags", sa.Boolean(), nullable=False),
        sa.Column("stop_on_missing_product_context", sa.Boolean(), nullable=False),
        sa.Column("stop_on_low_confidence", sa.Boolean(), nullable=False),
        sa.Column("confidence_threshold", sa.Float(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        *timestamps(),
    )
    op.create_index("ix_automation_rules_organization_id", "automation_rules", ["organization_id"])
    op.create_index("ix_automation_rules_marketplace_account_id", "automation_rules", ["marketplace_account_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=255), nullable=False),
        sa.Column("entity_type", sa.String(length=128), nullable=False),
        sa.Column("entity_id", sa.String(length=128), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_org_created_at", "audit_logs", ["organization_id", "created_at"])

    op.create_table(
        "usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_usage_events_organization_id", "usage_events", ["organization_id"])
    op.create_index("ix_usage_events_event_type", "usage_events", ["event_type"])
    op.create_index("ix_usage_events_org_event_created", "usage_events", ["organization_id", "event_type", "created_at"])

    op.create_table(
        "sync_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("marketplace_accounts.id"), nullable=False),
        sa.Column("job_type", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("stats_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_sync_jobs_organization_id", "sync_jobs", ["organization_id"])
    op.create_index("ix_sync_jobs_marketplace_account_id", "sync_jobs", ["marketplace_account_id"])
    op.create_index("ix_sync_jobs_status", "sync_jobs", ["status"])

    op.create_table(
        "integration_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("marketplace_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("marketplace_accounts.id"), nullable=True),
        sa.Column("marketplace", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("error_code", sa.String(length=128), nullable=True),
        sa.Column("error_message_safe", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_integration_events_organization_id", "integration_events", ["organization_id"])
    op.create_index("ix_integration_events_marketplace_account_id", "integration_events", ["marketplace_account_id"])
    op.create_index("ix_integration_events_marketplace", "integration_events", ["marketplace"])
    op.create_index("ix_integration_events_event_type", "integration_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("integration_events")
    op.drop_table("sync_jobs")
    op.drop_table("usage_events")
    op.drop_table("audit_logs")
    op.drop_table("automation_rules")
    op.drop_table("ai_drafts")
    op.drop_table("replies")
    op.drop_table("customer_messages")
    op.drop_table("products")
    op.drop_table("marketplace_accounts")
    op.drop_table("organization_users")
    op.drop_table("organizations")
    op.drop_table("users")
