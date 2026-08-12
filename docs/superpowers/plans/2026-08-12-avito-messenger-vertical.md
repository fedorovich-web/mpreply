# Avito Messenger Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a production-safe Avito polling/text conversation slice from the supplied official Messenger OpenAPI without claiming OAuth refresh, webhooks, or media support.

**Architecture:** Keep account, reply, entitlement, audit, dispatch-recovery, and scheduler foundations shared. Add a typed conversation-adapter protocol plus an Avito HTTP boundary, a chat-specific resumable sync/ingest service, and explicit chat dispatch in reply execution. Persist one actionable inbound text turn per chat while preserving provider IDs and fail closed around unsupported content, scope uncertainty, pagination, and ambiguous writes.

**Tech Stack:** Python 3.13+, FastAPI, Pydantic 2, SQLAlchemy asyncio/PostgreSQL JSONB, Alembic, httpx 0.28.1, Dramatiq, pytest/pytest-asyncio, Ruff 0.14.9, strict Pyright 1.1.411.

## Global Constraints

- Source contract: `docs/superpowers/specs/2026-08-12-avito-messenger-vertical-design.md` and the user-supplied official OpenAPI 3.0.0 `Мессенджер`, version `1`.
- Branch remains `codex/0.1.104-backend`; version remains exactly `0.1.103`.
- No live Avito validation, chat read, message send, webhook registration, release, deployment, tag, force-push, or version bump.
- Credentials and synthetic fixture values never appear in URLs, logs, audit metadata, snapshots, or user-safe errors.
- Do not implement OAuth token acquisition/refresh, webhooks, media, voice, deletion, or blacklist from incomplete contracts.
- Use TDD: one targeted RED and one grouped GREEN per task. Do not rerun unchanged test suites. Run one full affected backend/package gate only in Task 5.
- Review is static by default. A test is repeated after review only when review caused code changes, and the reason is recorded.
- No new dependency. Any migration is additive/reversible and follows the current Alembic head.

## File structure

- `apps/api/app/adapters/conversation.py`: typed conversation protocol and parsed Avito chat/message value objects used by services.
- `apps/api/app/adapters/avito.py`: exact Avito HTTP requests, safe parsing, read mutation, preflight, and text send.
- `apps/api/app/services/avito_chat_ingest_service.py`: one-turn-per-chat persistence and active-reply conflict handling.
- `apps/api/app/services/avito_chat_sync_service.py`: bounded unread-chat checkpoint, message traversal, commit-before-read ordering, and stats.
- `apps/api/app/services/sync_service.py`: manual Avito chat dispatch through the dedicated sync service.
- `apps/api/app/services/scheduled_sync_service.py`: scheduler dispatch for the `chats` state.
- `apps/api/app/services/reply_execution_service.py`: explicit chat preflight/send path and Avito ambiguity handling.
- `apps/api/alembic/versions/20260812_0015_avito_chat_sync_stream.py`: adds `chats` to the sync-state constraint.
- `apps/api/app/tests/test_avito_adapter_contract.py`: official wire and parsing contract.
- `apps/api/app/tests/test_avito_account_contract.py`: identity, validation metadata, and credential lifecycle.
- `apps/api/app/tests/test_avito_chat_ingest.py`: actionable-turn and optional-product persistence.
- `apps/api/app/tests/test_avito_chat_sync.py`: manual/scheduled checkpoints and read timing.
- `apps/api/app/tests/test_avito_reply_safety.py`: preflight, send, entitlement, and ambiguity behavior.

---

### Task 1: Typed Avito HTTP boundary and read-only credential validation

**Files:**
- Create: `apps/api/app/adapters/conversation.py`
- Create: `apps/api/app/adapters/avito.py`
- Modify: `apps/api/app/services/marketplace_account_service.py`
- Test: `apps/api/app/tests/test_avito_adapter_contract.py`
- Test: `apps/api/app/tests/test_avito_account_contract.py`

**Interfaces:**
- Consumes: existing `AdapterResult`, `MarketplaceAdapter`, encrypted account credential, and `seller_id`.
- Produces: `ConversationAdapter`, `AvitoChat`, `AvitoMessage`, and `AvitoAdapter.validate_credentials()`.

- [ ] **Step 1: Define the wished-for typed contract in failing tests**

Write tests that import the absent adapter and construct it with `httpx.MockTransport`. The production types must have these shapes:

