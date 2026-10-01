from sqlalchemy import Table
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.models.billing_order import BillingOrder
from app.models.billing_period import BillingPeriod
from app.models.billing_webhook import BillingWebhook


def test_order_constraints_prevent_duplicate_invoice_or_idempotency_key() -> None:
    table = BillingOrder.__table__
    assert isinstance(table, Table)
    ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    assert "UNIQUE (organization_id, idempotency_key)" in ddl
    assert "UNIQUE (provider_invoice_id)" in ddl
    assert "UNIQUE (correlation)" in ddl
    assert "amount_minor > 0" in ddl


def test_period_foreign_key_is_tenant_scoped() -> None:
    table = BillingPeriod.__table__
    assert isinstance(table, Table)
    ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
    assert "FOREIGN KEY(order_id, organization_id) REFERENCES billing_orders (id, organization_id)" in ddl
    assert "ends_at > starts_at" in ddl
    assert "UNIQUE (order_id)" in ddl


def test_durable_inbox_has_event_deduplication_and_processing_lease() -> None:
    table = BillingWebhook.__table__
    assert table.c.event_digest.unique
    assert {"lease_token", "lease_expires_at", "next_attempt_at", "attempt_count", "payload_json"}.issubset(table.c.keys())
