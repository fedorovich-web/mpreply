from __future__ import annotations

from datetime import UTC, date, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import cast

import pytest

from app.adapters.base import AdapterResult
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService, ScheduledPageFetch
from app.services.yandex_question_sync_policy import (
    YANDEX_QUESTION_WINDOW_PAGE_LIMIT,
    YandexQuestionBackfillCheckpoint,
    advance_yandex_question_window,
    initialize_yandex_question_backfill,
    record_yandex_question_page,
    store_yandex_question_backfill,
)

API_ROOT = Path(__file__).resolve().parents[2]


class _RecordingYandexScheduledAdapter(YandexMarketAdapter):
    def __init__(self) -> None:
        self.window_calls: list[tuple[date, date, str | None, str | None]] = []
        self.incremental_calls: list[tuple[str | None, str | None]] = []

    async def fetch_questions_window(
        self,
        credential: str,
        *,
        date_from: date,
        date_to: date,
        cursor: str | None = None,
        seller_id: str | None = None,
    ) -> AdapterResult:
        del credential
        self.window_calls.append((date_from, date_to, cursor, seller_id))
        return AdapterResult(ok=True, next_cursor="p2")

    async def fetch_questions(
        self,
        credential: str,
        cursor: str | None = None,
        seller_id: str | None = None,
    ) -> AdapterResult:
        del credential
        self.incremental_calls.append((cursor, seller_id))
        return AdapterResult(ok=True)


class _ScheduledBackfillHarness(ScheduledMarketplaceSyncService):
    async def fetch_scheduled_page(
        self,
        *,
        adapter: YandexMarketAdapter,
        account: MarketplaceAccount,
        state: MarketplaceSyncState,
        credential: str,
        now: datetime,
    ) -> ScheduledPageFetch:
        return await self._fetch_scheduled_page(
            adapter=adapter,
            account=account,
            state=state,
            credential=credential,
            now=now,
        )

    def prepare_yandex_backfill_progress(
        self,
        *,
        checkpoint: YandexQuestionBackfillCheckpoint,
        next_cursor: str | None,
    ) -> tuple[YandexQuestionBackfillCheckpoint | None, AdapterResult | None]:
        return self._prepare_yandex_backfill_progress(
            checkpoint=checkpoint,
            next_cursor=next_cursor,
        )


def _state(
    *, metadata: dict[str, object] | None = None, cursor: str | None = None
) -> MarketplaceSyncState:
    return cast(
        MarketplaceSyncState,
        SimpleNamespace(
            stream="questions",
            cursor=cursor,
            metadata_json=metadata or {},
        ),
    )


def _account() -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(marketplace="yandex_market", seller_id="99"),
    )


def _completed_checkpoint() -> YandexQuestionBackfillCheckpoint:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    while not checkpoint.completed:
        checkpoint = advance_yandex_question_window(checkpoint)
    return checkpoint