```python
@dataclass(frozen=True)
class AvitoChat:
    id: str
    created_unix: int
    updated_unix: int
    chat_type: str | None
    item_id: int | None
    item_title: str | None
    item_url: str | None
    customer_id: int | None
    customer_name: str | None

@dataclass(frozen=True)
class AvitoMessage:
    id: str
    author_id: int
    created_unix: int
    direction: Literal["in", "out"]
    is_read: bool
    read_unix: int | None
    kind: str
    text: str | None

@runtime_checkable
class ConversationAdapter(Protocol):
    async def fetch_chats(
        self, credential: str, user_id: str, *, unread_only: bool, limit: int, offset: int
    ) -> AdapterResult: ...
    async def fetch_chat_messages(
        self, credential: str, user_id: str, chat_id: str, *, limit: int, offset: int
    ) -> AdapterResult: ...
    async def mark_chat_read(self, credential: str, user_id: str, chat_id: str) -> AdapterResult: ...
    async def has_existing_chat_reply(
        self, credential: str, user_id: str, *, chat_id: str, inbound_created_unix: int
    ) -> AdapterResult: ...
    async def send_chat_message(
        self, credential: str, user_id: str, *, chat_id: str, text: str
    ) -> AdapterResult: ...
```

Assert validation performs exactly:

```python
assert request.method == "GET"
assert request.url.path == "/messenger/v2/accounts/123456/chats"
assert request.headers["Authorization"] == "Bearer synthetic-access-token"
assert request.url.params["limit"] == "1"
assert request.url.params["offset"] == "0"
assert request.url.params["unread_only"] == "false"
assert request.url.params["chat_types"] == "u2i,u2u,a2u"
```

Cover positive integer `user_id`, missing/blank/zero/negative/non-decimal IDs with zero network calls, Bearer-prefix normalization without double-prefixing, malformed `200`, timeout, transport error, `400/401/402/403/404/429/5xx`, and bounded non-negative `X-RateLimit-Limit`/`X-RateLimit-Remaining` parsing.

- [ ] **Step 2: Run one RED command**

Run from `apps/api`:

```powershell
pytest.exe -q app/tests/test_avito_adapter_contract.py app/tests/test_avito_account_contract.py
```

Expected: collection/import failure because the conversation contract and Avito adapter do not exist, plus account validation failures for Avito identity handling.

- [ ] **Step 3: Implement the minimal HTTP and parsing boundary**

Create `AvitoAdapter(MarketplaceAdapter)` for registry/account compatibility and make it structurally satisfy `ConversationAdapter`. Existing review/question methods return a safe `unsupported_operation`; do not add chat methods to `MarketplaceAdapter`.

Use one private request method with base URL `https://api.avito.ru`, injected async transport, bounded timeout, `follow_redirects=False`, safe JSON narrowing, and header-only authorization. Map errors exactly as the design specifies. Never include response bodies in safe errors.

Parse a successful chat-list response only when the root is a mapping and `chats` is a list of mappings. Use `type(value) is int` for Unix timestamps/user/item IDs so booleans are rejected. Preserve exact strings; do not synthesize names, IDs, timestamps, context, or URLs.

Update `normalize_marketplace_seller_id()` so Avito requires a positive decimal `seller_id`. For successful Avito validation persist only:

```python
{
    "validated": True,
    "checked_at": now.isoformat(),
    "scopes": ["fetch_chats"],
}
```

Changing Avito `seller_id`, rotating credentials, revoking credentials, or failed revalidation clears stale validation metadata and pauses states just like the existing Ozon credential-pair lifecycle. Keep the raw Avito user ID out of API responses using the same redaction boundary as Ozon Client ID.

- [ ] **Step 4: Run one grouped GREEN and static checks**

Run the same pytest command once. Then run Ruff on the touched files and strict Pyright once. Do not include unrelated marketplace suites in this task.

- [ ] **Step 5: Commit**

```text
feat(avito): add messenger adapter contracts
```

---

### Task 2: Chat capability, migration, and optional-product ingestion

