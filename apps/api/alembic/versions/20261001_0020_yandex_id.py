"""External identities and browser-bound one-use OAuth handshakes."""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "20261001_0020"
down_revision: str | None = "20261001_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    return [sa.Column("id", pg.UUID(as_uuid=True), primary_key=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade() -> None:
    op.alter_column("users", "password_hash", nullable=True)
    op.create_table("auth_identities", *_base_columns(),
                    sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
                    sa.Column("provider", sa.String(32), nullable=False), sa.Column("subject", sa.String(128), nullable=False),
                    sa.UniqueConstraint("provider", "subject", name="uq_auth_identity_subject"),
                    sa.UniqueConstraint("user_id", "provider", name="uq_auth_identity_user_provider"))
    op.create_index("ix_auth_identities_user_id", "auth_identities", ["user_id"])
    op.create_table("oauth_states", *_base_columns(),
                    sa.Column("state_digest", sa.String(64), nullable=False, unique=True),
                    sa.Column("browser_digest", sa.String(64), nullable=False),
                    sa.Column("verifier_encrypted", sa.Text(), nullable=False),
                    sa.Column("mode", sa.String(16), nullable=False),
                    sa.Column("user_id", pg.UUID(as_uuid=True), sa.ForeignKey("users.id")), sa.Column("auth_version", sa.Integer()),
                    sa.Column("locale", sa.String(2), nullable=False), sa.Column("next_path", sa.String(2048), nullable=False),
                    sa.Column("intent", sa.String(32)), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("consumed_at", sa.DateTime(timezone=True)))
    op.create_index("ix_oauth_states_expires_at", "oauth_states", ["expires_at"])


def downgrade() -> None:
    # Fail closed instead of inventing local passwords when OAuth-only users already exist.
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT EXISTS (SELECT 1 FROM users WHERE password_hash IS NULL)")):
        raise RuntimeError("Cannot remove OAuth while passwordless accounts exist; retain migration and use feature flag")
    op.drop_table("oauth_states")
    op.drop_table("auth_identities")
    op.alter_column("users", "password_hash", nullable=False)
