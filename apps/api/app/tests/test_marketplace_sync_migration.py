from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Protocol, cast

import sqlalchemy as sa

MIGRATION_PATH = Path(__file__).resolve().parents[2] / "alembic" / "versions" / "20260912_0012_marketplace_sync_states.py"


class _OperationRecorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []
        self.table_elements: tuple[object, ...] = ()

    def create_table(self, name: str, *elements: object, **_: object) -> None:
        self.calls.append(("create_table", name))
        self.table_elements = elements

    def create_unique_constraint(
        self,
        name: str,
        table_name: str,
        _: list[str],
    ) -> None:
        self.calls.append(("create_unique_constraint", f"{table_name}.{name}"))

    def create_index(self, name: str, table_name: str, _: list[str], **__: object) -> None:
        self.calls.append(("create_index", f"{table_name}.{name}"))

    def drop_index(self, name: str, *, table_name: str) -> None:
        self.calls.append(("drop_index", f"{table_name}.{name}"))

    def drop_table(self, name: str) -> None:
        self.calls.append(("drop_table", name))

    def drop_constraint(self, name: str, table_name: str, *, type_: str) -> None:
        self.calls.append((f"drop_{type_}_constraint", f"{table_name}.{name}"))


class _MigrationModule(Protocol):
    revision: str
    down_revision: str
    op: object

    def upgrade(self) -> None: ...

    def downgrade(self) -> None: ...


def _load_migration() -> _MigrationModule:
    spec = importlib.util.spec_from_file_location("marketplace_sync_states_migration", MIGRATION_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load marketplace sync migration")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return cast(_MigrationModule, module)


def test_marketplace_sync_migration_is_single_head_link_and_reversible() -> None:
    migration = _load_migration()
    recorder = _OperationRecorder()
    migration.op = recorder

    migration.upgrade()

    assert migration.revision == "20260912_0012"
    assert migration.down_revision == "20260911_0011"
    assert recorder.calls == [
        (
            "create_unique_constraint",
            "marketplace_accounts.uq_marketplace_accounts_id_organization_id",
        ),
        ("create_table", "marketplace_sync_states"),
        ("create_index", "marketplace_sync_states.ix_marketplace_sync_states_account"),
        ("create_index", "marketplace_sync_states.ix_marketplace_sync_states_due"),
    ]
    constraint_names = {element.name for element in recorder.table_elements if isinstance(element, sa.Constraint)}
    assert constraint_names >= {
        "pk_marketplace_sync_states",
        "uq_marketplace_sync_states_account_stream",
        "ck_marketplace_sync_states_stream",
        "ck_marketplace_sync_states_status",
        "ck_marketplace_sync_states_failures_nonnegative",
        "ck_marketplace_sync_states_lease_shape",
        "fk_marketplace_sync_states_account_tenant",
    }

    recorder.calls.clear()
    migration.downgrade()

    assert recorder.calls == [
        ("drop_index", "marketplace_sync_states.ix_marketplace_sync_states_due"),
        ("drop_index", "marketplace_sync_states.ix_marketplace_sync_states_account"),
        ("drop_table", "marketplace_sync_states"),
        (
            "drop_unique_constraint",
            "marketplace_accounts.uq_marketplace_accounts_id_organization_id",
        ),
    ]
