from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import cast

SCHEMA_VERSION = 1
WINDOW_DAYS = 28
WINDOW_OVERLAP_DAYS = 1
MAX_PAGES_PER_WINDOW = 100
MAX_PAGE_TOKEN_LENGTH = 2_048
METADATA_KEY = "yandex_question_backfill"


@dataclass(frozen=True, slots=True)
class YandexQuestionCheckpoint:
    schema_version: int
    horizon_start: date
    horizon_end: date
    date_from: date
    date_to: date
    page_token: str | None = None
    seen_page_tokens: tuple[str, ...] = ()
    page_count: int = 0
    completed: bool = False


def initial_checkpoint(current_date: date) -> YandexQuestionCheckpoint:
    horizon_start = _one_year_before(current_date)
    date_from = max(
        horizon_start,
        current_date - timedelta(days=WINDOW_DAYS - WINDOW_OVERLAP_DAYS),
    )
    return YandexQuestionCheckpoint(
        schema_version=SCHEMA_VERSION,
        horizon_start=horizon_start,
        horizon_end=current_date,
        date_from=date_from,
        date_to=current_date,
    )


def record_page(
    checkpoint: YandexQuestionCheckpoint,
    next_page_token: str | None,
) -> YandexQuestionCheckpoint:
    _validate_checkpoint(checkpoint)
    if checkpoint.completed:
        raise ValueError("completed Yandex question backfill cannot record another page")
    page_count = checkpoint.page_count + 1
    if page_count > MAX_PAGES_PER_WINDOW:
        raise ValueError("Yandex question backfill window exceeded the safe page limit")
    if next_page_token is not None:
        _validate_page_token(next_page_token)
        if next_page_token == checkpoint.page_token or next_page_token in checkpoint.seen_page_tokens:
            raise ValueError("Yandex question backfill page token repeated")
        seen = (*checkpoint.seen_page_tokens, next_page_token)
    else:
        seen = checkpoint.seen_page_tokens
    return replace(
        checkpoint,
        page_token=next_page_token,
        seen_page_tokens=seen,
        page_count=page_count,
    )


def advance_window(checkpoint: YandexQuestionCheckpoint) -> YandexQuestionCheckpoint:
    _validate_checkpoint(checkpoint)
    if checkpoint.completed:
        return checkpoint
    if checkpoint.page_token is not None:
        raise ValueError("Yandex question backfill window still has another page")
    if checkpoint.date_from == checkpoint.horizon_start:
        return replace(
            checkpoint,
            page_token=None,
            seen_page_tokens=(),
            page_count=0,
            completed=True,
        )
    next_date_to = checkpoint.date_from
    next_date_from = max(
        checkpoint.horizon_start,
        next_date_to - timedelta(days=WINDOW_DAYS - WINDOW_OVERLAP_DAYS),
    )
    return replace(
        checkpoint,
        date_from=next_date_from,
        date_to=next_date_to,
        page_token=None,
        seen_page_tokens=(),
        page_count=0,
    )


def load_checkpoint(metadata: dict[str, object], current_date: date) -> YandexQuestionCheckpoint:
    raw = metadata.get(METADATA_KEY)
    if raw is None:
        return initial_checkpoint(current_date)
    if not isinstance(raw, dict):
        raise ValueError("Yandex question backfill checkpoint is invalid")
    data = cast(dict[str, object], raw)
    try:
        schema_version = _integer(data["schema_version"])
        horizon_start = _date(data["horizon_start"])
        horizon_end = _date(data["horizon_end"])
        date_from = _date(data["date_from"])
        date_to = _date(data["date_to"])
        page_token = _optional_page_token(data.get("page_token"))
        seen_page_tokens = _page_tokens(data.get("seen_page_tokens"))
        page_count = _integer(data["page_count"])
        completed = data["completed"]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Yandex question backfill checkpoint is invalid") from exc
    if type(completed) is not bool:
        raise ValueError("Yandex question backfill checkpoint is invalid")
    checkpoint = YandexQuestionCheckpoint(
        schema_version=schema_version,
        horizon_start=horizon_start,
        horizon_end=horizon_end,
        date_from=date_from,
        date_to=date_to,
        page_token=page_token,
        seen_page_tokens=seen_page_tokens,
        page_count=page_count,
        completed=completed,
    )
    _validate_checkpoint(checkpoint)
    return checkpoint


