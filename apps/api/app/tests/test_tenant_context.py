from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.tenant import TenantContext


def test_tenant_context_allows_expected_role() -> None:
    context = TenantContext(organization_id=uuid4(), user_id=uuid4(), role="owner")

    context.require_role({"owner", "admin"})


def test_tenant_context_blocks_unexpected_role() -> None:
    context = TenantContext(organization_id=uuid4(), user_id=uuid4(), role="viewer")

    with pytest.raises(HTTPException):
        context.require_role({"owner", "admin"})