**Files:**
- Modify: `apps/api/app/adapters/base.py`
- Modify: `apps/api/app/adapters/capabilities.py`
- Modify: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/models/enums.py`
- Modify: `apps/api/app/models/marketplace_sync_state.py`
- Modify: `apps/api/app/services/marketplace_ingest_service.py`
- Create: `apps/api/app/services/avito_chat_ingest_service.py`
- Create: `apps/api/alembic/versions/20260812_0015_avito_chat_sync_stream.py`
- Test: `apps/api/app/tests/test_avito_chat_ingest.py`
- Test: `apps/api/app/tests/test_marketplace_capability_dispatch.py`
- Test: `apps/api/app/tests/test_marketplace_scheduler_contract.py`

**Interfaces:**
- Consumes: `AvitoChat`, `AvitoMessage`, `CustomerMessage`, `Reply`, and existing account/scheduler models.
- Produces: `MarketplaceSyncStream.CHATS`, operations `fetch_chats`/`send_chat_message`, enabled Avito capability/registry dispatch, and `AvitoChatIngestService.ingest_turn()`.

- [ ] **Step 1: Write RED capability, migration, and ingest tests**

Extend `MarketplaceOperation` with exact literals:

```python
"fetch_chats"
"send_chat_message"
```

Assert the Avito capability is enabled with `message_types=(MessageType.CHAT,)`, `sync_streams=(MarketplaceSyncStream.CHATS,)`, polling enabled, and offset pagination. Assert WB/Ozon/Yandex capabilities are unchanged.

Add migration contract assertions that upgrade changes the sync-state check to:

```sql
stream IN ('reviews', 'questions', 'chats')
```

and downgrade restores the two original values.

For ingestion, create synthetic chat/message objects and assert:

- only consecutive unread inbound text messages after the latest outbound boundary form the turn;
- text is joined chronologically with `"\n"`;
- `CustomerMessage.external_id` equals the latest included inbound message ID;
- metadata contains exact `chat_id`, source IDs, authors, timestamps, chat type, and `avito_inbound_created_unix`;
- `u2i` with a valid positive item ID may upsert the exact product;
- `u2u`/`a2u` and malformed context keep `product_id=None` and never create an `unknown` product;
- older unsent actionable messages for the same account/chat become archived;
- a nonterminal existing reply makes the new turn `needs_manual_check` instead of creating competing automation;
- repeated ingestion updates idempotently without duplicating the same provider message.

- [ ] **Step 2: Run one RED command**

```powershell
pytest.exe -q app/tests/test_avito_chat_ingest.py app/tests/test_marketplace_capability_dispatch.py app/tests/test_marketplace_scheduler_contract.py
```

Expected: missing `CHATS`, missing capability operations/migration, and missing chat ingest service.

- [ ] **Step 3: Implement capability and reversible schema change**

Add `CHATS = "chats"` to `MarketplaceSyncStream` and teach `MarketplaceCapability.sync_streams` to emit it when `fetch_chats` is supported. Enable Avito only after `AvitoAdapter` is registered.

Create Alembic revision `20260812_0015` with `down_revision="20260722_0014"`. Drop and recreate only `ck_marketplace_sync_states_stream`; do not alter data or add a table/column.

- [ ] **Step 4: Implement optional-product and one-turn ingestion**

Modify generic ingestion so `product=None` is permitted only when `normalized["type"] == MessageType.CHAT.value`. Review/question inputs still require a valid product mapping and retain current behavior.

Implement `AvitoChatIngestService` with:

```python
@dataclass(frozen=True)
class AvitoChatIngestResult:
    outcome: Literal["created", "updated", "skipped", "manual_review"]
    message_id: UUID | None
    can_mark_read: bool

