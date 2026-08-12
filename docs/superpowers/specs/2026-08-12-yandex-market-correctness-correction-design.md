# Yandex Market correctness correction design

Date: 2026-08-12  
Release target: `0.1.104`  
Feature branch: `work/0.1.104-yandex-foundation`  
Baseline before this document: `07929b8c8662546f01489784d79344e8c48c666e`  
Status: approved design for implementation planning

## 1. Purpose

Correct two verified Yandex Market runtime correctness gaps without turning Yandex Market into a separate architectural vertical:

1. historical unanswered questions older than the provider's default effective lookback can be omitted because current question sync sends `needAnswer=true` without explicit `dateFrom` / `dateTo`;
2. reply ownership and resend safety are currently too weak because reconciliation collapses provider answer state to a boolean and historically relied primarily on `author.type`, while a verified seller answer can be `status=PUBLISHED`, `canModify=True`, and `author.type=None`.

The correction must remain compatible with the existing marketplace-neutral scheduler, retry, audit, credential, entitlement, and observability foundations.

## 2. Non-goals

This batch does not:

- create a Yandex-only permanent scheduler or worker;
- add a new database table or Alembic migration;
- import all historical answered questions;
- rescan the full 12-month history on every normal sync cycle;
- redesign the generic marketplace model around Yandex-specific DTOs;
- implement Ozon or Avito;
- change `main` or `develop` directly;
- merge, deploy, tag, force-push, or bump the project version;
- repeat provider runtime probes already completed unless a new implementation-specific read-only verification is later required;
- perform any additional write against protected Yandex Question ID `27265525`.

The project version remains `0.1.103` until the full `0.1.104` release is closed.

## 3. Product priority boundary

The marketplace priority after this correction remains:

1. Wildberries — primary production path;
2. Ozon — next full marketplace vertical slice;
3. Avito — later, with a dedicated conversations/chat model;
4. Yandex Market — supported secondary channel.

Avito must not later be forced into the current review/question abstraction. Shared credentials, scheduling, retry, audit, and observability infrastructure may be reused, but chats/conversations/messages/attachments/read-delivery and webhook-or-polling semantics remain a separate future design.

## 4. Historical unanswered-question backfill

### 4.1 Scope

Initial Yandex question history is limited to a fixed 12-month horizon and `needAnswer=true` only.

Answered historical questions are intentionally not bulk imported. The goal is operational completeness for unanswered work, not archival replication of the seller account.

### 4.2 Windowing

The historical horizon is split into bounded date windows of 28 days with a one-day overlap between adjacent windows.

The implementation processes windows from newest to oldest so the most operationally relevant unanswered questions become available first.

For every historical window, the adapter sends explicit `dateFrom` and `dateTo` together with `needAnswer=true`.

The 12-month horizon boundaries are frozen when the initial backfill is first initialized. A long-running or resumed backfill must not silently move its lower bound forward with wall-clock time.

### 4.3 Pagination

`pageToken` is scoped strictly to the current date window.

Within one window:

- the first request has no page token;
- subsequent requests use the provider's returned `pageToken`;
- repeated tokens are detected;
- a token cycle fails closed;
- a safe page cap applies;
- the token is discarded when the window completes or advances.

A token from one date window must never be reused in another window.

### 4.4 Checkpoint and resume

No new persistence model is introduced. Historical backfill state is stored in the existing `MarketplaceSyncState.metadata_json` for the `questions` stream.

The persisted metadata is versioned and contains only the state required to resume deterministically, including:

- backfill schema/version marker;
- backfill phase/status;
- frozen horizon start and end dates;
- current window start and end dates;
- current window page token when present;
- page-token history or equivalent cycle-detection state required for safe resume;
- current window page count;
- completion marker.

The exact key names are implementation details, but tests must lock the transition semantics.

A crash or lease expiry may cause safe replay of already-ingested provider rows. Existing ingest upsert/idempotency behavior must make replay harmless. The design does not require exactly-once provider reads.

### 4.5 Transition to incremental sync

After the oldest historical window completes successfully, the backfill is marked complete in `metadata_json`.

Subsequent scheduled question sync uses the normal incremental Yandex `needAnswer=true` path and does not restart the 12-month scan.

The existing scheduler remains the sole scheduling mechanism. Historical window progression is a Yandex-specific execution policy inside the existing scheduled question stream, not a new daemon.

### 4.6 Manual sync

Manual sync is not a second historical-backfill engine.

The initial resumable backfill belongs to the existing background scheduler so there is one persisted checkpoint model. Manual sync may continue using the ordinary bounded stream behavior and must not create or independently mutate a competing 12-month backfill checkpoint.

