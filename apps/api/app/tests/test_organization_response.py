from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.organization import OrganizationCreateRequest, OrganizationResponse, OrganizationUpdateRequest


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


@pytest.mark.parametrize("schema", [OrganizationCreateRequest, OrganizationUpdateRequest])
@pytest.mark.parametrize("name", ["  ", " x "])
def test_workspace_name_requires_two_characters_after_trimming(
    schema: type[OrganizationCreateRequest] | type[OrganizationUpdateRequest], name: str,
) -> None:
    with pytest.raises(ValidationError):
        schema(name=name)


def test_workspace_requests_normalize_name_before_persistence() -> None:
    assert OrganizationCreateRequest(name="  Seller Group  ").name == "Seller Group"
    assert OrganizationUpdateRequest(name="  Seller Group  ").name == "Seller Group"
