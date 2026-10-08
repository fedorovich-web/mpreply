"""Durable import to automatic AI generation jobs.

Revision ID: 20260930_0018
Revises: 20260930_0017
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260930_0018"
down_revision: str | None = "20260930_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "automatic_draft_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("operation_key", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", postgresql.UUID(as_uuid=True)),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True)),
        sa.Column("draft_id", postgresql.UUID(as_uuid=True)),
        sa.Column("outcome", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("message_id", name="uq_automatic_draft_job_message"),
        sa.ForeignKeyConstraint(
            ["message_id", "organization_id"], ["customer_messages.id", "customer_messages.organization_id"],
            name="fk_automatic_draft_job_message_tenant",
        ),
        sa.ForeignKeyConstraint(
            ["draft_id", "organization_id"], ["ai_drafts.id", "ai_drafts.organization_id"],
            name="fk_automatic_draft_job_draft_tenant",
        ),
        sa.CheckConstraint("state IN ('pending', 'dispatched', 'processing', 'completed', 'failed')", name="ck_automatic_draft_job_state"),
        sa.CheckConstraint("attempt_count >= 0 AND attempt_count <= 4", name="ck_automatic_draft_job_attempts"),
    )
    op.create_index("ix_automatic_draft_jobs_due", "automatic_draft_jobs", ["state", "next_attempt_at", "lease_expires_at"])


def downgrade() -> None:
    op.drop_table("automatic_draft_jobs")
