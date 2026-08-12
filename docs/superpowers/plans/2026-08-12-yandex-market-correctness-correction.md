# Yandex Market Correctness Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Yandex Market unanswered-question sync historically complete for a frozen 12-month horizon and make question replies fail closed unless exact-ID reconciliation positively authorizes a write.

**Architecture:** Keep the existing marketplace-neutral scheduler and persistence model. Add a small pure Yandex question-backfill policy helper for deterministic window/checkpoint transitions, extend the Yandex adapter with bounded-date question fetch and rich answer-state reconciliation, and integrate those policies into the existing scheduled sync and reply execution services. Persist resumable backfill state in `MarketplaceSyncState.metadata_json` and resend ambiguity in `Reply.metadata_json`; add no migration and no Yandex-only daemon.

**Tech Stack:** Python 3.13, FastAPI service layer, SQLAlchemy async ORM, `httpx`, pytest/pytest-asyncio, existing marketplace adapter/scheduler/audit infrastructure.

## Global Constraints

- Work only on `work/0.1.104-yandex-foundation`.
- Baseline before design docs: `07929b8c8662546f01489784d79344e8c48c666e`.
- Target release is `0.1.104`; project version stays `0.1.103` until release closure.
- Do not modify `main` or `develop` directly.
- Do not merge, deploy, tag, force-push, or bump the version in this batch.
- Do not create a new table or Alembic migration.
- Do not create a permanent Yandex-only scheduler/worker.
- Initial history is exactly 12 months, `needAnswer=true`, 28-day windows, one-day overlap, newest-to-oldest.
- `pageToken` is valid only within the current date window and must fail closed on cycles.
- Background reconciliation is limited to local Yandex question messages in `needs_reply`, maximum 25 per cycle.
- Every Yandex question write requires exact-ID read-only reconciliation immediately before write.
- Automatic write is allowed only for confirmed `ABSENT` with no ambiguity marker.
- Required reconciliation states: `ABSENT`, `PUBLISHED`, `UNMODERATED`, `BANNED`, `DELETED`, `UNKNOWN`.
- Protected Question ID `27265525` is read-only forever for this work; Accepted Answer ID is `28149115`.
- Do not repeat completed provider runtime probes unless a new implementation-specific read-only verification is explicitly required.
- Automated tests use synthetic IDs and mocked transports only.
- Never use `npm audit fix --force`.

---

## File Structure

**Create**

- `apps/api/app/services/yandex_question_sync_policy.py` — pure date-window/checkpoint state machine; no DB/network access.
- `apps/api/app/tests/test_yandex_question_sync_policy.py` — deterministic unit tests for horizon/window/checkpoint transitions.
- `apps/api/app/tests/test_yandex_question_reply_safety.py` — focused service-level reply safety and ambiguity tests.

**Modify**

- `apps/api/app/adapters/yandex_market.py` — bounded question-window fetch plus normalized exact-ID answer reconciliation.
- `apps/api/app/tests/test_yandex_market_adapter_contract.py` — adapter request/state mapping RED/GREEN contracts.
- `apps/api/app/services/scheduled_sync_service.py` — consume persisted Yandex backfill policy for question pages and trigger bounded open-question reconciliation after a completed questions cycle.
- `apps/api/app/tests/test_marketplace_scheduler_contract.py` — scheduler integration contracts for metadata/checkpoint behavior and 25-item cap.
- `apps/api/app/services/reply_execution_service.py` — fail-closed pre-write decision and persistent ambiguity marker.
- `apps/api/app/tests/test_yandex_market_service_contract.py` — generic service/adapter boundary contracts where appropriate.
- `apps/api/app/tests/test_marketplace_sync_pagination.py` — keep generic pagination regressions green; add only provider-neutral assertions if an existing helper changes.

No migration file is created.

---

### Task 1: Add pure Yandex question backfill policy

**Files:**
- Create: `apps/api/app/services/yandex_question_sync_policy.py`
- Create: `apps/api/app/tests/test_yandex_question_sync_policy.py`

