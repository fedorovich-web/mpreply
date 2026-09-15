from app.main import app


def test_manual_reply_workflow_routes_are_registered() -> None:
    paths = app.openapi()["paths"]
    routes = {(path, method.upper()) for path, operations in paths.items() for method in operations}

    expected = {
        ("/api/replies/manual", "POST"),
        ("/api/replies/{reply_id}/draft", "PATCH"),
        ("/api/replies/{reply_id}/submit-review", "POST"),
        ("/api/replies/{reply_id}/approve", "POST"),
        ("/api/replies/{reply_id}/reject", "POST"),
        ("/api/replies/{reply_id}/send", "POST"),
        ("/api/replies/review-queue", "GET"),
    }

    assert expected.issubset(routes)
