from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterResult
from app.adapters.yandex_market import YandexMarketAdapter
from app.models.customer_message import CustomerMessage
from app.models.marketplace_account import MarketplaceAccount
from app.models.marketplace_sync_state import MarketplaceSyncState
from app.services.scheduled_sync_service import ScheduledMarketplaceSyncService, ScheduledPageFetch
from app.services.yandex_question_sync_policy import (
    YandexQuestionBackfillCheckpoint,
    advance_yandex_question_window,
    initialize_yandex_question_backfill,
)

API_ROOT = Path(__file__).resolve().parents[2]


class _Scalars:
    def __init__(self, values: Sequence[object]) -> None:
        self.values = list(values)

    def all(self) -> list[object]:
        return self.values


class _Result:
    def __init__(self, values: Sequence[object]) -> None:
        self.values = list(values)

    def scalars(self) -> _Scalars:
        return _Scalars(self.values)


class _Session:
    def __init__(self, values: Sequence[object]) -> None:
        self.values = list(values)
        self.statements: list[object] = []

    async def execute(self, statement: object) -> _Result:
        self.statements.append(statement)
        return _Result(self.values)


class _Adapter(YandexMarketAdapter):
    def __init__(self, states: dict[str, str]) -> None:
        self.states = states
        self.calls: list[str] = []

    async def reconcile_question_reply(
        self,
        credential: str,
        external_id: str,
        seller_id: str | None = None,
    ) -> AdapterResult:
        del credential, seller_id
        self.calls.append(external_id)
        state = self.states.get(external_id, "ABSENT")
        return AdapterResult(
            ok=True,
            data={
                "state": state,
                "answer_id": f"answer-{external_id}" if state == "PUBLISHED" else None,
            },
        )


class _BackgroundReconciliationHarness(ScheduledMarketplaceSyncService):
    async def reconcile_open_yandex_questions(
        self,
        *,
        account: MarketplaceAccount,
        adapter: YandexMarketAdapter,
        credential: str,
        now: datetime,
    ) -> dict[str, int]:
        return await self._reconcile_open_yandex_questions(
            account=account,
            adapter=adapter,
            credential=credential,
            now=now,
        )

    def should_reconcile_open_yandex_questions(
        self,
        *,
        account: MarketplaceAccount,
        state: MarketplaceSyncState,
        page_fetch: ScheduledPageFetch,
        next_cursor: str | None,
        next_checkpoint: YandexQuestionBackfillCheckpoint | None,
    ) -> bool:
        return self._should_reconcile_open_yandex_questions(
            account=account,
            state=state,
            page_fetch=page_fetch,
            next_cursor=next_cursor,
            next_checkpoint=next_checkpoint,
        )


def _account(account_id: UUID) -> MarketplaceAccount:
    return cast(
        MarketplaceAccount,
        SimpleNamespace(
            id=account_id,
            marketplace="yandex_market",
            seller_id="99",
        ),
    )


def _message(
    external_id: object,
    *,
    account_id: UUID,
    marketplace: str = "yandex_market",
    message_type: str = "question",
    status: str = "needs_reply",
) -> CustomerMessage:
    return cast(
        CustomerMessage,
        SimpleNamespace(
            id=uuid4(),
            marketplace_account_id=account_id,
            marketplace=marketplace,
            type=message_type,
            status=status,
            external_id=str(external_id),
            metadata_json={},
        ),
    )


