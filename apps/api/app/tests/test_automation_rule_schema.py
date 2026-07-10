from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.automation_rule import AutomationRuleCreateRequest


def test_automation_rule_schema_rejects_invalid_rating_range() -> None:
    with pytest.raises(ValidationError):
        AutomationRuleCreateRequest(
            organization_id=UUID("00000000-0000-0000-0000-000000000001"),
            name="Invalid range",
            min_rating=5,
            max_rating=2,
        )


def test_automation_rule_schema_normalizes_keyword_lists() -> None:
    payload = AutomationRuleCreateRequest(
        organization_id=UUID("00000000-0000-0000-0000-000000000001"),
        name="Keyword rule",
        include_keywords=[" доставка ", "ДОСТАВКА", "упаковка"],
    )

    assert payload.include_keywords == ["доставка", "упаковка"]

def test_automation_rule_update_schema_normalizes_keyword_lists() -> None:
    from app.schemas.automation_rule import AutomationRuleUpdateRequest

    payload = AutomationRuleUpdateRequest(include_keywords=[" доставка ", "ДОСТАВКА", "упаковка"])

    assert payload.include_keywords == ["доставка", "упаковка"]