**Interfaces:**
- Produces:
  - `YANDEX_QUESTION_BACKFILL_SCHEMA_VERSION: int = 1`
  - `YANDEX_QUESTION_BACKFILL_DAYS: int = 365`
  - `YANDEX_QUESTION_WINDOW_DAYS: int = 28`
  - `YANDEX_QUESTION_WINDOW_OVERLAP_DAYS: int = 1`
  - `YandexQuestionWindow(start: date, end: date)`
  - `YandexQuestionBackfillCheckpoint(...)`
  - `initialize_yandex_question_backfill(now: datetime) -> YandexQuestionBackfillCheckpoint`
  - `load_yandex_question_backfill(metadata: dict[str, object]) -> YandexQuestionBackfillCheckpoint | None`
  - `store_yandex_question_backfill(metadata: dict[str, object], checkpoint: YandexQuestionBackfillCheckpoint) -> dict[str, object]`
  - `advance_yandex_question_window(checkpoint: YandexQuestionBackfillCheckpoint) -> YandexQuestionBackfillCheckpoint`
  - `with_yandex_question_page_token(checkpoint: ..., token: str | None) -> ...`
- Consumed by Task 3.

- [ ] **Step 1: Write RED tests for frozen 12-month horizon and newest-first first window**

```python
from datetime import UTC, datetime

from app.services.yandex_question_sync_policy import initialize_yandex_question_backfill


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
```

- [ ] **Step 2: Run the single test and verify RED**

Run from `apps/api`:

```bash
pytest app/tests/test_yandex_question_sync_policy.py::test_initial_backfill_freezes_horizon_and_starts_with_newest_28_day_window -q
```

Expected: import failure because `yandex_question_sync_policy.py` does not exist.

- [ ] **Step 3: Implement immutable checkpoint dataclasses and initialization**

```python
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from typing import cast

YANDEX_QUESTION_BACKFILL_SCHEMA_VERSION = 1
YANDEX_QUESTION_BACKFILL_DAYS = 365
YANDEX_QUESTION_WINDOW_DAYS = 28
YANDEX_QUESTION_WINDOW_OVERLAP_DAYS = 1
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


def initialize_yandex_question_backfill(now: datetime) -> YandexQuestionBackfillCheckpoint:
    current = now.astimezone(UTC).date()
    horizon_start = current - timedelta(days=YANDEX_QUESTION_BACKFILL_DAYS)
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
```

- [ ] **Step 4: Add RED tests for overlap, completion, metadata round-trip, and invalid checkpoint fail-closed**

```python
def test_advance_moves_newest_to_oldest_with_one_day_overlap() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    next_checkpoint = advance_yandex_question_window(checkpoint)

    assert next_checkpoint.window.end.isoformat() == "2026-07-17"
    assert next_checkpoint.window.start.isoformat() == "2026-06-20"
    assert next_checkpoint.page_token is None
    assert next_checkpoint.seen_page_tokens == ()
    assert next_checkpoint.page_count == 0


def test_metadata_round_trip_preserves_frozen_horizon_and_cursor_state() -> None:
    checkpoint = initialize_yandex_question_backfill(
        datetime(2026, 8, 12, 7, 0, tzinfo=UTC)
    )
    checkpoint = with_yandex_question_page_token(checkpoint, "token-2")
    stored = store_yandex_question_backfill({"other": "keep"}, checkpoint)

    loaded = load_yandex_question_backfill(stored)

    assert loaded == checkpoint
    assert stored["other"] == "keep"


def test_invalid_checkpoint_metadata_raises_instead_of_restarting() -> None:
    with pytest.raises(ValueError, match="Invalid Yandex question backfill checkpoint"):
        load_yandex_question_backfill(
            {"yandex_question_backfill": {"schema_version": 1, "window_start": "bad"}}
        )
```

- [ ] **Step 5: Implement transition and serialization functions minimally**

Use ISO `YYYY-MM-DD` strings in metadata. Preserve unrelated metadata keys. `load_*` returns `None` only when `_METADATA_KEY` is absent; malformed existing state raises `ValueError`.

When advancing windows:

