from fastapi.routing import APIRoute

from app.main import app


def test_manual_reply_workflow_routes_are_registered() -> None:
    routes = {
        (route.path, method)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }

    expected = {
        ("/api/replies/manual", "POST"),
        ("/api/replies/{reply_id}/draft", "PATCH"),
        ("/api/replies/{reply_id}/submit-review", "POST"),
        ("/api/replies/{reply_id}/approve", "POST"),
        ("/api/replies/{reply_id}/reject", "POST"),
        ("/api/replies/{reply_id}/send", "POST"),
    }

    assert expected.issubset(routes)