## 5. Reply reconciliation model

### 5.1 Required states

Yandex question reply reconciliation distinguishes at least:

- `ABSENT`;
- `PUBLISHED`;
- `UNMODERATED`;
- `BANNED`;
- `DELETED`;
- `UNKNOWN`.

The generic `AdapterResult` may carry the normalized state in `data`; a new database enum is not required.

### 5.2 Ownership

Seller-owned Yandex question answers cannot be detected only through `author.type`.

An answer is treated as seller-owned when provider evidence establishes seller control. The minimum accepted signals are:

- `canModify is True`; or
- legacy/explicit seller author type such as `BUSINESS` or `BRAND`.

Conflicting or structurally ambiguous ownership evidence does not become `ABSENT`; it becomes `UNKNOWN`.

### 5.3 State normalization

For the specific question-ID answer lookup:

- no seller-owned answers in a valid, unambiguous provider response => `ABSENT`;
- seller-owned answer with provider status `PUBLISHED` => `PUBLISHED`;
- seller-owned answer with provider status `UNMODERATED` => `UNMODERATED`;
- seller-owned answer with provider status `BANNED` => `BANNED`;
- seller-owned answer with provider status `DELETED` => `DELETED`;
- timeout, network failure, malformed response, unknown provider status, conflicting ownership, or otherwise ambiguous evidence => `UNKNOWN`.

Absence from a broad `needAnswer=true` question list is never sufficient evidence for `ABSENT`.

## 6. Mandatory pre-write reconciliation

Before every Yandex question write, the execution path must perform read-only reconciliation for that exact Question ID.

Automatic write is permitted only when both conditions hold:

1. reconciliation is confirmed `ABSENT`;
2. the reply has no active ambiguity marker from a prior uncertain send result.

Behavior by state:

- `PUBLISHED`: do not write; treat the local reply as externally already answered and converge local state accordingly;
- `UNMODERATED`: do not write or auto-resend;
- `BANNED`: do not write or auto-resend;
- `DELETED`: do not write or auto-resend automatically;
- `UNKNOWN`: do not write or auto-resend;
- `ABSENT`: write only if no ambiguity marker exists.

The current behavior where an indeterminate preflight can fall through to the provider write is explicitly incorrect and must be removed for Yandex question writes.

Review-reply behavior is not expanded into the same Yandex question-specific state machine in this batch unless required to preserve generic interfaces.

## 7. Ambiguous transport results and resend safety

A provider write can be accepted remotely even if the client receives a timeout, connection reset, or other ambiguous transport outcome.

For Yandex question sends, an ambiguous write result must persist an ambiguity marker on the existing `Reply.metadata_json` before the reply can be retried automatically.

Examples that create or preserve ambiguity include:

- timeout after request dispatch;
- network error where remote commit is unknowable;
- provider result that cannot establish whether the write was created;
- moderation/pending state observed after a previously attempted send.

While the marker is active, a later `ABSENT` reconciliation does not by itself authorize automatic resend. This prevents duplicate seller answers during propagation or moderation gaps.

Clearing ambiguity is outside automatic resend logic unless the provider read model supplies conclusive state. Unresolved cases remain blocked for operator/manual handling rather than guessed.

## 8. Background reconciliation of local open questions

The existing marketplace-neutral scheduler may perform a bounded reconciliation pass for local Yandex question messages still in `needs_reply`.

Rules:

- only Yandex question messages;
- only local open `needs_reply` work;
- maximum 25 questions per reconciliation cycle;
- 25 is a cap, not a mandatory API request budget;
- exact Question ID read-only reconciliation is used;
- `PUBLISHED` converges the local message/reply state to answered/sent-as-external as appropriate;
- `UNMODERATED`, `BANNED`, `DELETED`, and `UNKNOWN` do not trigger writes;
- reconciliation outcome is observable through existing metadata/audit/integration-event mechanisms without exposing credentials or customer-sensitive raw payloads.

No permanently running Yandex-only scheduler is introduced.

## 9. Protected runtime evidence

The following runtime evidence is authoritative for this correction:

- protected Question ID: `27265525`;
- accepted Answer ID: `28149115`;
- verified accepted answer characteristics: `status=PUBLISHED`, `canModify=True`, `author.type=None`.

Question ID `27265525` is permanently read-only for this development work. No test, probe, fixture helper, implementation task, or manual verification instruction may perform another write against it.

Provider runtime probes already completed for this release must not be repeated as part of normal implementation. Unit and integration tests use synthetic IDs and mocked transports.