```python
next_end = checkpoint.window.start + timedelta(days=YANDEX_QUESTION_WINDOW_OVERLAP_DAYS)
if next_end <= checkpoint.horizon_start:
    return replace(
        checkpoint,
        window=YandexQuestionWindow(checkpoint.horizon_start, checkpoint.horizon_start),
        page_token=None,
        seen_page_tokens=(),
        page_count=0,
        completed=True,
    )
next_start = max(
    checkpoint.horizon_start,
    next_end - timedelta(days=YANDEX_QUESTION_WINDOW_DAYS - 1),
)
```

`with_yandex_question_page_token` must reject a repeated token already present in `seen_page_tokens` with `ValueError("Yandex question page token repeated")`.

- [ ] **Step 6: Run policy tests GREEN**

```bash
pytest app/tests/test_yandex_question_sync_policy.py -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit Task 1**

```bash
git add apps/api/app/services/yandex_question_sync_policy.py apps/api/app/tests/test_yandex_question_sync_policy.py
git commit -m "feat(yandex-market): add question backfill policy"
```

---

### Task 2: Extend Yandex adapter with bounded question fetch and rich reconciliation

**Files:**
- Modify: `apps/api/app/adapters/yandex_market.py`
- Modify: `apps/api/app/tests/test_yandex_market_adapter_contract.py`

**Interfaces:**
- Produces:
  - `YandexQuestionReplyState = Literal["ABSENT", "PUBLISHED", "UNMODERATED", "BANNED", "DELETED", "UNKNOWN"]`
  - `YandexMarketAdapter.fetch_questions_window(credential: str, *, date_from: date, date_to: date, cursor: str | None = None, seller_id: str | None = None) -> AdapterResult`
  - `YandexMarketAdapter.reconcile_question_reply(credential: str, external_id: str, seller_id: str | None = None) -> AdapterResult` with `data={"state": <state>, "answer_id": <str|None>}` on a successfully interpreted read.
- Existing `fetch_questions()` remains the normal incremental `needAnswer=true` path.
- Existing `has_existing_reply()` keeps its generic boolean contract for non-question consumers, but Yandex question reply execution in Task 4 uses `reconcile_question_reply()` directly.

- [ ] **Step 1: Write RED request-contract test for bounded date window**

```python
@pytest.mark.asyncio
async def test_fetch_question_window_sends_explicit_dates_and_scopes_page_token() -> None:
    recorder = RequestRecorder([
        response(200, {"status": "OK", "result": {"questions": [], "paging": {"nextPageToken": "next"}}})
    ])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.fetch_questions_window(
        "key",
        seller_id="88",
        date_from=date(2026, 7, 16),
        date_to=date(2026, 8, 12),
        cursor="page-2",
    )

    assert result.next_cursor == "next"
    request = recorder.requests[0]
    assert request.url.params["pageToken"] == "page-2"
    assert request_json(request) == {
        "needAnswer": True,
        "dateFrom": "2026-07-16",
        "dateTo": "2026-08-12",
    }
```

- [ ] **Step 2: Run RED**

```bash
pytest app/tests/test_yandex_market_adapter_contract.py::test_fetch_question_window_sends_explicit_dates_and_scopes_page_token -q
```

Expected: `AttributeError` for missing `fetch_questions_window`.

- [ ] **Step 3: Implement `fetch_questions_window` without changing incremental fetch behavior**

The method validates `date_from <= date_to`, emits the same `/v1/businesses/{id}/goods-questions` request with `needAnswer=True`, and uses `_with_page_token`.

- [ ] **Step 4: Write RED reconciliation mapping matrix**

```python
@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("answer", "expected"),
    [
        ({"id": 11, "status": "PUBLISHED", "canModify": True, "author": {}}, "PUBLISHED"),
        ({"id": 12, "status": "UNMODERATED", "canModify": True}, "UNMODERATED"),
        ({"id": 13, "status": "BANNED", "canModify": True}, "BANNED"),
        ({"id": 14, "status": "DELETED", "canModify": True}, "DELETED"),
    ],
)
async def test_question_reconciliation_maps_seller_owned_answer_state(answer, expected) -> None:
    recorder = RequestRecorder([
        response(200, {"status": "OK", "result": {"answers": [answer]}})
    ])
    adapter = YandexMarketAdapter(transport=httpx.MockTransport(recorder))

    result = await adapter.reconcile_question_reply("key", "123", seller_id="99")

    assert result.ok is True
    assert result.data == {"state": expected, "answer_id": str(answer["id"])}
