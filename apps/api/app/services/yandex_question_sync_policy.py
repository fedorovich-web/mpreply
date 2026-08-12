from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from typing import cast

YANDEX_QUESTION_BACKFILL_SCHEMA_VERSION = 1
YANDEX_QUESTION_BACKFILL_MONTHS = 12
YANDEX_QUESTION_WINDOW_DAYS = 28
YANDEX_QUESTION_WINDOW_OVERLAP_DAYS = 1
YANDEX_QUESTION_WINDOW_PAGE_LIMIT = 100
_METADATA_KEY = "yandex_question_backfill"


@dataclass(frozen=True)
class YandexQuestionWindow:
    start: date
    end: date


@dataclass(frozen=True)
class YandexQuestionBackfillCheckpoint:
    schema_version: int
    horizon_start: date
    horizon_end: date
    window: YandexQuestionWindow
    page_token: str | None = None
    seen_page_tokens: tuple[str, ...] = ()
    page_count: int = 0
    completed: bool = False


def _twelve_months_before(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def initialize_yandex_question_backfill(now: datetime) -> YandexQuestionBackfillCheckpoint:
    current = now.astimezone(UTC).date()
    horizon_start = _twelve_months_before(current)
    window_start = max(
        horizon_start,
        current - timedelta(days=YANDEX_QUESTION_WINDOW_DAYS - 1),
    )
    return YandexQuestionBackfillCheckpoint(
        schema_version=YANDEX_QUESTION_BACKFILL_SCHEMA_VERSION,
        horizon_start=horizon_start,
        horizon_end=current,
        window=YandexQuestionWindow(start=window_start, end=current),
    )


def advance_yandex_question_window(
    checkpoint: YandexQuestionBackfillCheckpoint,
) -> YandexQuestionBackfillCheckpoint:
    if checkpoint.completed:
        return checkpoint
    if checkpoint.window.start <= checkpoint.horizon_start:
        return replace(
            checkpoint,
            page_token=None,
            seen_page_tokens=(),
            page_count=0,
            completed=True,
        )

    next_end = checkpoint.window.start
    next_start = max(
        checkpoint.horizon_start,
        next_end - timedelta(days=YANDEX_QUESTION_WINDOW_DAYS - 1),
    )
    return replace(
        checkpoint,
        window=YandexQuestionWindow(start=next_start, end=next_end),
        page_token=None,
        seen_page_tokens=(),
        page_count=0,
    )


def record_yandex_question_page(
    checkpoint: YandexQuestionBackfillCheckpoint,
    next_token: str | None,
) -> YandexQuestionBackfillCheckpoint:
    next_page_count = checkpoint.page_count + 1
    if next_page_count > YANDEX_QUESTION_WINDOW_PAGE_LIMIT:
        raise ValueError("Yandex question window page limit exceeded")
    if next_token is not None and next_token in checkpoint.seen_page_tokens:
        raise ValueError("Yandex question page token repeated")
    seen_page_tokens = checkpoint.seen_page_tokens
    if next_token is not None:
        seen_page_tokens = (*seen_page_tokens, next_token)
    return replace(
        checkpoint,
        page_token=next_token,
        seen_page_tokens=seen_page_tokens,
        page_count=next_page_count,
    )


def store_yandex_question_backfill(
    metadata: dict[str, object],
    checkpoint: YandexQuestionBackfillCheckpoint,
) -> dict[str, object]:
    updated = dict(metadata)
    updated[_METADATA_KEY] = {
        "schema_version": checkpoint.schema_version,
        "horizon_start": checkpoint.horizon_start.isoformat(),
        "horizon_end": checkpoint.horizon_end.isoformat(),
        "window_start": checkpoint.window.start.isoformat(),
        "window_end": checkpoint.window.end.isoformat(),
        "page_token": checkpoint.page_token,
        "seen_page_tokens": list(checkpoint.seen_page_tokens),
        "page_count": checkpoint.page_count,
        "completed": checkpoint.completed,
    }
    return updated


def load_yandex_question_backfill(
    metadata: dict[str, object],
) -> YandexQuestionBackfillCheckpoint | None:
    raw = metadata.get(_METADATA_KEY)
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError("Invalid Yandex question backfill checkpoint")
    try:
        data = cast(dict[str, object], raw)
        schema_version = data["schema_version"]
        horizon_start = date.fromisoformat(cast(str, data["horizon_start"]))
        horizon_end = date.fromisoformat(cast(str, data["horizon_end"]))
        window_start = date.fromisoformat(cast(str, data["window_start"]))
        window_end = date.fromisoformat(cast(str, data["window_end"]))
        page_token_raw = data.get("page_token")
        page_token = page_token_raw if isinstance(page_token_raw, str) else None
        seen_raw = data.get("seen_page_tokens", [])
        if not isinstance(seen_raw, list):
            raise ValueError
        seen_values = cast(list[object], seen_raw)
        if not all(isinstance(item, str) for item in seen_values):
            raise ValueError
        page_count_raw = data.get("page_count", 0)
        completed_raw = data.get("completed", False)
        if not isinstance(schema_version, int):
            raise ValueError
        if schema_version != YANDEX_QUESTION_BACKFILL_SCHEMA_VERSION:
            raise ValueError
        if not isinstance(page_count_raw, int) or page_count_raw < 0:
            raise ValueError
        if page_count_raw > YANDEX_QUESTION_WINDOW_PAGE_LIMIT:
            raise ValueError
        if not isinstance(completed_raw, bool):
            raise ValueError
        if not (horizon_start <= window_start <= window_end <= horizon_end):
            raise ValueError
        return YandexQuestionBackfillCheckpoint(
            schema_version=schema_version,
            horizon_start=horizon_start,
            horizon_end=horizon_end,
            window=YandexQuestionWindow(start=window_start, end=window_end),
            page_token=page_token,
            seen_page_tokens=tuple(item for item in seen_values if isinstance(item, str)),
            page_count=page_count_raw,
            completed=completed_raw,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid Yandex question backfill checkpoint") from exc
