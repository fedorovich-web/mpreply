from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.payment_order import PaymentOrder
from app.models.payment_refund import PaymentRefund
from app.models.payment_webhook_event import PaymentWebhookEvent
from app.providers.yookassa import (
    YooKassaProvider,
    is_allowed_source_ip,
    minor_to_value,
    parse_notification,
    resolve_source_ip,
    value_to_minor,
)
from app.schemas.payment import PaymentOrderCreateRequest
from app.services.answer_entitlement_service import AnswerEntitlementService

API_ROOT = Path(__file__).resolve().parents[2]


def test_money_conversion_uses_integer_minor_units() -> None:
    assert minor_to_value(116000) == "1160.00"
    assert value_to_minor("1160.00") == 116000
    assert value_to_minor("0.01") == 1


def test_money_conversion_rejects_non_positive_create_amount() -> None:
    with pytest.raises(ValueError):
        minor_to_value(0)


def test_provider_amount_rejects_sub_kopeck_precision() -> None:
    with pytest.raises(RuntimeError):
        value_to_minor("1.005")


def test_provider_amount_rejects_non_finite_values() -> None:
    for value in ("NaN", "Infinity", "-Infinity"):
        with pytest.raises(RuntimeError):
            value_to_minor(value)


def test_revoked_grant_release_never_restores_refunded_credits() -> None:
    entry_type, balance_delta, available_delta, restore_grant = AnswerEntitlementService.release_accounting(
        grant_revoked=True,
        quantity=1,
    )

    assert entry_type == "revoke"
    assert (balance_delta, available_delta, restore_grant) == (-1, 0, False)

    entry_type, balance_delta, available_delta, restore_grant = AnswerEntitlementService.release_accounting(
        grant_revoked=False,
        quantity=1,
    )

    assert entry_type == "release"
    assert (balance_delta, available_delta, restore_grant) == (0, 1, True)


def test_provider_payment_parser_preserves_verified_money_and_metadata() -> None:
    payment = YooKassaProvider.parse_payment(
        {
            "id": "payment-1",
            "status": "succeeded",
            "paid": True,
            "amount": {"value": "1160.00", "currency": "RUB"},
            "metadata": {"mpreply_payment_order_id": "order-1"},
            "confirmation": {"confirmation_url": "https://example.test/confirm"},
        }
    )

    assert payment.amount_minor == 116000
    assert payment.currency == "RUB"
    assert payment.metadata["mpreply_payment_order_id"] == "order-1"
    assert payment.confirmation_url == "https://example.test/confirm"


def test_provider_refund_parser_preserves_payment_link() -> None:
    refund = YooKassaProvider.parse_refund(
        {
            "id": "refund-1",
            "payment_id": "payment-1",
            "status": "succeeded",
            "amount": {"value": "1160.00", "currency": "RUB"},
        }
    )

    assert refund.payment_id == "payment-1"
    assert refund.amount_minor == 116000


def test_notification_parser_accepts_payment_and_refund_events() -> None:
    payment = parse_notification(
        {"type": "notification", "event": "payment.succeeded", "object": {"id": "payment-1"}}
    )
    refund = parse_notification(
        {"type": "notification", "event": "refund.succeeded", "object": {"id": "refund-1"}}
    )

    assert payment.object_type == "payment"
    assert refund.object_type == "refund"
    assert len(payment.payload_sha256) == 64


def test_notification_parser_rejects_unknown_events() -> None:
    with pytest.raises(RuntimeError):
        parse_notification({"type": "notification", "event": "payout.succeeded", "object": {"id": "x"}})
    with pytest.raises(RuntimeError):
        parse_notification({"type": "notification", "event": "payment.unknown", "object": {"id": "x"}})


def test_webhook_ip_allowlist_supports_ipv4_and_ipv6() -> None:
    networks = ["185.71.76.0/27", "2a02:5180::/32"]

    assert is_allowed_source_ip("185.71.76.10", networks)
    assert is_allowed_source_ip("2a02:5180::1", networks)
    assert not is_allowed_source_ip("203.0.113.10", networks)


def test_forwarded_ip_is_used_only_for_trusted_proxy() -> None:
    assert (
        resolve_source_ip(
            peer_ip="127.0.0.1",
            forwarded_for="185.71.76.10, 127.0.0.1",
            trusted_proxy_networks=["127.0.0.1/32"],
        )
        == "185.71.76.10"
    )
    assert (
        resolve_source_ip(
            peer_ip="203.0.113.10",
            forwarded_for="185.71.76.10",
            trusted_proxy_networks=["127.0.0.1/32"],
        )
        == "203.0.113.10"
    )