```

Also add explicit tests:

```python
async def test_question_reconciliation_accepts_can_modify_without_author_type(): ...
async def test_question_reconciliation_returns_absent_for_valid_empty_answers(): ...
async def test_question_reconciliation_returns_unknown_for_unknown_status(): ...
async def test_question_reconciliation_returns_unknown_for_ambiguous_ownership(): ...
async def test_question_reconciliation_returns_unknown_data_on_timeout(): ...
```

For transport/provider read failures, keep `AdapterResult.ok=False` but callers normalize the effective state to `UNKNOWN`; do not convert network failure into `ok=True`.

- [ ] **Step 5: Implement reconciliation state extraction**

Use seller ownership signals:

```python
seller_owned = item.get("canModify") is True or author_type in {"BUSINESS", "BRAND"}
```

Recognize only the four known non-absent provider states. If a seller-owned answer has an unknown/missing status, return `AdapterResult(ok=True, data={"state": "UNKNOWN", "answer_id": ...})`.

If response structure is valid and contains no seller-owned answers, return `ABSENT`. If ownership evidence conflicts or an answer structure is not safely interpretable, return `UNKNOWN`.

- [ ] **Step 6: Keep `has_existing_reply` backwards-compatible**

For `MessageType.QUESTION`, call `reconcile_question_reply()` and map only `PUBLISHED` to `answered=True`; `ABSENT` maps to `False`; all other normalized states should not claim `answered=False`. Return `data={"answered": None, "state": state}` for ambiguous/non-final states so generic callers cannot interpret them as a safe absence.

- [ ] **Step 7: Run adapter tests GREEN**

```bash
pytest app/tests/test_yandex_market_adapter_contract.py app/tests/test_yandex_market_adapter_normalization.py -q
```

- [ ] **Step 8: Commit Task 2**

```bash
git add apps/api/app/adapters/yandex_market.py apps/api/app/tests/test_yandex_market_adapter_contract.py
git commit -m "fix(yandex-market): add bounded question reads"
```

---

### Task 3: Integrate resumable historical backfill into existing scheduled question sync

**Files:**
- Modify: `apps/api/app/services/scheduled_sync_service.py`
- Modify: `apps/api/app/tests/test_marketplace_scheduler_contract.py`
- Modify: `apps/api/app/tests/test_marketplace_sync_pagination.py` only if a generic helper signature changes.

**Interfaces:**
- Consumes Task 1 checkpoint API and Task 2 `fetch_questions_window()`.
- Produces private scheduled-sync helpers:
  - `_fetch_yandex_question_page(...) -> tuple[AdapterResult, YandexQuestionBackfillCheckpoint, str]` where phase is `"backfill" | "incremental"`;
  - `_apply_yandex_question_page_success(...)` to persist the next checkpoint deterministically.

- [ ] **Step 1: Write RED scheduler contract for first historical page**

Build a Yandex account + questions `MarketplaceSyncState` with empty `metadata_json`, fake adapter, fixed `now`, and assert the first call uses explicit date window rather than `fetch_questions()`.

Expected assertions:

```python
assert fake_adapter.window_calls == [
    (date(2026, 7, 16), date(2026, 8, 12), None)
]
assert state.metadata_json["yandex_question_backfill"]["horizon_end"] == "2026-08-12"
```

- [ ] **Step 2: Run RED**

```bash
pytest app/tests/test_marketplace_scheduler_contract.py -k yandex_question_backfill -q
```

Expected: no historical-window scheduling behavior exists.

- [ ] **Step 3: Implement Yandex question special-case inside existing scheduled stream execution**

Do not fork the scheduler service. In the question fetch path only when `account.marketplace == Marketplace.YANDEX_MARKET.value`:

1. load checkpoint from `state.metadata_json`;
2. initialize it if absent;
3. if `completed is False`, call `adapter.fetch_questions_window(...)` using checkpoint dates/token;
4. if `completed is True`, call existing incremental `adapter.fetch_questions(...)`.

A malformed existing checkpoint raises a safe sync failure code such as `yandex_backfill_checkpoint_invalid`; it must not silently reinitialize.

- [ ] **Step 4: Write RED tests for same-window pagination and window transition**

Cases:

1. provider returns `nextPageToken="p2"` => persist token and schedule next page quickly;
2. final page in current window => advance checkpoint to next older window, clear token, schedule next window quickly;
3. token cycle => fail closed and preserve diagnostics;
4. oldest window final page => mark checkpoint complete; next scheduled questions execution uses incremental fetch;
5. frozen horizon survives execution at a later wall-clock date.

- [ ] **Step 5: Implement checkpoint update semantics**

On a page with `next_cursor`:

```python
checkpoint = with_yandex_question_page_token(checkpoint, next_cursor)
state.metadata_json = store_yandex_question_backfill(state.metadata_json or {}, checkpoint)
state.cursor = None
state.next_run_at = now + timedelta(seconds=1)
```

Do not reuse `MarketplaceSyncState.cursor` for historical Yandex `pageToken`; keep the token inside the versioned metadata checkpoint so it cannot accidentally leak between historical windows and incremental mode.

On a final historical page, advance the window. If the returned checkpoint is completed, schedule the normal interval; otherwise schedule the next window quickly.

- [ ] **Step 6: Preserve generic review/Wildberries behavior**

Run:

```bash
pytest app/tests/test_marketplace_scheduler_contract.py app/tests/test_marketplace_sync_pagination.py -q
```

Expected: existing generic and Wildberries contracts stay GREEN.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/api/app/services/scheduled_sync_service.py apps/api/app/tests/test_marketplace_scheduler_contract.py apps/api/app/tests/test_marketplace_sync_pagination.py
git commit -m "fix(yandex-market): backfill historical questions"
```

