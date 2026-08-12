"""Allow Avito chat scheduler sync states."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260812_0015"
down_revision: str | None = "20260722_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_marketplace_sync_states_stream",
        "marketplace_sync_states",
        type_="check",
    )
    op.create_check_constraint(
        "ck_marketplace_sync_states_stream",
        "marketplace_sync_states",
        "stream IN ('reviews', 'questions', 'chats')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_marketplace_sync_states_stream",
        "marketplace_sync_states",
        type_="check",
    )
    op.create_check_constraint(
        "ck_marketplace_sync_states_stream",
        "marketplace_sync_states",
        "stream IN ('reviews', 'questions')",
    )