def store_checkpoint(
    metadata: dict[str, object],
    checkpoint: YandexQuestionCheckpoint,
) -> dict[str, object]:
    _validate_checkpoint(checkpoint)
    return {
        **metadata,
        METADATA_KEY: {
            "schema_version": checkpoint.schema_version,
            "horizon_start": checkpoint.horizon_start.isoformat(),
            "horizon_end": checkpoint.horizon_end.isoformat(),
            "date_from": checkpoint.date_from.isoformat(),
            "date_to": checkpoint.date_to.isoformat(),
            "page_token": checkpoint.page_token,
            "seen_page_tokens": list(checkpoint.seen_page_tokens),
            "page_count": checkpoint.page_count,
            "completed": checkpoint.completed,
        },
    }


def _validate_checkpoint(checkpoint: YandexQuestionCheckpoint) -> None:
    if checkpoint.schema_version != SCHEMA_VERSION:
        raise ValueError("Yandex question backfill schema version is unsupported")
    if checkpoint.horizon_start != _one_year_before(checkpoint.horizon_end):
        raise ValueError("Yandex question backfill horizon is invalid")
    if not checkpoint.horizon_start <= checkpoint.date_from <= checkpoint.date_to <= checkpoint.horizon_end:
        raise ValueError("Yandex question backfill window is invalid")
    if (checkpoint.date_to - checkpoint.date_from).days > WINDOW_DAYS - WINDOW_OVERLAP_DAYS:
        raise ValueError("Yandex question backfill window is too wide")
    if not 0 <= checkpoint.page_count <= MAX_PAGES_PER_WINDOW:
        raise ValueError("Yandex question backfill page count is invalid")
    if checkpoint.page_token is not None:
        _validate_page_token(checkpoint.page_token)
    if len(checkpoint.seen_page_tokens) > MAX_PAGES_PER_WINDOW:
        raise ValueError("Yandex question backfill token history is too large")
    if len(set(checkpoint.seen_page_tokens)) != len(checkpoint.seen_page_tokens):
        raise ValueError("Yandex question backfill token history contains duplicates")
    if len(checkpoint.seen_page_tokens) > checkpoint.page_count:
        raise ValueError("Yandex question backfill token history is inconsistent")
    if checkpoint.page_token is not None and (not checkpoint.seen_page_tokens or checkpoint.seen_page_tokens[-1] != checkpoint.page_token):
        raise ValueError("Yandex question backfill current token is inconsistent")
    for token in checkpoint.seen_page_tokens:
        _validate_page_token(token)
    if checkpoint.completed and (
        checkpoint.date_from != checkpoint.horizon_start or checkpoint.page_token is not None or checkpoint.page_count != 0 or checkpoint.seen_page_tokens
    ):
        raise ValueError("completed Yandex question backfill checkpoint is inconsistent")


def _one_year_before(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def _date(value: object) -> date:
    if not isinstance(value, str):
        raise ValueError
    return date.fromisoformat(value)


def _integer(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError
    return value


def _optional_page_token(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError
    _validate_page_token(value)
    return value


def _page_tokens(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise ValueError
    raw = cast(list[object], value)
    if not all(isinstance(token, str) for token in raw):
        raise ValueError
    return tuple(cast(str, token) for token in raw)


def _validate_page_token(value: str) -> None:
    if not value or value != value.strip() or len(value) > MAX_PAGE_TOKEN_LENGTH or "\x00" in value:
        raise ValueError("Yandex question backfill page token is invalid")