---

### Task 4: Make Yandex question pre-write reconciliation fail closed and persist ambiguity

**Files:**
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_yandex_question_reply_safety.py`
- Modify: `apps/api/app/tests/test_yandex_market_service_contract.py` if shared harness helpers are reused.

**Interfaces:**
- Consumes Task 2 `reconcile_question_reply()`.
- Produces:
  - private normalized decision helper returning one of the required Yandex states;
  - reply metadata key `yandex_question_send_ambiguity` containing safe fields only, e.g. `{ "active": true, "reason": "network_timeout", "recorded_at": "..." }`;
  - no automatic resend while that marker is active.

- [ ] **Step 1: Write RED test proving unknown preflight blocks provider send**

Use a `ReplyExecutionService` harness with Yandex question message and adapter returning reconciliation network failure. Assert:

```python
assert adapter.send_calls == []
assert result.retryable is False
assert result.error_code == "yandex_question_reconciliation_unknown"
```

Also assert entitlement reservation is released and local state is not falsely marked sent.

- [ ] **Step 2: Write RED test for `PUBLISHED` convergence without write**

Adapter returns `data={"state": "PUBLISHED", "answer_id": "281"}`. Assert no send occurs and the existing externally-already-answered path marks the local reply/message consistently.

Use only synthetic IDs; never `27265525`.

- [ ] **Step 3: Write RED parameterized blocking test**

```python
@pytest.mark.parametrize("state", ["UNMODERATED", "BANNED", "DELETED", "UNKNOWN"])
async def test_non_absent_non_published_states_block_yandex_question_write(state: str): ...
```

No state in this matrix may call `send_question_reply()`.

- [ ] **Step 4: Write RED tests for ambiguity marker**

Case A: reconciliation `ABSENT`, send returns `network_timeout`; persist `yandex_question_send_ambiguity.active=True`.

Case B: same reply retries later, reconciliation again reports `ABSENT`; provider send remains blocked because ambiguity marker is active.

- [ ] **Step 5: Implement Yandex-question-specific pre-write branch**

Immediately before `_send_through_adapter`, if marketplace is Yandex and message type is question:

1. call exact-ID `reconcile_question_reply()`;
2. normalize read failure to `UNKNOWN`;
3. handle `PUBLISHED` through existing external-answer convergence;
4. block `UNMODERATED/BANNED/DELETED/UNKNOWN`;
5. for `ABSENT`, reject if ambiguity marker is active;
6. only then call provider write.

Do not weaken the existing generic behavior for Wildberries/reviews.

- [ ] **Step 6: Persist ambiguity before scheduling any retry after uncertain Yandex question send**

Treat at minimum `network_timeout` and `network_error` as ambiguous send results for Yandex question writes. Persist the marker before the normal retry decision. Because marker blocks automatic resend, return a non-auto-retry terminal/manual-safe result for that reply rather than scheduling another provider write.

Keep safe operator-readable failure reason and release the entitlement reservation.

- [ ] **Step 7: Run focused safety tests GREEN**

```bash
pytest app/tests/test_yandex_question_reply_safety.py app/tests/test_yandex_market_service_contract.py -q
```

- [ ] **Step 8: Run existing reply execution regression suite**

Discover existing tests that exercise `ReplyExecutionService`, then run them together with the Yandex safety file. All non-Yandex behavior must remain GREEN.

- [ ] **Step 9: Commit Task 4**

```bash
git add apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_yandex_question_reply_safety.py apps/api/app/tests/test_yandex_market_service_contract.py
git commit -m "fix(yandex-market): fail closed before question writes"
```

---

### Task 5: Add bounded background reconciliation for local open Yandex questions

**Files:**
- Modify: `apps/api/app/services/scheduled_sync_service.py`
- Modify: `apps/api/app/tests/test_marketplace_scheduler_contract.py`

**Interfaces:**
- Produces private helper:
  - `_reconcile_open_yandex_questions(account: MarketplaceAccount, adapter: YandexMarketAdapter, credential: str, *, limit: int = 25) -> dict[str, int]`
- Runs only after a completed Yandex questions cycle, not after every historical page.

- [ ] **Step 1: Write RED selection/cap test**

Seed/fake query results with more than 25 messages including non-Yandex, reviews, and non-`needs_reply` statuses. Assert the query/processing selects only:

```text
marketplace_account_id == account.id
marketplace == yandex_market
type == question
status == needs_reply
LIMIT 25
```

Assert at most 25 exact-ID reconciliation calls.

- [ ] **Step 2: Write RED state-convergence test**

For one local `needs_reply` question returning `PUBLISHED`, assert the message transitions to `ANSWERED` through existing state-machine-safe transition logic and no provider write is attempted.

For `UNMODERATED/BANNED/DELETED/UNKNOWN/ABSENT`, assert no write occurs. `ABSENT` remains local open work; this pass reconciles only, it does not answer.

- [ ] **Step 3: Implement bounded reconciliation helper**

Use an SQLAlchemy query with `.limit(25)`. Reuse existing state-machine transition helpers rather than assigning an invalid message status directly.

Record only normalized counts/state in integration-event or audit metadata; do not persist raw provider payloads.

- [ ] **Step 4: Trigger reconciliation only at a full question-cycle boundary**

For historical backfill, run it when the oldest window completes. For later incremental mode, run it when the incremental question page chain completes (`next_cursor is None`). Do not run it on each page.

- [ ] **Step 5: Run scheduler/reconciliation tests GREEN**

```bash
pytest app/tests/test_marketplace_scheduler_contract.py -q
```

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/api/app/services/scheduled_sync_service.py apps/api/app/tests/test_marketplace_scheduler_contract.py
git commit -m "fix(yandex-market): reconcile open questions safely"
```

