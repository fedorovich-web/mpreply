from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.automation_rule import AutomationRuleCreateRequest, AutomationRuleUpdateRequest


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
    payload = AutomationRuleUpdateRequest(include_keywords=[" доставка ", "ДОСТАВКА", "упаковка"])

    assert payload.include_keywords == ["доставка", "упаковка"]


def test_automation_rule_schema_accepts_chat_specific_rules() -> None:
    organization_id = UUID("00000000-0000-0000-0000-000000000001")

    created = AutomationRuleCreateRequest(
        organization_id=organization_id,
        name="Avito buyer messages",
        applies_to="chat",
        marketplace="avito",
    )
    updated = AutomationRuleUpdateRequest(applies_to="chat")

    assert created.applies_to == "chat"
    assert updated.applies_to == "chat"


@pytest.mark.parametrize(
    "field_name",
    [
        "name",
        "priority",
        "is_enabled",
        "mode",
        "applies_to",
        "product_ids",
        "category_ids",
        "include_keywords",
        "exclude_keywords",
        "sensitive_topics",
        "require_manual_review_on_flags",
        "stop_on_missing_product_context",
        "stop_on_low_confidence",
        "confidence_threshold",
    ],
)
def test_automation_rule_update_rejects_null_for_required_values(field_name: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        AutomationRuleUpdateRequest.model_validate({field_name: None})

    assert exc_info.value.errors()[0]["loc"] == (field_name,)


def test_automation_rule_update_preserves_omitted_fields() -> None:
    payload = AutomationRuleUpdateRequest()

    assert payload.model_dump(exclude_unset=True) == {}


def test_automation_rule_update_json_schema_advertises_omission_without_null_for_required_values() -> None:
    schema = AutomationRuleUpdateRequest.model_json_schema()
    expected_types = {
        "name": "string",
        "priority": "integer",
        "is_enabled": "boolean",
        "mode": "string",
        "applies_to": "string",
        "product_ids": "array",
        "category_ids": "array",
        "include_keywords": "array",
        "exclude_keywords": "array",
        "sensitive_topics": "array",
        "require_manual_review_on_flags": "boolean",
        "stop_on_missing_product_context": "boolean",
        "stop_on_low_confidence": "boolean",
        "confidence_threshold": "number",
    }
    for field_name, expected_type in expected_types.items():
        assert schema["properties"][field_name].get("type") == expected_type
        assert field_name not in schema.get("required", [])

    for field_name in ("marketplace_account_id", "marketplace", "min_rating", "max_rating", "daily_limit", "hourly_limit"):
        assert {"type": "null"} in schema["properties"][field_name]["anyOf"]


def test_automation_rule_update_allows_clearing_nullable_filters() -> None:
    changes = {
        "marketplace_account_id": None,
        "marketplace": None,
        "min_rating": None,
        "max_rating": None,
        "daily_limit": None,
        "hourly_limit": None,
    }
    payload = AutomationRuleUpdateRequest.model_validate(changes)

    assert payload.model_dump(exclude_unset=True) == changes


def test_automation_rule_update_accepts_empty_lists_false_flags_and_zero_values() -> None:
    changes: dict[str, object] = {
        "priority": 0,
        "is_enabled": False,
        "product_ids": [],
        "category_ids": [],
        "include_keywords": [],
        "exclude_keywords": [],
        "sensitive_topics": [],
        "require_manual_review_on_flags": False,
        "stop_on_missing_product_context": False,
        "stop_on_low_confidence": False,
        "confidence_threshold": 0.0,
    }
    payload = AutomationRuleUpdateRequest.model_validate(changes)

    assert payload.model_dump(exclude_unset=True) == changes


@pytest.mark.parametrize("name", ["  ", " \t\n ", " x "])
def test_automation_rule_create_rejects_names_too_short_after_trimming(name: str) -> None:
    with pytest.raises(ValidationError):
        AutomationRuleCreateRequest(
            organization_id=UUID("00000000-0000-0000-0000-000000000001"),
            name=name,
        )


@pytest.mark.parametrize("name", ["  ", " \t\n ", " x "])
def test_automation_rule_update_rejects_names_too_short_after_trimming(name: str) -> None:
    with pytest.raises(ValidationError):
        AutomationRuleUpdateRequest(name=name)


def test_automation_rule_create_trims_name_before_validation() -> None:
    payload = AutomationRuleCreateRequest(
        organization_id=UUID("00000000-0000-0000-0000-000000000001"),
        name=" \tKeyword rule\n ",
    )

    assert payload.name == "Keyword rule"


def test_automation_rule_update_trims_name_before_validation() -> None:
    payload = AutomationRuleUpdateRequest(name=" \tKeyword rule\n ")

    assert payload.model_dump(exclude_unset=True) == {"name": "Keyword rule"}
