from __future__ import annotations

from app.core.logging import scrub_secrets


def test_recursive_log_redaction_removes_marketplace_and_auth_secrets() -> None:
    event = scrub_secrets(
        object(),
        "info",
        {
            "authorization": "Bearer top-secret-token",
            "nested": {
                "client_secret": "top-secret-client",
                "items": [
                    {"Api-Key": "top-secret-api-key"},
                    "Authorization: Bearer top-secret-inline",
                ],
            },
            "message": "access_token=top-secret-access",
        },
    )
    rendered = repr(event)

    assert "top-secret" not in rendered
    assert rendered.count("[REDACTED]") >= 5


def test_redaction_preserves_safe_operational_context() -> None:
    event = scrub_secrets(
        object(),
        "info",
        {
            "marketplace": "wildberries",
            "account_id": "account-1",
            "status": "failed",
            "error_code": "rate_limited",
        },
    )

    assert event == {
        "marketplace": "wildberries",
        "account_id": "account-1",
        "status": "failed",
        "error_code": "rate_limited",
    }
