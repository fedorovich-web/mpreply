from datetime import UTC, datetime

import pytest

from app.services.yandex_question_sync_policy import (
    YANDEX_QUESTION_WINDOW_PAGE_LIMIT,
    YandexQuestionBackfillCheckpoint,
    advance_yandex_question_window,
    initialize_yandex_question_backfill,
    load_yandex_question_backfill,
    record_yandex_question_page,
    store_yandex_question_backfill,
)


def test_initial_backfill_freezes_horizon_and_starts_with_newest_28_day_window() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )

    assert checkpoint.horizon_end.isoformat() == "2026-08-12"
    assert checkpoint.horizon_start.isoformat() == "2025-08-12"
    assert checkpoint.window.end.isoformat() == "2026-08-12"
    assert checkpoint.window.start.isoformat() == "2026-07-16"
    assert checkpoint.completed is False
    assert checkpoint.page_token is None
    assert checkpoint.seen_page_tokens == ()
    assert checkpoint.page_count == 0


def test_initial_backfill_uses_calendar_year_for_leap_day() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2028, 2, 29, 12, 0, tzinfo=UTC)
    )

    assert checkpoint.horizon_end.isoformat() == "2028-02-29"
    assert checkpoint.horizon_start.isoformat() == "2027-02-28"


def test_advance_moves_newest_to_oldest_with_exactly_one_overlapping_day() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )

    next_checkpoint = advance_yandex_question_window(checkpoint)

    assert next_checkpoint.window.end.isoformat() == "2026-07-16"
    assert next_checkpoint.window.start.isoformat() == "2026-06-19"
    assert next_checkpoint.page_token is None
    assert next_checkpoint.seen_page_tokens == ()
    assert next_checkpoint.page_count == 0


def test_advance_marks_completed_after_oldest_window() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    while checkpoint.window.start > checkpoint.horizon_start:
        checkpoint = advance_yandex_question_window(checkpoint)

    completed = advance_yandex_question_window(checkpoint)

    assert completed.completed is True
    assert completed.window.start == checkpoint.horizon_start
    assert completed.page_token is None
    assert completed.seen_page_tokens == ()
    assert completed.page_count == 0


def test_metadata_round_trip_preserves_frozen_horizon_and_cursor_state() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = record_yandex_question_page(checkpoint, "token-2")

    stored = store_yandex_question_backfill({"other": "keep"}, checkpoint)
    loaded = load_yandex_question_backfill(stored)

    assert loaded == checkpoint
    assert stored["other"] == "keep"


def test_repeated_page_token_fails_closed() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = record_yandex_question_page(checkpoint, "token-2")

    with pytest.raises(ValueError, match="page token repeated"):
        record_yandex_question_page(checkpoint, "token-2")


def test_page_limit_fails_closed() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = YandexQuestionBackfillCheckpoint(
        schema_version=checkpoint.schema_version,
        horizon_start=checkpoint.horizon_start,
        horizon_end=checkpoint.horizon_end,
        window=checkpoint.window,
        page_token="token-100",
        seen_page_tokens=tuple(
            f"token-{index}" for index in range(1, YANDEX_QUESTION_WINDOW_PAGE_LIMIT + 1)
        ),
        page_count=YANDEX_QUESTION_WINDOW_PAGE_LIMIT,
        completed=False,
    )

    with pytest.raises(ValueError, match="page limit exceeded"):
        record_yandex_question_page(checkpoint, "token-101")


def test_invalid_checkpoint_metadata_raises_instead_of_restarting() -> None:
    with pytest.raises(ValueError, match="Invalid Yandex question backfill checkpoint"):
        load_yandex_question_backfill(
            {"yandex_question_backfill": {"schema_version": 1, "window_start": "bad"}}
        )


def test_missing_checkpoint_returns_none() -> None:
    assert load_yandex_question_backfill({"other": "value"}) is None