---

### Task 6: Add protected-ID/static regression guard and run the targeted backend matrix

**Files:**
- Modify: `apps/api/app/tests/test_yandex_market_runtime_probe.py` only if a static guard naturally belongs there; otherwise add the guard to `apps/api/app/tests/test_yandex_question_reply_safety.py`.
- Modify no production runtime-probe behavior unless needed to ensure tests cannot invoke live provider traffic.

**Interfaces:**
- Produces a static test that prevents accidental protected-ID write fixtures.

- [ ] **Step 1: Add static RED/GREEN guard for protected ID**

The test scans test/helper source files that contain `send_question_reply(` or write-mode runtime configuration and fails if protected ID `27265525` is used as the write target.

It is acceptable for the ID to appear in documentation/read-only evidence, so do not globally ban the string from the repository.

- [ ] **Step 2: Ensure automated tests never call live provider probes**

The test suite must instantiate `httpx.MockTransport` or fakes for adapter network tests. Do not execute `app.tools.yandex_market_runtime_probe` against the network.

- [ ] **Step 3: Run targeted Yandex correction matrix**

From `apps/api`:

```bash
pytest \
  app/tests/test_yandex_question_sync_policy.py \
  app/tests/test_yandex_market_adapter_contract.py \
  app/tests/test_yandex_market_adapter_normalization.py \
  app/tests/test_yandex_market_service_contract.py \
  app/tests/test_yandex_question_reply_safety.py \
  app/tests/test_marketplace_scheduler_contract.py \
  app/tests/test_marketplace_sync_pagination.py \
  -q
```

