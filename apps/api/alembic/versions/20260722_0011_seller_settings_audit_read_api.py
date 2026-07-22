"""seller settings and tenant audit read foundation

Revision ID: 20260722_0011
Revises: 20260722_0010
Create Date: 2026-07-22 10:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260722_0011"
down_revision: str | None = "20260722_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "seller_settings",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("response_tone", sa.String(length=32), nullable=False, server_default="neutral"),
        sa.Column("brand_rules", sa.Text(), nullable=True),
        sa.Column("knowledge_base", sa.Text(), nullable=True),
        sa.Column("reply_signature", sa.String(length=500), nullable=True),
        sa.Column(
            "prohibited_phrases_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "response_tone IN ('neutral', 'friendly', 'formal', 'apologetic')",
            name="ck_seller_settings_response_tone",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(prohibited_phrases_json) = 'array'",
            name="ck_seller_settings_prohibited_phrases_array",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", name="uq_seller_settings_organization"),
    )
    op.create_index(op.f("ix_seller_settings_organization_id"), "seller_settings", ["organization_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO seller_settings (
                id,
                organization_id,
                response_tone,
                prohibited_phrases_json,
                created_at,
                updated_at
            )
            SELECT
                md5('mpreply:seller-settings:' || organization.id::text)::uuid,
                organization.id,
                'neutral',
                '[]'::jsonb,
                now(),
                now()
            FROM organizations AS organization
            ON CONFLICT (organization_id) DO NOTHING
            """
        )
    )

    op.create_index(
        "ix_audit_logs_org_actor_created_at",
        "audit_logs",
        ["organization_id", "actor_user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_audit_logs_org_entity_created_at",
        "audit_logs",
        ["organization_id", "entity_type", "created_at"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            CREATE FUNCTION prevent_audit_log_mutation()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_logs is append-only';
            END;
            $$ LANGUAGE plpgsql
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER trg_audit_logs_append_only
            BEFORE UPDATE OR DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation()
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE TRIGGER trg_audit_logs_no_truncate
            BEFORE TRUNCATE ON audit_logs
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation()
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs"))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS prevent_audit_log_mutation()"))
    op.drop_index("ix_audit_logs_org_entity_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_actor_created_at", table_name="audit_logs")
    op.drop_index(op.f("ix_seller_settings_organization_id"), table_name="seller_settings")
    op.drop_table("seller_settings")
