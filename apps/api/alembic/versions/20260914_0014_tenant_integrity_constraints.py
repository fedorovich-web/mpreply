"""enforce tenant integrity for marketplace data

Revision ID: 20260914_0014
Revises: 20260914_0013
Create Date: 2026-09-14
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260914_0014"
down_revision: str | None = "20260914_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_products_id_tenant_account",
        "products",
        ["id", "organization_id", "marketplace_account_id"],
    )
    op.create_unique_constraint(
        "uq_customer_messages_id_organization_id",
        "customer_messages",
        ["id", "organization_id"],
    )
    op.create_unique_constraint(
        "uq_ai_drafts_id_organization_id",
        "ai_drafts",
        ["id", "organization_id"],
    )
    op.create_unique_constraint(
        "uq_automation_rules_id_organization_id",
        "automation_rules",
        ["id", "organization_id"],
    )

    op.drop_constraint(
        "products_marketplace_account_id_fkey",
        "products",
        type_="foreignkey",
    )
    op.drop_constraint(
        "customer_messages_marketplace_account_id_fkey",
        "customer_messages",
        type_="foreignkey",
    )
    op.drop_constraint(
        "customer_messages_product_id_fkey",
        "customer_messages",
        type_="foreignkey",
    )
    op.drop_constraint("ai_drafts_message_id_fkey", "ai_drafts", type_="foreignkey")
    op.drop_constraint(
        "automation_rules_marketplace_account_id_fkey",
        "automation_rules",
        type_="foreignkey",
    )
    op.drop_constraint("replies_message_id_fkey", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_ai_draft_id", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_automation_rule_id", "replies", type_="foreignkey")
    op.drop_constraint(
        "integration_events_marketplace_account_id_fkey",
        "integration_events",
        type_="foreignkey",
    )
    op.drop_constraint(
        "sync_jobs_marketplace_account_id_fkey",
        "sync_jobs",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_products_account_tenant",
        "products",
        "marketplace_accounts",
        ["marketplace_account_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_customer_messages_account_tenant",
        "customer_messages",
        "marketplace_accounts",
        ["marketplace_account_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_customer_messages_product_tenant",
        "customer_messages",
        "products",
        ["product_id", "organization_id", "marketplace_account_id"],
        ["id", "organization_id", "marketplace_account_id"],
    )
    op.create_foreign_key(
        "fk_ai_drafts_message_tenant",
        "ai_drafts",
        "customer_messages",
        ["message_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_automation_rules_account_tenant",
        "automation_rules",
        "marketplace_accounts",
        ["marketplace_account_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_replies_message_tenant",
        "replies",
        "customer_messages",
        ["message_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_replies_ai_draft_tenant",
        "replies",
        "ai_drafts",
        ["ai_draft_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_replies_automation_rule_tenant",
        "replies",
        "automation_rules",
        ["automation_rule_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_integration_events_account_tenant",
        "integration_events",
        "marketplace_accounts",
        ["marketplace_account_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_sync_jobs_account_tenant",
        "sync_jobs",
        "marketplace_accounts",
        ["marketplace_account_id", "organization_id"],
        ["id", "organization_id"],
    )
    op.create_foreign_key(
        "fk_customer_messages_assignee_tenant",
        "customer_messages",
        "organization_users",
        ["organization_id", "assigned_to"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_ai_drafts_creator_tenant",
        "ai_drafts",
        "organization_users",
        ["organization_id", "created_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_automation_rules_creator_tenant",
        "automation_rules",
        "organization_users",
        ["organization_id", "created_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_automation_rules_updater_tenant",
        "automation_rules",
        "organization_users",
        ["organization_id", "updated_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_replies_creator_tenant",
        "replies",
        "organization_users",
        ["organization_id", "created_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_replies_approver_tenant",
        "replies",
        "organization_users",
        ["organization_id", "approved_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_replies_sender_tenant",
        "replies",
        "organization_users",
        ["organization_id", "sent_by"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_usage_events_user_tenant",
        "usage_events",
        "organization_users",
        ["organization_id", "user_id"],
        ["organization_id", "user_id"],
    )
    op.create_foreign_key(
        "fk_audit_logs_actor_tenant",
        "audit_logs",
        "organization_users",
        ["organization_id", "actor_user_id"],
        ["organization_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_audit_logs_actor_tenant", "audit_logs", type_="foreignkey")
    op.drop_constraint("fk_usage_events_user_tenant", "usage_events", type_="foreignkey")
    op.drop_constraint("fk_replies_sender_tenant", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_approver_tenant", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_creator_tenant", "replies", type_="foreignkey")
    op.drop_constraint(
        "fk_automation_rules_updater_tenant",
        "automation_rules",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_automation_rules_creator_tenant",
        "automation_rules",
        type_="foreignkey",
    )
    op.drop_constraint("fk_ai_drafts_creator_tenant", "ai_drafts", type_="foreignkey")
    op.drop_constraint(
        "fk_customer_messages_assignee_tenant",
        "customer_messages",
        type_="foreignkey",
    )
    op.drop_constraint("fk_sync_jobs_account_tenant", "sync_jobs", type_="foreignkey")
    op.drop_constraint(
        "fk_integration_events_account_tenant",
        "integration_events",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_replies_automation_rule_tenant",
        "replies",
        type_="foreignkey",
    )
    op.drop_constraint("fk_replies_ai_draft_tenant", "replies", type_="foreignkey")
    op.drop_constraint("fk_replies_message_tenant", "replies", type_="foreignkey")
    op.drop_constraint(
        "fk_automation_rules_account_tenant",
        "automation_rules",
        type_="foreignkey",
    )
    op.drop_constraint("fk_ai_drafts_message_tenant", "ai_drafts", type_="foreignkey")
    op.drop_constraint(
        "fk_customer_messages_product_tenant",
        "customer_messages",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_customer_messages_account_tenant",
        "customer_messages",
        type_="foreignkey",
    )
    op.drop_constraint("fk_products_account_tenant", "products", type_="foreignkey")

    op.create_foreign_key(
        "products_marketplace_account_id_fkey",
        "products",
        "marketplace_accounts",
        ["marketplace_account_id"],
        ["id"],
    )
    op.create_foreign_key(
        "customer_messages_marketplace_account_id_fkey",
        "customer_messages",
        "marketplace_accounts",
        ["marketplace_account_id"],
        ["id"],
    )
    op.create_foreign_key(
        "customer_messages_product_id_fkey",
        "customer_messages",
        "products",
        ["product_id"],
        ["id"],
    )
    op.create_foreign_key(
        "ai_drafts_message_id_fkey",
        "ai_drafts",
        "customer_messages",
        ["message_id"],
        ["id"],
    )
    op.create_foreign_key(
        "automation_rules_marketplace_account_id_fkey",
        "automation_rules",
        "marketplace_accounts",
        ["marketplace_account_id"],
        ["id"],
    )
    op.create_foreign_key(
        "replies_message_id_fkey",
        "replies",
        "customer_messages",
        ["message_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_replies_ai_draft_id",
        "replies",
        "ai_drafts",
        ["ai_draft_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_replies_automation_rule_id",
        "replies",
        "automation_rules",
        ["automation_rule_id"],
        ["id"],
    )
    op.create_foreign_key(
        "integration_events_marketplace_account_id_fkey",
        "integration_events",
        "marketplace_accounts",
        ["marketplace_account_id"],
        ["id"],
    )
    op.create_foreign_key(
        "sync_jobs_marketplace_account_id_fkey",
        "sync_jobs",
        "marketplace_accounts",
        ["marketplace_account_id"],
        ["id"],
    )

    op.drop_constraint(
        "uq_automation_rules_id_organization_id",
        "automation_rules",
        type_="unique",
    )
    op.drop_constraint(
        "uq_ai_drafts_id_organization_id",
        "ai_drafts",
        type_="unique",
    )
    op.drop_constraint(
        "uq_customer_messages_id_organization_id",
        "customer_messages",
        type_="unique",
    )
    op.drop_constraint(
        "uq_products_id_tenant_account",
        "products",
        type_="unique",
    )