Expected: PASS, with no live-provider traffic.

- [ ] **Step 4: Run backend static quality for touched code**

From repository root using the repository-pinned commands/workflow equivalents:

```bash
ruff check apps/api/app/adapters/yandex_market.py \
  apps/api/app/services/yandex_question_sync_policy.py \
  apps/api/app/services/scheduled_sync_service.py \
  apps/api/app/services/reply_execution_service.py \
  apps/api/app/tests/test_yandex_question_sync_policy.py \
  apps/api/app/tests/test_yandex_market_adapter_contract.py \
  apps/api/app/tests/test_yandex_question_reply_safety.py
```

Run strict Pyright using the repository's existing exact command/config rather than inventing relaxed flags.

- [ ] **Step 5: Run full backend tests before claiming implementation completion**

Use the repository's normal full backend pytest command. If environment limitations prevent the exact gate, report the limitation; do not claim a pass that was not run.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/api/app/tests
git commit -m "test(yandex-market): guard correction safety contracts"
```

---

### Task 7: Final exact-tree verification without repeating provider probes

**Files:**
- No product changes expected; only fix regressions discovered by verification.

**Interfaces:**
- Consumes all prior tasks.
- Produces a release-candidate Yandex correctness correction while version remains `0.1.103`.

- [ ] **Step 1: Verify branch and diff scope**

Confirm current branch is `work/0.1.104-yandex-foundation`, no direct `main`/`develop` mutation occurred, and no migration/version-bump file changed unexpectedly.

- [ ] **Step 2: Run repository integrity/Alembic checks**

Run the existing integrity and Alembic head checks exactly as defined by the repository/Quality Gate.

Expected: no new migration and no Alembic head change caused by this correction.

- [ ] **Step 3: Run full backend Quality Gate portions**

Run backend tests, Ruff, strict Pyright, integrity, and Alembic checks. Do not rerun the already-completed Yandex provider runtime probes.

- [ ] **Step 4: Run broader exact-tree Quality Gate if release-candidate validation is requested in this branch**

The prior exact-tree gate included frontend install/tree/audit, unit/design/typecheck/ESLint/build/W3C, Chromium E2E, accessibility, Lighthouse, and production container builds. Re-run those only as repository regression validation, not as provider runtime probes.

- [ ] **Step 5: Verify protected write constraint**

Review the final diff and test logs to confirm no write against Question ID `27265525` was added or executed.

- [ ] **Step 6: Stop Yandex scope**

Once the correction and quality gates are green, do not add further Yandex polish to `0.1.104`. Preserve Ozon as the next marketplace implementation priority, followed by Avito with its separate conversation architecture.