@pytest.mark.asyncio
async def test_reconciliation_filters_local_open_questions_and_caps_at_25() -> None:
    account_id = uuid4()
    eligible = [_message(index, account_id=account_id) for index in range(30)]
    mixed = [
        _message("wb", account_id=account_id, marketplace="wildberries"),
        _message("review", account_id=account_id, message_type="review"),
        _message("answered", account_id=account_id, status="answered"),
        _message("other-account", account_id=uuid4()),
    ]
    service = object.__new__(_BackgroundReconciliationHarness)
    service.session = cast(AsyncSession, _Session(mixed + eligible))
    adapter = _Adapter({})

    stats = await service.reconcile_open_yandex_questions(
        account=_account(account_id),
        adapter=adapter,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert adapter.calls == [str(index) for index in range(25)]
    assert stats["processed"] == 25
    assert stats["ABSENT"] == 25


@pytest.mark.asyncio
async def test_published_reconciliation_marks_local_open_message_answered() -> None:
    account_id = uuid4()
    message = _message("42", account_id=account_id)
    service = object.__new__(_BackgroundReconciliationHarness)
    service.session = cast(AsyncSession, _Session([message]))
    adapter = _Adapter({"42": "PUBLISHED"})

    stats = await service.reconcile_open_yandex_questions(
        account=_account(account_id),
        adapter=adapter,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert message.status == "answered"
    assert message.metadata_json["yandex_question_reconciliation"] == {
        "state": "PUBLISHED",
        "answer_id": "answer-42",
        "checked_at": "2026-08-12T07:00:00+00:00",
    }
    assert stats["PUBLISHED"] == 1


@pytest.mark.asyncio
async def test_absent_reconciliation_keeps_message_open_and_never_writes() -> None:
    account_id = uuid4()
    message = _message("7", account_id=account_id)
    service = object.__new__(_BackgroundReconciliationHarness)
    service.session = cast(AsyncSession, _Session([message]))
    adapter = _Adapter({"7": "ABSENT"})

    stats = await service.reconcile_open_yandex_questions(
        account=_account(account_id),
        adapter=adapter,
        credential="key",
        now=datetime(2026, 8, 12, 7, 0, tzinfo=UTC),
    )

    assert message.status == "needs_reply"
    assert stats["ABSENT"] == 1
    assert adapter.calls == ["7"]


def test_reconciliation_runs_only_at_full_yandex_question_cycle_boundary() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    incomplete = checkpoint
    completed = checkpoint
    while not completed.completed:
        completed = advance_yandex_question_window(completed)

    account = cast(MarketplaceAccount, SimpleNamespace(marketplace="yandex_market"))
    state = cast(MarketplaceSyncState, SimpleNamespace(stream="questions"))
    backfill = ScheduledPageFetch(
        result=AdapterResult(ok=True),
        phase="backfill",
        checkpoint=checkpoint,
    )
    incremental = ScheduledPageFetch(
        result=AdapterResult(ok=True),
        phase="incremental",
    )

    service = object.__new__(_BackgroundReconciliationHarness)
    assert service.should_reconcile_open_yandex_questions(
        account=account,
        state=state,
        page_fetch=backfill,
        next_cursor=None,
        next_checkpoint=incomplete,
    ) is False
    assert service.should_reconcile_open_yandex_questions(
        account=account,
        state=state,
        page_fetch=backfill,
        next_cursor=None,
        next_checkpoint=completed,
    ) is True
    assert service.should_reconcile_open_yandex_questions(
        account=account,
        state=state,
        page_fetch=incremental,
        next_cursor=None,
        next_checkpoint=None,
    ) is True
    assert service.should_reconcile_open_yandex_questions(
        account=account,
        state=state,
        page_fetch=incremental,
        next_cursor="page-2",
        next_checkpoint=None,
    ) is False


def test_background_reconciliation_helper_is_read_only_toward_provider() -> None:
    source = (API_ROOT / "app" / "services" / "scheduled_sync_service.py").read_text(
        encoding="utf-8"
    )
    helper_start = source.index("async def _reconcile_open_yandex_questions")
    helper_end = source.index("@staticmethod\n    def _phase_metadata", helper_start)
    helper = source[helper_start:helper_end]

    assert "reconcile_question_reply" in helper
    assert "send_question_reply" not in helper
    assert "_send_through_adapter" not in helper