def test_payment_request_rejects_invalid_package_code() -> None:
    payload = PaymentOrderCreateRequest(organization_id=uuid4(), package_code="start-500")
    assert payload.package_code == "start-500"

    with pytest.raises(ValidationError):
        PaymentOrderCreateRequest(organization_id=uuid4(), package_code="START 500")


def test_payment_models_are_registered() -> None:
    assert PaymentOrder.__tablename__ == "payment_orders"
    assert PaymentWebhookEvent.__tablename__ == "payment_webhook_events"
    assert PaymentRefund.__tablename__ == "payment_refunds"


def test_payment_creation_requires_idempotency_and_provider_metadata() -> None:
    service = (API_ROOT / "app" / "services" / "payment_service.py").read_text(encoding="utf-8")
    provider = (API_ROOT / "app" / "providers" / "yookassa.py").read_text(encoding="utf-8")

    assert "PaymentOrder.organization_id == organization_id" in service
    assert "PaymentOrder.idempotency_key == normalized_key" in service
    assert "pg_advisory_xact_lock" in service
    assert 'headers={"Idempotence-Key": idempotency_key}' in provider
    assert '"mpreply_payment_order_id": str(order.id)' in service
    assert 'key.endswith("_payment_order_id")' in service


def test_webhook_is_verified_by_ip_and_provider_get() -> None:
    service = (API_ROOT / "app" / "services" / "payment_service.py").read_text(encoding="utf-8")

    assert "payment_webhook_ip_check_enabled" in service
    assert "is_allowed_source_ip" in service
    assert "get_payment(notification.object_id)" in service
    assert "get_refund(notification.object_id)" in service
    assert "payment_order_not_ready" in service


def test_credit_grant_is_created_only_after_verified_success() -> None:
    service = (API_ROOT / "app" / "services" / "payment_service.py").read_text(encoding="utf-8")

    success_branch = service.index('if payment.status == "succeeded" and payment.paid:')
    grant_call = service.index("self.entitlements.grant_package", success_branch)
    assert grant_call > success_branch
    assert 'idempotency_key=f"payment:{order.id}:grant"' in service


def test_refund_revokes_only_fully_unused_purchase_grant() -> None:
    entitlement = (API_ROOT / "app" / "services" / "answer_entitlement_service.py").read_text(encoding="utf-8")
    service = (API_ROOT / "app" / "services" / "payment_service.py").read_text(encoding="utf-8")

    assert "revoke_purchase_grant" in entitlement
    assert "grant.revoked_at = current" in entitlement
    assert "active_reserved_quantity" in entitlement
    assert "consumed_quantity" in entitlement
    assert "AnswerReservation.status == AnswerReservationStatus.ACTIVE.value" in entitlement
    assert "REFUND_REVIEW_REQUIRED" in service


def test_payment_routes_are_registered_without_public_ui_changes() -> None:
    main = (API_ROOT / "app" / "main.py").read_text(encoding="utf-8")
    api = (API_ROOT / "app" / "api" / "payments.py").read_text(encoding="utf-8")

    assert "payments_router" in main
    assert "app.include_router(payments_router)" in main
    assert '@router.post("/webhooks/yookassa"' in api
    assert '@router.post("/payment-orders"' in api
    assert "async def _read_limited_body" in api
    assert "request.stream()" in api
    assert "HTTP_413_REQUEST_ENTITY_TOO_LARGE" in api


def test_migration_extends_append_only_ledger_and_creates_payment_tables() -> None:
    migration = (
        API_ROOT / "alembic" / "versions" / "20260722_0014_payment_foundation.py"
    ).read_text(encoding="utf-8")

    assert 'revision: str = "20260722_0014"' in migration
    assert 'down_revision: str | None = "20260722_0013"' in migration
    assert 'op.create_table(\n        "payment_orders"' in migration
    assert 'op.create_table(\n        "payment_webhook_events"' in migration
    assert 'op.create_table(\n        "payment_refunds"' in migration
    assert "'revoke'" in migration
    assert 'op.add_column(\n        "answer_credit_grants"' in migration
    assert 'sa.Column("revoked_at"' in migration
    assert "Cannot downgrade payment foundation while financial records exist" in migration
    assert "SELECT 1 FROM payment_orders" in migration


def test_payment_config_uses_official_yookassa_networks() -> None:
    config = (API_ROOT / "app" / "core" / "config.py").read_text(encoding="utf-8")

    assert '"185.71.76.0/27"' in config
    assert '"185.71.77.0/27"' in config
    assert '"77.75.153.0/25"' in config
    assert '"2a02:5180::/32"' in config