async def ingest_turn(
    self,
    *,
    account: MarketplaceAccount,
    chat: AvitoChat,
    messages: Sequence[AvitoMessage],
) -> AvitoChatIngestResult: ...
```

Use provider timestamps converted with `datetime.fromtimestamp(value, tz=UTC)`. Reject negative/overflow timestamps. Unsupported or malformed unread inbound messages return `can_mark_read=False` and create no fabricated text. Query previous chat targets tenant/account-scoped; never match another organization by chat ID.

- [ ] **Step 5: Run one grouped GREEN and static checks**

Run the same pytest command once, Ruff touched files once, strict Pyright once, and `git diff --check`. Do not run the full backend.

- [ ] **Step 6: Commit**

```text
feat(avito): persist actionable chat turns
```

---

### Task 3: Resumable manual and scheduled unread-chat synchronization

**Files:**
- Modify: `apps/api/app/adapters/avito.py`
- Create: `apps/api/app/services/avito_chat_sync_service.py`
- Modify: `apps/api/app/services/sync_service.py`
- Modify: `apps/api/app/services/marketplace_scheduler_service.py`
- Modify: `apps/api/app/services/scheduled_sync_service.py`
- Test: `apps/api/app/tests/test_avito_adapter_contract.py`
- Create: `apps/api/app/tests/test_avito_chat_sync.py`
- Test: `apps/api/app/tests/test_marketplace_sync_pagination.py`

**Interfaces:**
- Consumes: `ConversationAdapter`, `AvitoChatIngestService`, account credential/user ID, and `MarketplaceSyncState.metadata_json`.
- Produces: `AvitoChatSyncService.sync_batch()` used by both manual and scheduled entry points.

- [ ] **Step 1: Write RED exact read/read-state and checkpoint tests**

Assert chat polling sends a single comma-separated query value from the official example:

```python
{
    "chat_types": "u2i,u2u,a2u",
    "unread_only": "true",
    "limit": "100",
    "offset": "0",
}
```

Assert message polling uses the exact trailing-slash path and `limit=100`, offsets `0,100,...,1000`. A shorter page completes; a full page at offset 1000 fails `sync_page_limit_exceeded` rather than guessing more data exists.

Test strict message fields and unsupported types. Test `POST .../read` occurs only after the ingest session commit succeeds and response must be exactly `{"ok": true}`. Commit failure, unsupported unread content, malformed payload, or ingest failure performs zero read calls.

Persist this checkpoint in the existing sync-state metadata:

```python
{
    "avito_chat_sync": {
        "schema_version": 1,
        "chat_offset": 0,
        "skipped_chat_versions": {"chat-id": 1700000000},
    }
}
```

Known unsupported `(chat_id, updated_unix)` entries may be skipped without marking read. A changed `updated_unix` makes the chat eligible again. Invalid checkpoint shape pauses the state with `sync_pagination_checkpoint_invalid`. Completion clears only `avito_chat_sync`, preserving unrelated metadata.

Manual sync processes at most 25 chats per request. Scheduled sync processes one chat per lease and schedules the next step after one second while work remains. Both use the same service and reset the chat offset to zero after a successful read mutation because the unread list shrinks.

- [ ] **Step 2: Run one RED command**

```powershell
pytest.exe -q app/tests/test_avito_adapter_contract.py app/tests/test_avito_chat_sync.py app/tests/test_marketplace_sync_pagination.py
```

Expected: missing fetch/read implementation and no chat dispatch/checkpoint policy.

- [ ] **Step 3: Implement exact polling and read mutation**

In `AvitoAdapter`, validate `limit`/`offset` before network, preserve exact IDs, and return `malformed_payload` for invalid successful roots/items. Do not mark chats read inside the adapter automatically.

Implement `AvitoChatSyncService.sync_batch()` returning:

```python
@dataclass(frozen=True)
class AvitoChatSyncResult:
    status: Literal["success", "failed", "paused"]
    created: int = 0
    updated: int = 0
    skipped: int = 0
    has_more: bool = False
    error_code: str | None = None
    retryable: bool = False
```

Use an explicit provider-call budget and the design page caps. Before `mark_chat_read`, commit the newly ingested target. After the read call, persist job/checkpoint/audit status in a new transaction. Safe event metadata may contain counts and normalized error codes, never chat/message/customer identifiers or text.

- [ ] **Step 4: Wire manual and scheduled dispatch**

Manual sync selects the dedicated chat service when the sole stream is `CHATS`; it must not route Avito through review/question extraction. Scheduled execution verifies account active/valid and supported chat stream before decrypting credentials. Leases, pause/error transitions, retry delay, and durable job/event behavior remain provider-neutral.

Existing Ozon account-scoped streams and Yandex backfill branches must remain byte-for-byte behaviorally unchanged outside necessary type narrowing.

- [ ] **Step 5: Run one grouped GREEN and static checks**

Run the same pytest command once, Ruff once, strict Pyright once, and diff check. Do not rerun Tasks 1-2 suites unless this task changed their production files and a named neighboring assertion is included in this command.

- [ ] **Step 6: Commit**

```text
feat(avito): synchronize unread conversations
```

---

### Task 4: Exact outbound preflight and guarded text replies

**Files:**
- Modify: `apps/api/app/adapters/avito.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Test: `apps/api/app/tests/test_avito_adapter_contract.py`
- Create: `apps/api/app/tests/test_avito_reply_safety.py`
- Test: `apps/api/app/tests/test_auto_reply_worker.py`

**Interfaces:**
- Consumes: chat message metadata, `ConversationAdapter`, existing reply state machine, entitlement reservation, audit/event, and ambiguity paths.
- Produces: safe chat preflight and `marketplace_reply_id` persistence.

- [ ] **Step 1: Write RED preflight/send and execute-level tests**

For preflight, require exact context:

```python
{
    "avito_chat_id": "chat-123",
    "avito_inbound_created_unix": 1700000000,
}
```

Fetch all bounded message pages. Return `answered=True` when any strict outbound message has `created >= inbound_created_unix`; return `answered=False` only after a valid completed traversal. Missing/malformed context, provider error, malformed page/item, or page exhaustion is non-OK and performs zero writes.

For send, assert exact request:

```python
assert request.method == "POST"
assert request.url.path == "/messenger/v1/accounts/123456/chats/chat-123/messages"
assert json.loads(request.content) == {
    "message": {"text": "Synthetic reply"},
    "type": "text",
}
```

