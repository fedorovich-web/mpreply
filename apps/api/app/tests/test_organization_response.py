from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.organization import OrganizationResponse


def organization_payload(role: str) -> dict[str, object]:
    now = datetime.now(UTC)
    return {
        "id": uuid4(),
        "name": "Seller Group",
        "slug": "seller-group",
        "owner_user_id": uuid4(),
        "plan_id": None,
        "default_response_mode": "auto",
        "status": "active",
        "current_user_role": role,
        "created_at": now,
        "updated_at": now,
    }


def test_organization_response_serializes_current_user_role() -> None:
    response = OrganizationResponse.model_validate(organization_payload("admin"))

    assert response.current_user_role == "admin"
    assert response.model_dump(mode="json")["current_user_role"] == "admin"


def test_organization_response_rejects_unknown_current_user_role() -> None:
    with pytest.raises(ValidationError):
        OrganizationResponse.model_validate(organization_payload("editor"))