## 10. Architecture impact

Expected implementation focus:

- `apps/api/app/adapters/yandex_market.py` — bounded question-window fetch parameters and rich exact-ID answer reconciliation;
- `apps/api/app/services/scheduled_sync_service.py` — resumable historical-window progression through existing `MarketplaceSyncState.metadata_json`;
- small marketplace-neutral helper/interface changes only where necessary to pass optional question-fetch context cleanly;
- `apps/api/app/services/reply_execution_service.py` — fail-closed Yandex question pre-write handling, ambiguity persistence, and resend blocking;
- scheduler/reconciliation service code only as needed to implement the bounded 25-item local-open reconciliation pass;
- focused tests in existing Yandex adapter, sync pagination/scheduler, and reply execution suites.

No migration is expected.

## 11. Error handling

Historical sync fails closed on:

- repeated page token;
- page cap exhaustion;
- malformed checkpoint state that cannot be safely interpreted;
- provider errors that existing retry policy cannot immediately resolve.

Retryable provider/network errors continue to use existing marketplace-neutral retry/backoff behavior.

A checkpoint parsing problem must not silently reset to a fresh 12-month scan if doing so could hide a logical corruption. The state must surface an explicit safe error and preserve enough metadata for diagnosis.

Reply execution fails closed whenever reconciliation cannot positively authorize a write.

## 12. Observability

Use existing audit and integration-event infrastructure.

Historical question-sync events should expose safe operational metadata such as:

- backfill/incremental phase;
- window boundaries;
- page count;
- whether a next window remains;
- normalized error code.

Do not log:

- API keys;
- raw authorization headers;
- raw customer question text solely for diagnostics;
- full provider payloads;
- protected runtime credentials.

Reply reconciliation should record normalized state and ambiguity decisions, not raw provider answers.

## 13. TDD contract

Implementation is test-first. Required RED contracts include at least:

1. Yandex historical question fetch emits `needAnswer=true` plus explicit bounded dates.
2. Window pagination resets `pageToken` between windows.
3. Repeated `pageToken` within a window fails closed.
4. Frozen 12-month horizon resumes from persisted metadata instead of moving with wall-clock time.
5. Completed backfill transitions to ordinary incremental question sync and does not restart.
6. Scheduler uses existing `MarketplaceSyncState.metadata_json`; no migration/table is introduced.
7. Exact-ID reconciliation maps `PUBLISHED`, `UNMODERATED`, `BANNED`, `DELETED`, `ABSENT`, and malformed/ambiguous data to the required normalized states.
8. `canModify=True` identifies the verified seller-owned answer even when `author.type` is absent.
9. Unknown/failed pre-write reconciliation blocks Yandex question send.
10. Confirmed `PUBLISHED` suppresses the write and converges local state.
11. Confirmed `ABSENT` permits one write only when no ambiguity marker exists.
12. Ambiguous transport failure persists an ambiguity marker and prevents automatic resend even if a later read returns `ABSENT`.
13. Background reconciliation selects only local Yandex open question work and never processes more than 25 per cycle.
14. Protected Question ID `27265525` never appears in a write-path test invocation; runtime probes are not executed by the test suite.
15. Existing Wildberries behavior and marketplace-neutral scheduler contracts remain green.

Tests should favor mocked `httpx` transport and service harnesses already established in the repository. No live provider traffic is part of the automated suite.

## 14. Release constraints

During this correction:

- feature branch only;
- no direct writes to `main` or `develop`;
- no merge/deploy/tag/force-push;
- no version bump until release closure;
- no `npm audit fix --force`;
- no provider write probes;
- no repeat write to Question ID `27265525`.

After implementation, the normal exact-tree quality gate remains required before release closure. Previously completed runtime probes are evidence and are not automatically repeated.

## 15. Definition of done for this correction

The Yandex correction is complete when:

- initial unanswered-question history can cover the frozen 12-month horizon via resumable 28-day windows;
- pagination is bounded and fail-closed per window;
- completed history switches to ordinary incremental sync;
- no new Yandex-only scheduler or persistence table exists;
- exact-ID reply reconciliation exposes the required states and recognizes `canModify=True` ownership;
- every Yandex question write is positively authorized by read-only reconciliation;
- ambiguous send outcomes cannot cause automatic duplicate resend;
- local open-question reconciliation is bounded to 25 per cycle through existing scheduler infrastructure;
- targeted TDD contracts and existing regression suites pass;
- no protected provider write is performed;
- the team stops Yandex-specific scope after correctness closure and proceeds to the next marketplace priority, Ozon.