Test text lengths 0, 1, 1000, and 1001 before network. Successful response must have non-empty `id`, exact `direction="out"`, exact `type="text"`, and matching `content.text`. Expose only `{"marketplace_reply_id": id}`.

Execute-level tests must prove:

- account must be active with valid credentials before entitlement/provider access;
- preflight always precedes the first send;
- later outbound message prevents send and settles no entitlement;
- provider ID reaches `Reply.marketplace_reply_id`;
- timeout/network error/malformed success after POST releases entitlement and enters manual review with one send call;
- retry/manual execution with an active ambiguity marker never sends again;
- `400/401/402/403/404` are terminal safe failures;
- `429/5xx` from read-only preflight may retry, while ambiguous post-send outcomes never broker-retry;
- WB/Ozon/Yandex dispatch remains on their existing methods.

- [ ] **Step 2: Run one RED command**

```powershell
pytest.exe -q app/tests/test_avito_adapter_contract.py app/tests/test_avito_reply_safety.py app/tests/test_auto_reply_worker.py
```

Expected: chat dispatch is absent, chat is misrouted to question send, and Avito malformed success is not yet classified as outbound ambiguity.

- [ ] **Step 3: Implement explicit chat dispatch**

Narrow the registered adapter with `isinstance(adapter, ConversationAdapter)` before chat operations. Never use question methods as a fallback. Pass a copied message metadata mapping.

Teach reply execution to regard Avito `network_timeout`, `network_error`, and post-send `malformed_payload` as `outbound_send_ambiguity`. Reuse the existing marker/audit/event/entitlement implementation; include marketplace and normalized reason only.

Keep the durable enqueue/recovery service unchanged: Avito replies use the existing queued row, nullable worker ID, recovery source, attempt budget, and due-time gates.

- [ ] **Step 4: Run one grouped GREEN and static checks**

Run the same pytest command once, Ruff once, strict Pyright once, and diff check. No full suite yet.

- [ ] **Step 5: Commit**

```text
feat(avito): execute guarded chat replies
```

---

### Task 5: Static review, factual documentation, and one final gate

**Files:**
- Modify only backend/current-status docs whose Avito statements become stale.
- Test: full affected backend/package and production containers.

**Interfaces:**
- Consumes: Tasks 1-4 and the approved Avito design.
- Produces: reviewed Avito polling/text slice with current verification evidence and explicit runtime limitations.

- [ ] **Step 1: Perform static exact-tree review before tests**

Compare every Avito diff against the design and supplied OpenAPI. Confirm:

- exact server, paths, trailing slash, headers, queries, request bodies, response fields, text bound, and offset bounds;
- no invented OAuth refresh, webhook verification, media, or write-scope introspection;
- no placeholder products/text/IDs/timestamps;
- account/tenant authorization and credential redaction;
- commit-before-read ordering;
- exact preflight and no blind resend;
- version still `0.1.103` and no dependency changes.

Resolve Critical/Important review findings first. Review fixes use one targeted RED/GREEN only for changed behavior; do not rerun the final gate until review is clean.

- [ ] **Step 2: Update factual docs without overclaiming runtime**

State that the Avito polling/text adapter is implemented and contract-tested with synthetic transport, while real token validation, read mutation, message delivery, OAuth lifecycle, webhooks, and media remain unverified/unsupported. Remove only statements that say Avito has no adapter. Do not rewrite historical docs that are clearly dated snapshots.

- [ ] **Step 3: Run the final backend/package gate once**

From repository root:

```powershell
python scripts/check_integrity.py
python -m unittest discover -s scripts/tests -p "test_*.py"
```

From `apps/api`:

```powershell
python -m pip install -e ".[dev]"
python -c "import app.main; import app.workers.auto_reply; import app.workers.marketplace_sync; import app.scheduler.main"
python -m pip check
ruff.exe check app alembic
pyright.exe
pytest.exe -q
python -m compileall -q app alembic
alembic heads
alembic history
```

Record exact outputs. This is the only full backend suite after Avito implementation.

- [ ] **Step 4: Run affected production container/config gates once**

Build the production API, worker, and scheduler targets that share the API package. Use the repository container gate or exact Compose build targets without starting provider probes. Record whether Docker was available and the exact result; do not claim a pass if unavailable.

- [ ] **Step 5: Final static review and commit docs**

If documentation changed, commit only those files:

```text
docs(avito): document messenger integration limits
```

Update the ignored SDD ledger/report with commit SHAs, RED/GREEN evidence, final gate results, migration head, container results, and explicit unverified runtime items.
