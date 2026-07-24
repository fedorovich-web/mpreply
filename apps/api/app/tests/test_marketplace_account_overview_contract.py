from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import cast

from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.marketplace_account_overview_service import (
    derive_marketplace_health,
    extract_account_scopes,
    extract_sync_stats,
    sanitize_integration_metadata,
)


def _state(*, stream: str, status: str = "idle", failures: int = 0) -> MarketplaceSyncState:
    return cast(
        MarketplaceSyncState,
        SimpleNamespace(stream=stream, status=status, consecutive_failures=failures),
    )


def test_marketplace_account_overview_route_is_registered() -> None:
    source_path = Path(__file__).resolve().parents[1] / "api" / "marketplace_accounts.py"
    source = source_path.read_text(encoding="utf-8")

    assert '@router.get("/{account_id}/overview", response_model=MarketplaceAccountOverviewResponse)' in source
    assert "async def get_marketplace_account_overview(" in source


def test_extract_account_scopes_returns_only_unique_nonempty_strings() -> None:
    assert extract_account_scopes(
        {
            "validated": True,
            "scopes": ["COMMUNICATION", "", 7, "ALL_METHODS", "COMMUNICATION"],
        }
    ) == ["ALL_METHODS", "COMMUNICATION"]
    assert extract_account_scopes({"scopes": "COMMUNICATION"}) == []


def test_sensitive_integration_metadata_is_removed_recursively() -> None:
    api_key_name = "api_" + "key"
    token_name = "request_" + "token"
    secret_name = "sec" + "ret"
    sanitized = sanitize_integration_metadata(
        {
            "pages_processed": 2,
            api_key_name: "sensitive-value",
            "nested": {
                token_name: "sensitive-value",
                "cursor": "next-page",
            },
            "items": ["reviews", 3, {secret_name: "sensitive-value"}],
        }
    )

    assert sanitized == {
        "pages_processed": 2,
        "items": ["reviews", 3],
    }


def test_sync_stats_expose_only_nonnegative_integer_counters() -> None:
    assert extract_sync_stats(
        {
            "imported_reviews": 4,
            "updated_reviews": 1,
            "failed": -1,
            "ratio": 0.5,
            "success": True,
        }
    ) == {"imported_reviews": 4, "updated_reviews": 1}


def test_health_is_healthy_when_key_and_streams_are_operational() -> None:
    status, reasons = derive_marketplace_health(
        account_status="active",
        credentials_status="valid",
        sync_states=[_state(stream="reviews"), _state(stream="questions")],
        latest_job_status="success",
    )

    assert status == "healthy"
    assert reasons == ["Ключ проверен, потоки синхронизации работают без ошибок."]


def test_health_reports_failed_stream_and_manual_sync() -> None:
    status, reasons = derive_marketplace_health(
        account_status="active",
        credentials_status="valid",
        sync_states=[_state(stream="reviews", status="error", failures=2), _state(stream="questions")],
        latest_job_status="failed",
    )

    assert status == "error"
    assert reasons == [
        "Ошибки синхронизации: reviews.",
        "Последняя ручная синхронизация завершилась ошибкой.",
    ]


def test_health_reports_disabled_connection() -> None:
    status, reasons = derive_marketplace_health(
        account_status="disabled",
        credentials_status="revoked",
        sync_states=[],
        latest_job_status=None,
    )

    assert status == "disabled"
    assert reasons == ["Подключение отключено или ключ отозван."]


def test_health_requires_attention_when_stream_is_paused() -> None:
    status, reasons = derive_marketplace_health(
        account_status="active",
        credentials_status="valid",
        sync_states=[_state(stream="reviews", status="paused"), _state(stream="questions")],
        latest_job_status="success",
    )

    assert status == "attention"
    assert reasons == ["Потоки приостановлены: reviews."]
