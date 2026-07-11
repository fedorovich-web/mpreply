from datetime import UTC, datetime

from app.schemas.analytics import AnalyticsOverviewResponse, AnalyticsPeriod


def test_analytics_overview_schema_accepts_zero_state() -> None:
    now = datetime.now(UTC)
    overview = AnalyticsOverviewResponse(
        period=AnalyticsPeriod(start=now, end=now, days=30),
        total_messages=0,
        new_messages=0,
        unanswered_messages=0,
        answered_messages=0,
        negative_reviews=0,
        replies_sent=0,
        auto_replies_sent=0,
        manual_replies_sent=0,
        ai_drafts_generated=0,
        average_response_seconds=None,
        ai_acceptance_rate=None,
    )
    assert overview.total_messages == 0
    assert overview.ai_acceptance_rate is None
