from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_unsafe_api_request_requires_csrf_header() -> None:
    with TestClient(create_app()) as client:
        response = client.post("/api/auth/login", json={})

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF validation failed"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-request-id"]


def test_unsafe_api_request_rejects_wrong_csrf_header_value() -> None:
    with TestClient(create_app()) as client:
        response = client.post("/api/auth/login", json={}, headers={"X-CSRF-Token": "wrong"})

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF validation failed"}


def test_valid_csrf_header_reaches_request_validation() -> None:
    with TestClient(create_app()) as client:
        response = client.post("/api/auth/login", json={}, headers={"X-CSRF-Token": "1"})

    assert response.status_code == 422


def test_safe_api_request_does_not_require_csrf_header() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health/live")

    assert response.status_code == 200


def test_cors_preflight_allows_csrf_header() -> None:
    with TestClient(create_app()) as client:
        response = client.options(
            "/api/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-CSRF-Token,Content-Type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_yookassa_webhook_uses_provider_validation_instead_of_browser_csrf() -> None:
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/billing/webhooks/yookassa",
            content=b"x" * 65_537,
            headers={"Content-Type": "application/json"},
        )

    assert response.status_code == 413
    assert response.json() != {"detail": "CSRF validation failed"}