@pytest.mark.asyncio
async def test_scheduled_yandex_questions_initialize_frozen_backfill_window() -> None:
    service = object.__new__(_ScheduledBackfillHarness)
    adapter = _RecordingYandexScheduledAdapter()
    state = _state(cursor="legacy-cursor")

    page = await service.fetch_scheduled_page(
        adapter=adapter,
        account=_account(),
        state=state,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert page.phase == "backfill"
    assert adapter.window_calls == [
        (date(2026, 7, 16), date(2026, 8, 12), None, "99")
    ]
    assert adapter.incremental_calls == []
    metadata = cast(dict[str, object], state.metadata_json["yandex_question_backfill"])
    assert metadata["horizon_start"] == "2025-08-12"
    assert metadata["horizon_end"] == "2026-08-12"


@pytest.mark.asyncio
async def test_scheduled_yandex_questions_resume_frozen_window_at_later_wall_clock() -> None:
    service = object.__new__(_ScheduledBackfillHarness)
    adapter = _RecordingYandexScheduledAdapter()
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = record_yandex_question_page(checkpoint, "p2")
    state = _state(metadata=store_yandex_question_backfill({}, checkpoint))

    page = await service.fetch_scheduled_page(
        adapter=adapter,
        account=_account(),
        state=state,
        credential="key",
        now=datetime(2026, 9, 1, 7, 0, tzinfo=UTC),
    )

    assert page.phase == "backfill"
    assert adapter.window_calls == [
        (date(2026, 7, 16), date(2026, 8, 12), "p2", "99")
    ]


@pytest.mark.asyncio
async def test_scheduled_yandex_questions_switch_to_incremental_after_backfill() -> None:
    service = object.__new__(_ScheduledBackfillHarness)
    adapter = _RecordingYandexScheduledAdapter()
    state = _state(
        metadata=store_yandex_question_backfill({}, _completed_checkpoint()),
        cursor="incremental-p2",
    )

    page = await service.fetch_scheduled_page(
        adapter=adapter,
        account=_account(),
        state=state,
        credential="key",
        now=datetime(2026, 9, 1, 7, 0, tzinfo=UTC),
    )

    assert page.phase == "incremental"
    assert adapter.window_calls == []
    assert adapter.incremental_calls == [("incremental-p2", "99")]


@pytest.mark.asyncio
async def test_malformed_yandex_backfill_checkpoint_fails_before_network() -> None:
    service = object.__new__(_ScheduledBackfillHarness)
    adapter = _RecordingYandexScheduledAdapter()
    state = _state(
        metadata={
            "yandex_question_backfill": {
                "schema_version": 1,
                "window_start": "bad",
            }
        }
    )

    page = await service.fetch_scheduled_page(
        adapter=adapter,
        account=_account(),
        state=state,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert page.result.ok is False
    assert page.result.error_code == "yandex_backfill_checkpoint_invalid"
    assert adapter.window_calls == []
    assert adapter.incremental_calls == []


@pytest.mark.asyncio
async def test_initial_checkpoint_is_persisted_before_first_provider_failure() -> None:
    class _FailingAdapter(_RecordingYandexScheduledAdapter):
        async def fetch_questions_window(
            self,
            credential: str,
            *,
            date_from: date,
            date_to: date,
            cursor: str | None = None,
            seller_id: str | None = None,
        ) -> AdapterResult:
            del credential
            self.window_calls.append((date_from, date_to, cursor, seller_id))
            return AdapterResult(ok=False, error_code="network_timeout")

    service = object.__new__(_ScheduledBackfillHarness)
    adapter = _FailingAdapter()
    state = _state()

    page = await service.fetch_scheduled_page(
        adapter=adapter,
        account=_account(),
        state=state,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert page.result.ok is False
    metadata = cast(dict[str, object], state.metadata_json["yandex_question_backfill"])
    assert metadata["horizon_start"] == "2025-08-12"
    assert metadata["horizon_end"] == "2026-08-12"


def test_yandex_backfill_repeated_token_maps_to_fail_closed_cursor_error() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = record_yandex_question_page(checkpoint, "p2")

    service = object.__new__(_ScheduledBackfillHarness)
    next_checkpoint, failure = service.prepare_yandex_backfill_progress(
        checkpoint=checkpoint,
        next_cursor="p2",
    )

    assert next_checkpoint is None
    assert failure is not None
    assert failure.error_code == "sync_cursor_cycle"


def test_yandex_backfill_page_cap_maps_to_fail_closed_limit_error() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    capped = YandexQuestionBackfillCheckpoint(
        schema_version=checkpoint.schema_version,
        horizon_start=checkpoint.horizon_start,
        horizon_end=checkpoint.horizon_end,
        window=checkpoint.window,
        page_token="p100",
        seen_page_tokens=tuple(
            f"p{index}" for index in range(YANDEX_QUESTION_WINDOW_PAGE_LIMIT)
        ),
        page_count=YANDEX_QUESTION_WINDOW_PAGE_LIMIT,
        completed=False,
    )

    service = object.__new__(_ScheduledBackfillHarness)
    next_checkpoint, failure = service.prepare_yandex_backfill_progress(
        checkpoint=capped,
        next_cursor="p101",
    )

    assert next_checkpoint is None
    assert failure is not None
    assert failure.error_code == "sync_page_limit_exceeded"


def test_yandex_backfill_final_page_advances_to_older_window() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )

    service = object.__new__(_ScheduledBackfillHarness)
    next_checkpoint, failure = service.prepare_yandex_backfill_progress(
        checkpoint=checkpoint,
        next_cursor=None,
    )

    assert failure is None
    assert next_checkpoint is not None
    assert next_checkpoint.window.start == date(2026, 6, 19)
    assert next_checkpoint.window.end == date(2026, 7, 16)
    assert next_checkpoint.page_token is None


def test_backfill_pagination_is_validated_before_ingest() -> None:
    source = (API_ROOT / "app" / "services" / "scheduled_sync_service.py").read_text(
        encoding="utf-8"
    )

    validation = source.index(
        "historical_next_checkpoint, pagination_failure = self._prepare_yandex_backfill_progress"
    )
    ingest = source.index("for raw in self._extract")

    assert validation < ingest
