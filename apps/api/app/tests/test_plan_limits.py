from datetime import UTC, datetime

import pytest

from app.services.plan_limit_service import PlanLimitService


def test_limit_value_accepts_missing_or_non_negative_integer() -> None:
    assert PlanLimitService.limit_value({}, "ai_drafts_monthly") is None
    assert PlanLimitService.limit_value({"ai_drafts_monthly": 250}, "ai_drafts_monthly") == 250


@pytest.mark.parametrize("value", [-1, True, "250", 1.5])
def test_limit_value_rejects_invalid_values(value: object) -> None:
    with pytest.raises(ValueError, match="Invalid billing limit"):
        PlanLimitService.limit_value({"ai_drafts_monthly": value}, "ai_drafts_monthly")


def test_month_period_uses_calendar_month_in_utc() -> None:
    start, end = PlanLimitService.month_period(datetime(2026, 12, 31, 23, 59, tzinfo=UTC))
    assert start == datetime(2026, 12, 1, tzinfo=UTC)
    assert end == datetime(2027, 1, 1, tzinfo=UTC)
