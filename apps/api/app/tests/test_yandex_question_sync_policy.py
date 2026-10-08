from __future__ import annotations

from datetime import date

import pytest

from app.services.yandex_question_policy import (
    METADATA_KEY,
    advance_window,
    initial_checkpoint,
    load_checkpoint,
    record_page,
    store_checkpoint,
)


def test_yandex_windows_move_newest_to_oldest_with_one_day_overlap() -> None:
    checkpoint = initial_checkpoint(date(2026, 9, 12))
    assert (checkpoint.date_from, checkpoint.date_to) == (
        date(2026, 8, 16),
        date(2026, 9, 12),
    )

    next_window = advance_window(record_page(checkpoint, None))

    assert next_window.date_to == date(2026, 8, 16)
    assert next_window.date_from == date(2026, 7, 20)
    assert next_window.horizon_start == date(2025, 9, 12)
    assert next_window.horizon_end == date(2026, 9, 12)


def test_yandex_page_token_round_trip_freezes_horizon_across_restarts() -> None:
    first = record_page(initial_checkpoint(date(2026, 9, 12)), "next-page")
    metadata = store_checkpoint({"keep": "value"}, first)

    restored = load_checkpoint(metadata, date(2026, 10, 20))

    assert restored == first
    assert metadata["keep"] == "value"


def test_yandex_backfill_completes_at_exact_twelve_month_boundary() -> None:
    checkpoint = initial_checkpoint(date(2026, 2, 28))
    while checkpoint.date_from != checkpoint.horizon_start:
        checkpoint = advance_window(record_page(checkpoint, None))
    completed = advance_window(record_page(checkpoint, None))

    assert completed.completed is True
    assert completed.horizon_start == date(2025, 2, 28)
    assert completed.page_token is None


@pytest.mark.parametrize(
    "metadata",
    [
        {METADATA_KEY: "invalid"},
        {METADATA_KEY: {}},
        {
            METADATA_KEY: {
                "schema_version": 1,
                "horizon_start": "2025-09-12",
                "horizon_end": "2026-09-12",
                "date_from": "2026-08-16",
                "date_to": "2026-09-12",
                "page_token": " repeated ",
                "seen_page_tokens": [],
                "page_count": 0,
                "completed": False,
            }
        },
    ],
)
def test_yandex_rejects_malformed_persisted_checkpoint(metadata: dict[str, object]) -> None:
    with pytest.raises(ValueError, match="checkpoint"):
        load_checkpoint(metadata, date(2026, 9, 12))


def test_yandex_rejects_repeated_page_token() -> None:
    checkpoint = record_page(initial_checkpoint(date(2026, 9, 12)), "next-page")

    with pytest.raises(ValueError, match="repeated"):
        record_page(checkpoint, "next-page")
