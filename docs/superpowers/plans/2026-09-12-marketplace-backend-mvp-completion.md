# Marketplace Backend MVP Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete contract-tested, tenant-safe synchronization and reply execution for Wildberries, Ozon, Yandex Market, and Avito without requiring live provider credentials.

**Architecture:** Replace provider string switches and the all-in-one adapter with capability-specific protocols resolved by a central registry. Run every marketplace stream through one lease-aware, page-transactional ingestion pipeline and every outbound reply through one preflight/send/reconcile state machine with ambiguous-write protection. Reuse the current account, message, product, reply, audit, and encryption models while adding one generic sync-state table from the current Alembic head.

**Tech Stack:** Python 3.13, FastAPI 0.141, Pydantic 2, SQLAlchemy asyncio 2.0, Alembic 1.17, asyncpg, HTTPX 0.28 with `MockTransport`, Dramatiq/Redis, pytest 9, Ruff, strict Pyright, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-12-marketplace-backend-mvp-completion-design.md`

## Global Constraints

- Work on `feat/auth-email-resend`; do not create or switch branches or worktrees.
- Do not merge, push, deploy, tag, release, or version-bump.
- Do not modify `.handoff/` or `apps/cms/`.
- Do not add dependencies unless an implementation cannot be correct with the pinned stack and the maintenance impact is documented first.
- Do not make live marketplace calls or place real credentials, account IDs, customer data, or provider bodies in tests, logs, commits, or evidence.
- Provider endpoints and request shapes must be checked against current official documentation before the provider task is implemented.
- Use synthetic fixtures and `httpx.MockTransport`; production configuration must not expose a mock-transport switch.
- Unsupported operations fail with `unsupported_capability` before credential decryption or network I/O.
- Read requests use bounded retry; potentially delivered writes are never retried automatically.
- Preserve and strengthen tenant scoping, RBAC, encryption, redaction, idempotency, and fail-closed behavior.
- Use SQLAlchemy expressions and bound parameters only; never construct SQL from marketplace input.
- Do not retain compatibility wrappers, duplicate helpers, dead branches, unused imports, broad exception suppression, silent fallbacks, or untyped escape hatches.
- Run focused RED/GREEN checks during each task. Run the complete repository and security gates once after all tasks are integrated.
- Commit exact task-owned files only after the task's focused tests and static checks pass.

## File and responsibility map

- `apps/api/app/adapters/base.py`: provider-neutral result, page, error, preflight, and credential/review-question protocols.
- `apps/api/app/adapters/conversation.py`: Avito-oriented conversation value objects and protocol.
- `apps/api/app/adapters/capabilities.py`: immutable provider capability declarations and stream support.
- `apps/api/app/adapters/registry.py`: lifecycle-owned adapter registration and capability-specific lookup.
- `apps/api/app/adapters/http.py`: bounded retry policy and reusable provider client construction helpers.
- `apps/api/app/adapters/wildberries.py`: Wildberries request, pagination, normalization, preflight, and write contracts.
- `apps/api/app/adapters/ozon.py`: Ozon request, scope, pagination, normalization, preflight, and write contracts.
- `apps/api/app/adapters/yandex_market.py`: Yandex Market review/question request, pagination, normalization, and reconciliation contracts.
- `apps/api/app/adapters/avito_auth.py`: versioned Avito credentials and coalesced access-token lifecycle.
- `apps/api/app/adapters/avito.py`: Avito chat/message request, pagination, normalization, preflight, and text-write contracts.
- `apps/api/app/core/lifecycle.py`: application-owned marketplace clients and registry startup/shutdown.
- `apps/api/app/models/marketplace_sync_state.py`: ORM model for per-account, per-stream scheduling and leases.
- `apps/api/alembic/versions/20260912_0012_marketplace_sync_states.py`: reversible generic sync-state migration from `20260911_0011`.
- `apps/api/app/services/marketplace_ingest_service.py`: conflict-safe product/message persistence and metadata allowlists.
- `apps/api/app/services/sync_service.py`: authorized manual sync entry point into the common stream runner.
- `apps/api/app/services/scheduled_sync_service.py`: leases, bounded page loops, cursor commits, retry scheduling, and provider policies.
- `apps/api/app/services/avito_chat_ingest_service.py`: Avito chat/message projection into nullable-product customer messages.
- `apps/api/app/services/avito_chat_sync_service.py`: bounded Avito chat and message traversal.
- `apps/api/app/services/marketplace_account_service.py`: typed account credential validation through the registry.
- `apps/api/app/services/reply_execution_service.py`: capability-routed preflight, one-shot send, strict proof, and reconciliation.
- `apps/api/app/workers/marketplace_sync.py`: Dramatiq entry point for due stream execution.
- `apps/api/app/tests/marketplace_fixtures.py`: synthetic request recorder, response builders, and secret-leak assertions shared by provider tests.
- `apps/api/app/tests/test_*marketplace*`, `test_*reply*`, and security modules named below: focused contract and regression coverage.

---

## Slice 1 — Foundation and Wildberries migration

### Task 1: Define capability-specific adapter contracts

**Files:**
- Modify: `apps/api/app/adapters/base.py`
- Create: `apps/api/app/adapters/conversation.py`
- Create: `apps/api/app/adapters/capabilities.py`
- Create: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_adapter_registry_boundaries.py`
- Create: `apps/api/app/tests/test_marketplace_capability_dispatch.py`

**Interfaces:**
- Produces: `MarketplaceErrorCode`, `AdapterResult[T]`, `MarketplacePage[T]`, `MarketplaceStream`, `CredentialValidation`, `NormalizedProduct`, `NormalizedMessage`, `ProviderMessageContext`, `ExistingReplyResult`, `ProviderWriteReceipt`, `ConversationThread`, `ConversationMessage`, `CredentialAdapter`, `ReviewQuestionAdapter`, and `ConversationAdapter`.
- Produces: `MarketplaceCapability`, `get_marketplace_capability()`, and `MarketplaceAdapterRegistry`.
- Consumes: `Marketplace`, `MessageType`, and injected provider adapter instances.

- [x] **Step 1: Write failing protocol and registry tests**

```python
def test_avito_has_conversation_capability_only() -> None:
    capability = get_marketplace_capability(Marketplace.AVITO)
    assert capability.streams == frozenset({MarketplaceStream.CHATS})
    assert capability.reply_types == frozenset({MessageType.CHAT})


def test_registry_rejects_unsupported_capability_before_factory_call() -> None:
    factory = Mock(side_effect=AssertionError("factory must not run"))
    registry = MarketplaceAdapterRegistry({Marketplace.AVITO: ProviderRegistration(capability=AVITO_CAPABILITY, factory=factory)})
    with pytest.raises(UnsupportedCapabilityError):
        registry.review_questions(Marketplace.AVITO)
    factory.assert_not_called()
```

- [x] **Step 2: Run the RED tests**

Run from `apps/api`:

```powershell
python -m pytest app/tests/test_adapter_registry_boundaries.py app/tests/test_marketplace_capability_dispatch.py -q
```

Expected: collection fails because the protocols, capabilities, and registry do not exist.

- [x] **Step 3: Introduce typed contracts beside the existing Wildberries ABC**

```python
MarketplaceErrorCode = Literal[
    "invalid_credentials",
    "insufficient_scope",
    "marketplace_validation_error",
    "marketplace_not_found",
    "rate_limited",
    "marketplace_unavailable",
    "network_timeout",
    "network_error",
    "malformed_payload",
    "unsupported_capability",
]

T = TypeVar("T")

@dataclass(frozen=True, slots=True)
class AdapterResult(Generic[T]):
    ok: bool
    data: T | None = None
    error_code: MarketplaceErrorCode | None = None
    error_message_safe: str | None = None
    retry_after_seconds: int | None = None

@dataclass(frozen=True, slots=True)
class MarketplacePage(Generic[T]):
    items: tuple[T, ...]
    next_cursor: str | None

@dataclass(frozen=True, slots=True)
class CredentialValidation:
    scopes: tuple[str, ...]
    account_reference: str | None

@dataclass(frozen=True, slots=True)
class NormalizedProduct:
    external_id: str
    sku: str | None
    name: str
    brand: str | None
    category: str | None
    image_url: str | None
    product_url: str | None
    metadata: dict[str, object]

@dataclass(frozen=True, slots=True)
class NormalizedMessage:
    external_id: str
    message_type: MessageType
    rating: int | None
    customer_display_name: str | None
    customer_text: str
    customer_photos: tuple[str, ...]
    marketplace_created_at: datetime
    product: NormalizedProduct | None
    metadata: dict[str, object]

@dataclass(frozen=True, slots=True)
class ProviderMessageContext:
    message_type: MessageType
    external_id: str
    marketplace_created_at: datetime
    metadata: dict[str, object]

@dataclass(frozen=True, slots=True)
class ExistingReplyResult:
    exists: bool
    provider_reply_id: str | None = None
    provider_state: str | None = None

@dataclass(frozen=True, slots=True)
class ProviderWriteReceipt:
    provider_reply_id: str

@runtime_checkable
class CredentialAdapter(Protocol):
    marketplace: Marketplace
    async def validate_credentials(self, credential: str, seller_id: str | None) -> AdapterResult[CredentialValidation]: ...

@runtime_checkable
class ReviewQuestionAdapter(CredentialAdapter, Protocol):
    async def fetch_page(self, credential: str, seller_id: str | None, stream: MarketplaceStream, cursor: str | None) -> AdapterResult[MarketplacePage[NormalizedMessage]]: ...
    async def find_existing_reply(self, credential: str, seller_id: str | None, context: ProviderMessageContext) -> AdapterResult[ExistingReplyResult]: ...
    async def send_reply(self, credential: str, seller_id: str | None, context: ProviderMessageContext, text: str) -> AdapterResult[ProviderWriteReceipt]: ...
```

Keep these value objects immutable and do not add a raw-provider-body field. `NormalizedMessage.product` remains `NormalizedProduct | None` so Avito does not fabricate a product.

Keep the existing `MarketplaceAdapter` ABC only until Task 5 so every intermediate commit remains runnable. Task 5 migrates Wildberries and all active callers, then deletes the broad ABC in the same GREEN commit; do not add another compatibility alias.

In `conversation.py`, define immutable `ConversationThread` and `ConversationMessage` values and this exact protocol:

```python
@runtime_checkable
class ConversationAdapter(CredentialAdapter, Protocol):
    async def fetch_chats(self, credential: str, seller_id: str, cursor: str | None) -> AdapterResult[MarketplacePage[ConversationThread]]: ...
    async def fetch_chat_messages(self, credential: str, seller_id: str, chat_id: str, cursor: str | None) -> AdapterResult[MarketplacePage[ConversationMessage]]: ...
    async def find_existing_chat_reply(self, credential: str, seller_id: str, context: ProviderMessageContext) -> AdapterResult[ExistingReplyResult]: ...
    async def send_chat_message(self, credential: str, seller_id: str, context: ProviderMessageContext, text: str) -> AdapterResult[ProviderWriteReceipt]: ...
```

- [x] **Step 4: Implement immutable capabilities and lifecycle registry**

```python
@dataclass(frozen=True, slots=True)
class MarketplaceCapability:
    marketplace: Marketplace
    streams: frozenset[MarketplaceStream]
    reply_types: frozenset[MessageType]

    def supports_stream(self, stream: MarketplaceStream) -> bool:
        return stream in self.streams

class MarketplaceAdapterRegistry:
    def credentials(self, marketplace: Marketplace) -> CredentialAdapter:
        return self._resolve(marketplace, CredentialAdapter)

    def review_questions(self, marketplace: Marketplace) -> ReviewQuestionAdapter:
        self._require_streams(marketplace, frozenset({MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}))
        return self._resolve(marketplace, ReviewQuestionAdapter)

    def conversations(self, marketplace: Marketplace) -> ConversationAdapter:
        self._require_streams(marketplace, frozenset({MarketplaceStream.CHATS}))
        return self._resolve(marketplace, ConversationAdapter)
```

The three registry methods validate capability first, instantiate once, verify the runtime-checkable protocol, and raise `UnsupportedCapabilityError(code="unsupported_capability")` on mismatch.

- [x] **Step 5: Run focused tests and strict static checks GREEN**

```powershell
python -m pytest app/tests/test_adapter_registry_boundaries.py app/tests/test_marketplace_capability_dispatch.py -q
python -m ruff check app/adapters/base.py app/adapters/conversation.py app/adapters/capabilities.py app/adapters/registry.py app/services/reply_execution_service.py app/tests/test_adapter_registry_boundaries.py app/tests/test_marketplace_capability_dispatch.py
python -m pyright app/adapters
```

- [x] **Step 6: Commit the contract boundary**

```powershell
git add -- apps/api/app/adapters/base.py apps/api/app/adapters/conversation.py apps/api/app/adapters/capabilities.py apps/api/app/adapters/registry.py apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_adapter_registry_boundaries.py apps/api/app/tests/test_marketplace_capability_dispatch.py
git diff --cached --check
git commit -m "refactor(api): define marketplace capability boundaries"
```

### Task 2: Add reusable provider clients and bounded read retry

**Files:**
- Create: `apps/api/app/adapters/http.py`
- Modify: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/adapters/wildberries.py`
- Modify: `apps/api/app/core/lifecycle.py`
- Create: `apps/api/app/tests/marketplace_fixtures.py`
- Create: `apps/api/app/tests/test_marketplace_http_policy.py`

**Interfaces:**
- Produces: `MarketplaceHttpClients`, `ReadRetryPolicy`, `parse_retry_after()`, and `request_read_with_retry()`.
- Produces: `request.app.state.marketplace_registry` initialized during FastAPI lifespan.
- Produces: synthetic `RequestRecorder`, `SequenceTransport`, `response()`, and `request_json()` helpers that require an explicit `MockTransport`.
- Consumes: fixed provider base URLs and `httpx.AsyncClient` instances.

- [x] **Step 1: Write RED tests for bounded retry and SSRF-safe clients**

First add `app/tests/marketplace_fixtures.py`. Its recorder accepts only a finite response sequence, records `httpx.Request` objects, and raises `AssertionError` on an unexpected extra request. It returns an `httpx.AsyncClient` with `httpx.MockTransport`, a synthetic base URL supplied by the test, and redirects disabled.

```python
@pytest.mark.asyncio
async def test_read_retry_honors_bounded_retry_after() -> None:
    transport = SequenceTransport([response(429, headers={"Retry-After": "2"}), response(200, json={"ok": True})])
    delays: list[float] = []
    async def record_sleep(delay: float) -> None:
        delays.append(delay)
    result = await request_read_with_retry(client(transport), "GET", "/resource", policy=ReadRetryPolicy(max_attempts=2, max_retry_after_seconds=5), sleep=record_sleep)
    assert result.status_code == 200
    assert delays == [2.0]


def test_provider_client_rejects_absolute_request_target() -> None:
    with pytest.raises(InvalidProviderPath):
        ensure_relative_provider_path("https://attacker.invalid/steal")
```

Also cover negative, non-numeric, and excessive `Retry-After`, permanent 4xx without retry, timeout exhaustion, redirects disabled, and a total-attempt cap.

- [x] **Step 2: Run RED**

```powershell
python -m pytest app/tests/test_marketplace_http_policy.py -q
```

- [x] **Step 3: Implement the retry policy without retrying writes**

```python
@dataclass(frozen=True, slots=True)
class ReadRetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 2.0
    max_retry_after_seconds: int = 30

async def request_read_with_retry(client: httpx.AsyncClient, method: Literal["GET", "POST"], path: str, *, policy: ReadRetryPolicy, sleep: Sleep) -> httpx.Response:
    ensure_relative_provider_path(path)
    for attempt in range(1, policy.max_attempts + 1):
        retry_response: httpx.Response | None = None
        try:
            response = await client.request(method, path)
        except (httpx.TimeoutException, httpx.RequestError):
            if attempt == policy.max_attempts:
                raise
        else:
            if response.status_code not in {429, 500, 502, 503, 504} or attempt == policy.max_attempts:
                return response
            retry_response = response
        await sleep(compute_delay(retry_response, attempt, policy))
    raise RuntimeError("unreachable bounded retry state")
```

Keep write requests in provider adapters as direct single attempts. Do not expose a generic write-retry helper.

- [x] **Step 4: Own clients and registry in the application lifespan**

```python
@asynccontextmanager
async def application_lifespan(app: FastAPI) -> AsyncGenerator[None]:
    clients = MarketplaceHttpClients.create()
    app.state.marketplace_registry = create_marketplace_registry(clients)
    try:
        yield
    finally:
        await clients.aclose()
        await engine.dispose()
```

Use fixed `base_url`, `follow_redirects=False`, explicit `httpx.Timeout`, and bounded `httpx.Limits` for each client.

- [x] **Step 5: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_marketplace_http_policy.py app/tests/test_health.py -q
python -m ruff check app/adapters/http.py app/adapters/registry.py app/adapters/wildberries.py app/core/lifecycle.py app/tests/marketplace_fixtures.py app/tests/test_marketplace_http_policy.py
python -m pyright app
git add -- apps/api/app/adapters/http.py apps/api/app/adapters/registry.py apps/api/app/adapters/wildberries.py apps/api/app/core/lifecycle.py apps/api/app/tests/marketplace_fixtures.py apps/api/app/tests/test_marketplace_http_policy.py
git commit -m "feat(api): manage marketplace HTTP clients"
```

### Task 3: Add generic sync-state persistence and leases

**Files:**
- Create: `apps/api/app/models/marketplace_sync_state.py`
- Modify: `apps/api/app/models/marketplace_account.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/alembic/versions/20260912_0012_marketplace_sync_states.py`
- Create: `apps/api/app/services/marketplace_sync_state_service.py`
- Create: `apps/api/app/tests/test_marketplace_sync_state.py`
- Create: `apps/api/app/tests/test_marketplace_sync_migration.py`

**Interfaces:**
- Produces: `MarketplaceSyncState`, `SyncStateStatus`, and `MarketplaceSyncStateService`.
- Produces: `acquire(state_id, owner, now, lease_for)`, `renew(...)`, `complete_page(...)`, `fail(...)`, and `release(...)`.
- Consumes: `MarketplaceStream` from Task 1, current migration head `20260911_0011`, and PostgreSQL atomic updates.

- [x] **Step 1: Write RED model and lease contracts**

```python
@pytest.mark.asyncio
async def test_active_lease_cannot_be_stolen(postgres_session: AsyncSession) -> None:
    first = await service.acquire(account_id, MarketplaceStream.REVIEWS, "worker-a", now, timedelta(minutes=2))
    second = await service.acquire(account_id, MarketplaceStream.REVIEWS, "worker-b", now + timedelta(seconds=1), timedelta(minutes=2))
    assert first is not None
    assert second is None


@pytest.mark.asyncio
async def test_cursor_advances_only_for_current_lease_owner(postgres_session: AsyncSession) -> None:
    with pytest.raises(LeaseOwnershipError):
        await service.complete_page(state_id, owner="worker-b", current_cursor=None, next_cursor="page-2", now=now)
```

- [x] **Step 2: Run RED**

```powershell
python -m pytest app/tests/test_marketplace_sync_state.py app/tests/test_marketplace_sync_migration.py -q
```

- [x] **Step 3: Create the ORM model and database constraints**

```python
class MarketplaceSyncState(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "marketplace_sync_states"
    __table_args__ = (
        UniqueConstraint("marketplace_account_id", "stream", name="uq_marketplace_sync_states_account_stream"),
        CheckConstraint("stream IN ('reviews','questions','chats')", name="ck_marketplace_sync_states_stream"),
        CheckConstraint("status IN ('idle','leased','error','paused')", name="ck_marketplace_sync_states_status"),
        CheckConstraint("consecutive_failures >= 0", name="ck_marketplace_sync_states_failures_nonnegative"),
    )
```

Include tenant organization ID, account foreign key with cascade, cursor, allowlisted metadata JSON, scheduling/lease fields, counters, safe last error code, and attempt/success timestamps. Migration defaults must permit existing accounts and be removed where ORM ownership is preferable.

- [x] **Step 4: Implement atomic lease acquisition**

```python
statement = (
    update(MarketplaceSyncState)
    .where(
        MarketplaceSyncState.id == state_id,
        or_(
            MarketplaceSyncState.status != SyncStateStatus.LEASED.value,
            MarketplaceSyncState.lease_expires_at <= now,
        ),
    )
    .values(status="leased", lease_owner=owner, lease_expires_at=now + lease_for, last_attempt_at=now)
    .returning(MarketplaceSyncState)
)
```

All renewal, page completion, failure, and release updates include `lease_owner == owner` in the `WHERE` clause and require exactly one returned row.

- [x] **Step 5: Verify contracts, migration head, static gates, and commit**

```powershell
python -m pytest app/tests/test_marketplace_sync_state.py app/tests/test_marketplace_sync_migration.py -q
python -m pytest -q
python -m alembic heads
python -m ruff check app/models/marketplace_sync_state.py app/services/marketplace_sync_state_service.py app/tests/test_marketplace_sync_state.py app/tests/test_marketplace_sync_migration.py alembic/versions/20260912_0012_marketplace_sync_states.py
npx --yes pyright@1.1.411 --pythonpath '.\.venv\Scripts\python.exe' app
git add -- apps/api/app/models/marketplace_account.py apps/api/app/models/marketplace_sync_state.py apps/api/app/models/__init__.py apps/api/alembic/versions/20260912_0012_marketplace_sync_states.py apps/api/app/services/marketplace_sync_state_service.py apps/api/app/tests/test_marketplace_sync_state.py apps/api/app/tests/test_marketplace_sync_migration.py
git commit -m "feat(api): add marketplace sync leases"
```

The real PostgreSQL `upgrade -> downgrade -> upgrade` cycle remains an explicit Task 15 gate and must run against PostgreSQL; unit migration operation tests or SQLite are not substitutes.

### Task 4: Make ingestion race-safe and metadata bounded

**Files:**
- Create: `apps/api/app/services/marketplace_ingest_service.py`
- Modify: `apps/api/app/services/sync_service.py`
- Create: `apps/api/app/tests/test_marketplace_ingest_concurrency.py`
- Create: `apps/api/app/tests/test_marketplace_metadata_redaction.py`

**Interfaces:**
- Produces: `MarketplaceIngestService.ingest_page(account, page, now) -> IngestStats`.
- Consumes: `NormalizedMessage`, `NormalizedProduct | None`, named product/message uniqueness constraints, and one caller-owned page transaction.

- [ ] **Step 1: Write RED duplicate and metadata tests**

```python
@pytest.mark.asyncio
async def test_concurrent_duplicate_message_returns_single_winner(postgres_factory: SessionFactory) -> None:
    results = await asyncio.gather(ingest_once(postgres_factory), ingest_once(postgres_factory))
    assert sum(result.created_messages for result in results) == 1
    assert await count_messages(postgres_factory, external_id="synthetic-review-1") == 1


def test_metadata_allowlist_drops_secret_and_raw_payload() -> None:
    assert sanitize_message_metadata("ozon", {"source": "ozon.reviews", "status": "NEW", "Api-Key": "secret", "raw": {"secret": "x"}}) == {
        "source": "ozon.reviews",
        "status": "NEW",
    }
```

- [ ] **Step 2: Run RED**

```powershell
python -m pytest app/tests/test_marketplace_ingest_concurrency.py app/tests/test_marketplace_metadata_redaction.py -q
```

- [ ] **Step 3: Implement savepoint-based conflict resolution**

```python
async def _insert_or_get_message(self, values: MessageValues) -> tuple[CustomerMessage, bool]:
    try:
        async with self.session.begin_nested():
            message = CustomerMessage(**values.as_dict())
            self.session.add(message)
            await self.session.flush()
        return message, True
    except IntegrityError as exc:
        if constraint_name(exc) != "uq_customer_messages_external":
            raise
    winner = await self.session.scalar(select(CustomerMessage).where(*values.identity_predicates()))
    if winner is None:
        raise RuntimeError("unique message winner was not visible after conflict")
    return winner, False
```

Use the same pattern for `uq_products_external`. Do not call `rollback()` on the outer page transaction. Reject a normalized review/question without a product identity; permit `product=None` for chat.

- [ ] **Step 4: Route current sync persistence through the ingest service**

Remove select-before-insert duplicate handling from `sync_service.py`. Keep authorization and `SyncJob` audit behavior, but make page persistence a single `MarketplaceIngestService.ingest_page()` call.

- [ ] **Step 5: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_marketplace_ingest_concurrency.py app/tests/test_marketplace_metadata_redaction.py app/tests/test_wildberries_adapter_normalization.py -q
python -m ruff check app/services/marketplace_ingest_service.py app/services/sync_service.py app/tests/test_marketplace_ingest_concurrency.py app/tests/test_marketplace_metadata_redaction.py
python -m pyright app/services/marketplace_ingest_service.py app/services/sync_service.py
git add -- apps/api/app/services/marketplace_ingest_service.py apps/api/app/services/sync_service.py apps/api/app/tests/test_marketplace_ingest_concurrency.py apps/api/app/tests/test_marketplace_metadata_redaction.py
git commit -m "fix(api): make marketplace ingestion race safe"
```

### Task 5: Migrate Wildberries to the common sync and reply runners

**Files:**
- Modify: `apps/api/app/adapters/wildberries.py`
- Modify: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/services/sync_service.py`
- Create: `apps/api/app/services/scheduled_sync_service.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Modify: `apps/api/app/tests/test_wildberries_adapter_normalization.py`
- Modify: `apps/api/app/tests/test_wildberries_answer_status.py`
- Create: `apps/api/app/tests/test_wildberries_adapter_contract.py`
- Create: `apps/api/app/tests/test_marketplace_sync_pagination.py`
- Create: `apps/api/app/tests/test_wildberries_reply_execution_safety.py`

**Interfaces:**
- Produces: `WildberriesAdapter(ReviewQuestionAdapter)` backed by an injected client.
- Produces: `ScheduledSyncService.run_stream(state_id, owner, now) -> StreamRunResult`.
- Produces: the provider-neutral outbound state machine used by later Ozon, Yandex Market, and Avito tasks.
- Consumes: registry, lease service, ingest service, and cursor-safe page contract.

- [ ] **Step 1: Write exact RED request and pagination tests**

```python
@pytest.mark.asyncio
async def test_wildberries_review_page_uses_exact_contract() -> None:
    recorder = RequestRecorder(response(200, json={"data": {"feedbacks": []}}))
    adapter = WildberriesAdapter(client=recorder.client("https://feedbacks-api.wildberries.ru"))
    result = await adapter.fetch_page("synthetic-token", None, MarketplaceStream.REVIEWS, "50")
    request = recorder.only_request
    assert request.method == "GET"
    assert request.url.path == "/api/v1/feedbacks"
    assert dict(request.url.params) == {"isAnswered": "false", "take": "50", "skip": "50"}
    assert request.headers["Authorization"] == "synthetic-token"
    assert result.ok is True
```

Add malformed success, invalid cursor, repeated cursor, page cap, 401/403/404/429/5xx, and no raw-body leakage cases.

- [ ] **Step 2: Run RED**

```powershell
python -m pytest app/tests/test_wildberries_adapter_contract.py app/tests/test_marketplace_sync_pagination.py -q
```

- [ ] **Step 3: Implement strict Wildberries pages and normalization**

Require a documented response object and list at the exact data location. Derive the next offset only when `len(items) == 50`; reject non-decimal/negative/oversized cursors. Required external ID, product ID, and timestamp parse failures return `malformed_payload`; they do not substitute current time or `unknown` identity.

- [ ] **Step 4: Implement one bounded stream loop**

```python
seen: set[str | None] = set()
cursor = state.cursor
for page_number in range(1, MAX_PAGES_PER_RUN + 1):
    if cursor in seen:
        return await self._fail(state, owner, "malformed_payload", now)
    seen.add(cursor)
    fetched = await adapter.fetch_page(credential, account.seller_id, stream, cursor)
    if not fetched.ok or fetched.data is None:
        return await self._record_adapter_failure(state, owner, fetched, now)
    async with self.session.begin():
        await self.ingest.ingest_page(account, fetched.data, now)
        await self.states.complete_page(state.id, owner, cursor, fetched.data.next_cursor, now)
    cursor = fetched.data.next_cursor
    if cursor is None:
        return await self._complete_cycle(state, owner, now)
return await self._fail(state, owner, "malformed_payload", now)
```

Decrypt only after the lease is acquired. Provider network calls occur outside an open database transaction.

- [ ] **Step 5: Route manual sync through the same runner**

`MarketplaceSyncService.request_sync()` creates or loads the provider's supported stream states and calls/enqueues `ScheduledSyncService.run_stream()` rather than running a separate first-page implementation.

- [ ] **Step 6: Write RED Wildberries reply-state tests**

```python
@pytest.mark.asyncio
async def test_wildberries_timeout_after_send_is_not_automatically_retried() -> None:
    adapter = FakeWildberriesAdapter(preflight=absent(), send=timeout_failure())
    result = await execute_ready_reply(adapter=adapter, message_type=MessageType.REVIEW)
    assert adapter.send_calls == 1
    assert result.retryable is False
    assert result.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.reply.metadata_json["provider_write_ambiguity"]["active"] is True
```

Also cover existing answer convergence, preflight read retry exhaustion without sending, strict successful response proof, permanent provider rejection, and concurrent execution of the same idempotency key.

- [ ] **Step 7: Implement the provider-neutral outbound state machine**

Persist `sending`, increment the attempt identity, and commit before provider I/O. Run Wildberries detail preflight, send at most once, and finalize in a fresh transaction guarded by reply ID, attempt count, and idempotency key. Treat timeout, request failure after dispatch, or malformed 2xx as `manual_review_required` with safe allowlisted ambiguity metadata.

- [ ] **Step 8: Run GREEN and commit Slice 1**

```powershell
python -m pytest app/tests/test_wildberries_adapter_contract.py app/tests/test_wildberries_adapter_normalization.py app/tests/test_wildberries_answer_status.py app/tests/test_wildberries_reply_execution_safety.py app/tests/test_marketplace_sync_pagination.py app/tests/test_marketplace_sync_state.py app/tests/test_marketplace_ingest_concurrency.py app/tests/test_reply_idempotency.py -q
python -m ruff check app/adapters app/services/sync_service.py app/services/scheduled_sync_service.py app/services/reply_execution_service.py app/tests/test_wildberries_adapter_contract.py app/tests/test_wildberries_reply_execution_safety.py app/tests/test_marketplace_sync_pagination.py
python -m pyright app
git add -- apps/api/app/adapters/wildberries.py apps/api/app/adapters/registry.py apps/api/app/services/sync_service.py apps/api/app/services/scheduled_sync_service.py apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_wildberries_adapter_contract.py apps/api/app/tests/test_wildberries_adapter_normalization.py apps/api/app/tests/test_wildberries_answer_status.py apps/api/app/tests/test_wildberries_reply_execution_safety.py apps/api/app/tests/test_marketplace_sync_pagination.py
git commit -m "feat(wildberries): use safe sync and reply pipelines"
```

## Slice 2 — Ozon

### Task 6: Implement Ozon account and stream contracts

**Files:**
- Create: `apps/api/app/adapters/ozon.py`
- Modify: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/services/marketplace_account_service.py`
- Create: `apps/api/app/tests/test_ozon_account_contract.py`
- Create: `apps/api/app/tests/test_ozon_adapter_contract.py`
- Create: `apps/api/app/tests/test_ozon_scheduled_pagination.py`

**Interfaces:**
- Produces: `OzonAdapter(ReviewQuestionAdapter)` with `POST /v1/roles`, review and question pages, normalization, and normalized errors.
- Consumes: Ozon `seller_id` as Client-Id, encrypted API key, shared Ozon HTTP client, common page/result types.

- [ ] **Step 1: Revalidate all six Ozon method paths and role fields against current official Seller API documentation**

Record the inspection date and official URLs in the task commit message body or `docs/integrations/marketplace-contract-evidence.md`. If current documentation changed a path or request field, implement the current documented contract and update the approved spec in the same commit with the source.

- [ ] **Step 2: Write RED account/scope tests**

```python
@pytest.mark.asyncio
async def test_ozon_validation_sends_client_id_and_api_key_only_in_headers() -> None:
    recorder = RequestRecorder(response(200, json={"roles": ["ReadReview", "CreateReviewComment"]}))
    result = await OzonAdapter(recorder.client(OZON_BASE_URL)).validate_credentials("synthetic-api-key", "100200")
    request = recorder.only_request
    assert request.url.path == "/v1/roles"
    assert request.headers["Client-Id"] == "100200"
    assert request.headers["Api-Key"] == "synthetic-api-key"
    assert "synthetic-api-key" not in request.url.query.decode()
    assert result.ok is True
```

Cover invalid Client-Id, missing review scopes, missing question scopes, response-body redaction, and inactive-account behavior.

- [ ] **Step 3: Write RED page and normalization matrices**

Assert exact bodies for `/v2/review/list` and `/v1/question/list`, cursor progression, terminal `has_next`, repeated cursor rejection, malformed record rejection, and metadata allowlisting.

- [ ] **Step 4: Implement Ozon contracts**

Use strict mapping helpers that return a failed `AdapterResult` when required arrays, IDs, timestamps, cursor fields, or SKU types are invalid. Map 400/401/402/403/404/429/5xx into the common vocabulary; subscription-only 402 maps to `insufficient_scope` with a safe message because the public vocabulary has no billing-provider code.

- [ ] **Step 5: Route account validation through `registry.credentials()`**

```python
adapter = self.registry.credentials(Marketplace(account.marketplace))
credential = self.credentials.decrypt(account.credentials_encrypted)
result = await adapter.validate_credentials(credential, account.seller_id)
```

The service validates membership/role before decryption and stores only allowlisted scope names and safe status.

- [ ] **Step 6: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_ozon_account_contract.py app/tests/test_ozon_adapter_contract.py app/tests/test_ozon_scheduled_pagination.py app/tests/test_credentials_service.py -q
python -m ruff check app/adapters/ozon.py app/adapters/registry.py app/services/marketplace_account_service.py app/tests/test_ozon_account_contract.py app/tests/test_ozon_adapter_contract.py app/tests/test_ozon_scheduled_pagination.py
python -m pyright app
git add -- apps/api/app/adapters/ozon.py apps/api/app/adapters/registry.py apps/api/app/services/marketplace_account_service.py apps/api/app/tests/test_ozon_account_contract.py apps/api/app/tests/test_ozon_adapter_contract.py apps/api/app/tests/test_ozon_scheduled_pagination.py docs/integrations/marketplace-contract-evidence.md
git commit -m "feat(ozon): integrate review and question sync"
```

### Task 7: Add Ozon reply preflight and one-shot sending

**Files:**
- Modify: `apps/api/app/adapters/ozon.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_ozon_reply_safety.py`
- Create: `apps/api/app/tests/test_reply_dispatch_recovery.py`

**Interfaces:**
- Produces: Ozon implementations of `find_existing_reply()` and `send_reply()`.
- Produces: provider-neutral execution branches for externally answered, sent, terminal failure, retryable preflight failure, and ambiguous write.

- [ ] **Step 1: Write RED preflight/send tests**

```python
@pytest.mark.asyncio
async def test_ozon_timeout_after_write_requires_manual_review_without_retry() -> None:
    adapter = FakeOzonAdapter(preflight=absent(), send=timeout_failure())
    result = await execute_ready_reply(adapter=adapter, message_type=MessageType.REVIEW)
    assert adapter.send_calls == 1
    assert result.retryable is False
    assert result.error_code == "network_timeout"
    assert result.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
    assert result.reply.metadata_json["provider_write_ambiguity"]["active"] is True
```

Also cover existing seller reply, multi-page preflight, strict provider reply ID proof, malformed 2xx, permanent 4xx, and read-only retry exhaustion.

- [ ] **Step 2: Run RED**

```powershell
python -m pytest app/tests/test_ozon_reply_safety.py app/tests/test_reply_dispatch_recovery.py -q
```

- [ ] **Step 3: Implement exact Ozon preflight and writes**

Use `/v1/review/comment/list` and `/v1/question/answer/list` with bounded pages. Send through `/v1/review/comment/create` or `/v1/question/answer/create`. Validate documented success ID/status fields before returning `ProviderWriteReceipt`.

- [ ] **Step 4: Refactor reply execution into typed branches**

```python
if message.type == MessageType.CHAT.value:
    return await self._execute_conversation_reply(reply, message, account, credential)
return await self._execute_review_question_reply(reply, message, account, credential)
```

Each branch obtains only its capability-specific adapter. Persist `sending` and commit before preflight/network I/O; terminal reconciliation occurs in a fresh short transaction guarded by reply ID, attempt count, and idempotency key.

- [ ] **Step 5: Run GREEN and commit Slice 2**

```powershell
python -m pytest app/tests/test_ozon_reply_safety.py app/tests/test_reply_dispatch_recovery.py app/tests/test_reply_idempotency.py app/tests/test_manual_reply_safety.py -q
python -m ruff check app/adapters/ozon.py app/services/reply_execution_service.py app/tests/test_ozon_reply_safety.py app/tests/test_reply_dispatch_recovery.py
python -m pyright app
git add -- apps/api/app/adapters/ozon.py apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_ozon_reply_safety.py apps/api/app/tests/test_reply_dispatch_recovery.py
git commit -m "feat(ozon): send replies with ambiguity protection"
```

## Slice 3 — Yandex Market

### Task 8: Implement Yandex Market reviews and questions

**Files:**
- Create: `apps/api/app/adapters/yandex_market.py`
- Modify: `apps/api/app/adapters/registry.py`
- Create: `apps/api/app/tests/test_yandex_market_adapter_contract.py`
- Create: `apps/api/app/tests/test_yandex_market_adapter_normalization.py`
- Create: `apps/api/app/tests/test_yandex_market_service_contract.py`

**Interfaces:**
- Produces: `YandexMarketAdapter(ReviewQuestionAdapter)` and current documented credential/access validation.
- Consumes: business ID, API key, shared Yandex client, page token capped at 50.

- [ ] **Step 1: Revalidate Yandex credential probe, goods-feedback, goods-question, answer, and update contracts against current official Partner API documentation**

Do not use `/v2/auth/token` unless the current official reference defines it. Use a documented read operation that proves the business and Customer communication permission.

- [ ] **Step 2: Write RED exact-request and error tests**

```python
@pytest.mark.asyncio
async def test_yandex_question_page_sends_business_scoped_request() -> None:
    recorder = RequestRecorder(response(200, json={"status": "OK", "result": {"questions": [], "paging": {}}}))
    result = await YandexMarketAdapter(recorder.client(YANDEX_BASE_URL)).fetch_page("synthetic-key", "42", MarketplaceStream.QUESTIONS, None)
    request = recorder.only_request
    assert request.method == "POST"
    assert request.url.path == "/v1/businesses/42/goods-questions"
    assert dict(request.url.params) == {"limit": "50"}
    assert request_json(request) == {"needAnswer": True}
    assert result.ok is True
```

Cover invalid business ID, `status=ERROR` on 2xx, 400/401/403/404/420/429/5xx, malformed paging, and cursor cycles.

- [ ] **Step 3: Implement strict normalization and metadata allowlists**

Reviews require feedback identity and offer identity. Questions require question identity; use documented offer identity when present and reject a review/question that cannot satisfy the current non-chat product relation. Parse timestamps with timezone and fail the page on invalid required fields.

- [ ] **Step 4: Run GREEN and commit core Yandex contract**

```powershell
python -m pytest app/tests/test_yandex_market_adapter_contract.py app/tests/test_yandex_market_adapter_normalization.py app/tests/test_yandex_market_service_contract.py -q
python -m ruff check app/adapters/yandex_market.py app/adapters/registry.py app/tests/test_yandex_market_adapter_contract.py app/tests/test_yandex_market_adapter_normalization.py app/tests/test_yandex_market_service_contract.py
python -m pyright app
git add -- apps/api/app/adapters/yandex_market.py apps/api/app/adapters/registry.py apps/api/app/tests/test_yandex_market_adapter_contract.py apps/api/app/tests/test_yandex_market_adapter_normalization.py apps/api/app/tests/test_yandex_market_service_contract.py docs/integrations/marketplace-contract-evidence.md
git commit -m "feat(yandex-market): integrate review and question contracts"
```

### Task 9: Add resumable Yandex question backfill and reconciliation

**Files:**
- Create: `apps/api/app/services/yandex_question_policy.py`
- Modify: `apps/api/app/adapters/yandex_market.py`
- Modify: `apps/api/app/services/scheduled_sync_service.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_yandex_question_sync_policy.py`
- Create: `apps/api/app/tests/test_yandex_scheduled_backfill.py`
- Create: `apps/api/app/tests/test_yandex_question_reply_safety.py`
- Create: `apps/api/app/tests/test_yandex_question_background_reconciliation.py`

**Interfaces:**
- Produces: `YandexQuestionCheckpoint`, `initial_checkpoint()`, `record_page()`, and `advance_window()`.
- Produces: reconciliation states `ABSENT`, `PUBLISHED`, `UNMODERATED`, `BANNED`, `DELETED`, and `UNKNOWN`.
- Consumes: versioned allowlisted state metadata, 28-day windows, one-day overlap, fixed twelve-month horizon.

- [ ] **Step 1: Write RED pure-policy tests**

```python
def test_windows_move_newest_to_oldest_with_one_day_overlap() -> None:
    checkpoint = initial_checkpoint(date(2026, 9, 12))
    assert (checkpoint.date_from, checkpoint.date_to) == (date(2026, 8, 16), date(2026, 9, 12))
    next_window = advance_window(record_page(checkpoint, None))
    assert next_window.date_to == date(2026, 8, 16)
    assert next_window.date_from == date(2026, 7, 20)
```

Cover same-window page tokens, frozen horizon across restarts, malformed persisted metadata, terminal completion, and exact twelve-month lower bound.

- [ ] **Step 2: Write RED scheduled backfill tests**

Assert window metadata and page token commit with the ingested page, cursor isolation between backfill and incremental mode, and no cursor advancement on normalization/database failure.

- [ ] **Step 3: Implement policy and scheduler integration**

```python
if account.marketplace == Marketplace.YANDEX_MARKET.value and stream is MarketplaceStream.QUESTIONS:
    checkpoint = load_checkpoint(state.metadata_json)
    fetched = await adapter.fetch_questions_window(
        credential,
        seller_id=account.seller_id,
        date_from=checkpoint.date_from,
        date_to=checkpoint.date_to,
        cursor=checkpoint.page_token,
    )
```

Persist the versioned checkpoint only inside the successful page transaction. After backfill completion, normal incremental questions use `state.cursor`.

- [ ] **Step 4: Write and implement reply reconciliation tests**

```python
@pytest.mark.parametrize("state", ["UNMODERATED", "BANNED", "DELETED", "UNKNOWN"])
@pytest.mark.asyncio
async def test_non_publishable_yandex_state_blocks_write(state: str) -> None:
    adapter = FakeYandexAdapter(reconciliation=state)
    result = await execute_question_reply(adapter)
    assert adapter.send_calls == 0
    assert result.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
```

Accept `canModify=True` as ownership when author type is absent. Conflicting ownership, multiple seller answers, missing answer IDs, and unknown statuses resolve to `UNKNOWN`. A send timeout/network failure/malformed 2xx sets the common ambiguity marker and cannot auto-retry.

- [ ] **Step 5: Add bounded background reconciliation**

After a complete question cycle, query at most 25 tenant/account-scoped `needs_reply` Yandex questions and reconcile by exact ID. Only `PUBLISHED` moves the message to `answered`; no background reconciliation path sends a reply.

- [ ] **Step 6: Run GREEN and commit Slice 3**

```powershell
python -m pytest app/tests/test_yandex_question_sync_policy.py app/tests/test_yandex_scheduled_backfill.py app/tests/test_yandex_question_reply_safety.py app/tests/test_yandex_question_background_reconciliation.py app/tests/test_yandex_market_adapter_contract.py -q
python -m ruff check app/services/yandex_question_policy.py app/adapters/yandex_market.py app/services/scheduled_sync_service.py app/services/reply_execution_service.py app/tests/test_yandex_question_sync_policy.py app/tests/test_yandex_scheduled_backfill.py app/tests/test_yandex_question_reply_safety.py app/tests/test_yandex_question_background_reconciliation.py
python -m pyright app
git add -- apps/api/app/services/yandex_question_policy.py apps/api/app/adapters/yandex_market.py apps/api/app/services/scheduled_sync_service.py apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_yandex_question_sync_policy.py apps/api/app/tests/test_yandex_scheduled_backfill.py apps/api/app/tests/test_yandex_question_reply_safety.py apps/api/app/tests/test_yandex_question_background_reconciliation.py
git commit -m "feat(yandex-market): add resumable question safety"
```

## Slice 4 — Avito

### Task 10: Implement typed Avito client credentials

**Files:**
- Create: `apps/api/app/adapters/avito_auth.py`
- Create: `apps/api/app/tests/test_avito_client_credentials.py`
- Create: `apps/api/app/tests/test_avito_account_contract.py`

**Interfaces:**
- Produces: `AvitoClientCredentials.parse()`, `AvitoResolvedCredential`, and `AvitoCredentialResolver.resolve()` / `invalidate()`.
- Consumes: versioned encrypted JSON and injected Avito auth client.

- [ ] **Step 1: Revalidate the client-credentials token request and token response against current official Avito documentation**

Record the official source and inspection date. Keep the token endpoint fixed at the documented Avito host.

- [ ] **Step 2: Write RED parser and resolver tests**

```python
def test_avito_credentials_require_exact_versioned_shape() -> None:
    parsed = AvitoClientCredentials.parse('{"version":1,"client_id":"synthetic-client","client_secret":"synthetic-secret"}')
    assert parsed.client_id == "synthetic-client"
    with pytest.raises(InvalidAvitoCredential):
        AvitoClientCredentials.parse('{"version":1,"client_id":"x","client_secret":"y","token":"forbidden"}')


@pytest.mark.asyncio
async def test_concurrent_resolve_coalesces_token_refresh() -> None:
    resolver = resolver_with_blocking_transport()
    first, second = await asyncio.gather(resolver.resolve(SYNTHETIC_CREDENTIAL), resolver.resolve(SYNTHETIC_CREDENTIAL))
    assert first.access_token == second.access_token
    assert resolver.transport.request_count == 1
```

Cover oversized JSON, blank/non-string fields, secret-free exceptions, expiry skew, invalidation, and 401 refresh behavior for reads only.

- [ ] **Step 3: Implement bounded in-process token lifecycle**

Key the cache by credential fingerprint, never raw secret. Protect one fingerprint with an async lock/future, apply expiry skew, cap cached lifetime to provider expiry, and discard failed refresh state. Never persist or log access tokens.

- [ ] **Step 4: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_avito_client_credentials.py app/tests/test_avito_account_contract.py -q
python -m ruff check app/adapters/avito_auth.py app/tests/test_avito_client_credentials.py app/tests/test_avito_account_contract.py
python -m pyright app/adapters/avito_auth.py
git add -- apps/api/app/adapters/avito_auth.py apps/api/app/tests/test_avito_client_credentials.py apps/api/app/tests/test_avito_account_contract.py docs/integrations/marketplace-contract-evidence.md
git commit -m "feat(avito): add client credential lifecycle"
```

### Task 11: Implement Avito chat synchronization and nullable products

**Files:**
- Create: `apps/api/app/adapters/avito.py`
- Modify: `apps/api/app/adapters/registry.py`
- Create: `apps/api/app/services/avito_chat_ingest_service.py`
- Create: `apps/api/app/services/avito_chat_sync_service.py`
- Create: `apps/api/app/tests/test_avito_adapter_contract.py`
- Create: `apps/api/app/tests/test_avito_chat_ingest.py`
- Create: `apps/api/app/tests/test_avito_chat_sync.py`

**Interfaces:**
- Produces: `AvitoAdapter(CredentialAdapter, ConversationAdapter)` with no review/question methods.
- Produces: bounded chat/message pages and inbound `NormalizedMessage(product=None | item product)`.
- Consumes: account user ID, credential resolver, common chats sync state.

- [ ] **Step 1: Revalidate Avito Messenger paths, pagination bounds, message kinds, and 1000-character text limit**

Use only current official Avito sources. Update contract evidence with source URLs and inspection date.

- [ ] **Step 2: Write RED exact-request tests**

```python
@pytest.mark.asyncio
async def test_chat_id_is_one_encoded_path_segment() -> None:
    recorder = RequestRecorder(response(200, json=[]))
    adapter = AvitoAdapter(client=recorder.client(AVITO_BASE_URL), credential_resolver=static_resolver())
    await adapter.fetch_chat_messages(SYNTHETIC_CREDENTIAL, "42", "chat/../secret", limit=100, offset=0)
    assert recorder.only_request.url.path.endswith("/chats/chat%2F%2E%2E%2Fsecret/messages/")
```

Cover exact chat filters, offsets, hard page cap, malformed chats/messages, unknown message kinds, redirects, 400/401/402/403/404/429/5xx, and token redaction.

- [ ] **Step 3: Implement strict chat/message parsing**

Accept documented inbound text messages for customer work. Preserve safe chat/item/customer IDs and timestamps only. Do not persist raw users, contacts, headers, or bodies. A chat without item context yields `product=None`.

- [ ] **Step 4: Implement bounded chat and message traversal**

Traverse chat pages and each changed chat's message pages with separate bounds. Detect repeated chat/message pages. Ingest only inbound messages; use the common unique message constraint for replay. Advance the chats checkpoint only after every message page for the selected chat page commits.

- [ ] **Step 5: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_avito_adapter_contract.py app/tests/test_avito_chat_ingest.py app/tests/test_avito_chat_sync.py app/tests/test_marketplace_ingest_concurrency.py -q
python -m ruff check app/adapters/avito.py app/adapters/registry.py app/services/avito_chat_ingest_service.py app/services/avito_chat_sync_service.py app/tests/test_avito_adapter_contract.py app/tests/test_avito_chat_ingest.py app/tests/test_avito_chat_sync.py
python -m pyright app
git add -- apps/api/app/adapters/avito.py apps/api/app/adapters/registry.py apps/api/app/services/avito_chat_ingest_service.py apps/api/app/services/avito_chat_sync_service.py apps/api/app/tests/test_avito_adapter_contract.py apps/api/app/tests/test_avito_chat_ingest.py apps/api/app/tests/test_avito_chat_sync.py
git commit -m "feat(avito): synchronize messenger chats"
```

### Task 12: Add Avito reply preflight and text sending

**Files:**
- Modify: `apps/api/app/adapters/avito.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_avito_reply_safety.py`

**Interfaces:**
- Produces: `find_existing_chat_reply()` and `send_chat_message()` with strict proof.
- Consumes: inbound chat ID and inbound timestamp from allowlisted message metadata.

- [ ] **Step 1: Write RED preflight and ambiguous-write tests**

```python
@pytest.mark.asyncio
async def test_avito_preflight_blocks_when_newer_outbound_message_exists() -> None:
    adapter = adapter_with_messages([message(direction="out", created=101)])
    result = await adapter.find_existing_chat_reply(SYNTHETIC_CREDENTIAL, "42", chat_context(created=100))
    assert result.data == ExistingReplyResult(exists=True, provider_reply_id=None)


@pytest.mark.asyncio
async def test_avito_malformed_send_success_requires_manual_review() -> None:
    adapter = adapter_with_send_response({"id": "reply-1", "direction": "in", "type": "text", "content": {"text": "hello"}})
    result = await execute_chat_reply(adapter, "hello")
    assert result.retryable is False
    assert result.reply.status == ReplyStatus.MANUAL_REVIEW_REQUIRED.value
```

Cover blank/oversized text, missing chat metadata, bounded preflight pages, exact send body, matching outbound text proof, and no token/text in logs.

- [ ] **Step 2: Implement one-shot text send**

Send `{ "message": {"text": text}, "type": "text" }` once. Accept success only when ID is non-empty, direction is `out`, type is `text`, and returned text exactly matches. Any uncertain result activates the common ambiguity marker.

- [ ] **Step 3: Run GREEN and commit Slice 4**

```powershell
python -m pytest app/tests/test_avito_reply_safety.py app/tests/test_reply_dispatch_recovery.py app/tests/test_manual_reply_safety.py -q
python -m ruff check app/adapters/avito.py app/services/reply_execution_service.py app/tests/test_avito_reply_safety.py
python -m pyright app
git add -- apps/api/app/adapters/avito.py apps/api/app/services/reply_execution_service.py apps/api/app/tests/test_avito_reply_safety.py
git commit -m "feat(avito): send chat replies safely"
```

## Slice 5 — Scheduler, security, and integration closure

### Task 13: Add due-stream worker and recovery scheduling

**Files:**
- Modify: `apps/api/app/services/scheduled_sync_service.py`
- Create: `apps/api/app/workers/marketplace_sync.py`
- Modify: `apps/api/app/workers/__init__.py`
- Create: `apps/api/app/tests/test_marketplace_scheduler_contract.py`

**Interfaces:**
- Produces: `enqueue_due_marketplace_streams(now, limit)` and `marketplace_sync_actor(state_id)`.
- Consumes: due-state selection with row locking/skip-locked, lease service, capability registry, and safe backoff.

- [ ] **Step 1: Write RED scheduler tests**

```python
@pytest.mark.asyncio
async def test_due_selection_is_bounded_and_excludes_active_leases(postgres_session: AsyncSession) -> None:
    selected = await service.claim_due(now=NOW, owner="scheduler-a", limit=25)
    assert len(selected) <= 25
    assert all(state.lease_owner == "scheduler-a" for state in selected)
    assert ACTIVE_LEASE_ID not in {state.id for state in selected}
```

Cover expired lease recovery, permanent credential pause, transient exponential backoff cap, `Retry-After`, independent streams, worker idempotence, and one actor per claimed state.

- [ ] **Step 2: Implement bounded due selection and actor**

Use a PostgreSQL `FOR UPDATE SKIP LOCKED` selection followed by lease writes in one short transaction. The actor accepts only a UUID string, opens its own session, executes one leased state, and relies on the common service for all provider behavior.

- [ ] **Step 3: Run GREEN and commit**

```powershell
python -m pytest app/tests/test_marketplace_scheduler_contract.py app/tests/test_marketplace_sync_pagination.py app/tests/test_yandex_scheduled_backfill.py app/tests/test_avito_chat_sync.py -q
python -m ruff check app/services/scheduled_sync_service.py app/workers/marketplace_sync.py app/workers/__init__.py app/tests/test_marketplace_scheduler_contract.py
python -m pyright app
git add -- apps/api/app/services/scheduled_sync_service.py apps/api/app/workers/marketplace_sync.py apps/api/app/workers/__init__.py apps/api/app/tests/test_marketplace_scheduler_contract.py
git commit -m "feat(api): schedule marketplace stream workers"
```

### Task 14: Close tenant, RBAC, injection, SSRF, and secret boundaries

**Files:**
- Modify: `apps/api/app/services/marketplace_account_service.py`
- Modify: `apps/api/app/services/sync_service.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Modify: `apps/api/app/api/marketplace_accounts.py`
- Modify: `apps/api/app/schemas/marketplace_account.py`
- Create: `apps/api/app/tests/test_marketplace_security_contract.py`
- Create: `apps/api/app/tests/test_marketplace_sql_injection.py`
- Create: `apps/api/app/tests/test_marketplace_ssrf.py`
- Create: `apps/api/app/tests/test_marketplace_secret_redaction.py`

**Interfaces:**
- Produces: end-to-end proof that all marketplace boundaries fail closed and preserve database state.
- Consumes: existing organization membership roles, credential service, provider registry, SQLAlchemy-bound queries, fixed hosts, and redaction helpers.

- [ ] **Step 1: Write RED tenant/RBAC/IDOR matrix**

```python
@pytest.mark.parametrize("operation", ["validate", "rotate", "revoke", "manual_sync", "send_reply"])
@pytest.mark.asyncio
async def test_cross_tenant_marketplace_identifier_never_decrypts_or_calls_provider(operation: str) -> None:
    result = await invoke_as_other_tenant(operation)
    assert result.status_code == 404
    credentials.decrypt.assert_not_called()
    provider_transport.assert_no_requests()
```

Add owner/admin success and manager/viewer mutation denial for every marketplace endpoint and worker entry path.

- [ ] **Step 2: Write RED SQL injection matrix**

```python
INJECTION_VALUES = [
    "' OR 1=1 --",
    "x'; DROP TABLE marketplace_accounts; --",
    "1 UNION SELECT credentials_encrypted FROM marketplace_accounts",
    "'; SELECT pg_sleep(2); --",
]

@pytest.mark.parametrize("value", INJECTION_VALUES)
@pytest.mark.asyncio
async def test_external_id_is_data_not_sql(value: str, postgres_session: AsyncSession) -> None:
    result = await lookup_message(external_id=value)
    assert result is None
    assert await table_exists(postgres_session, "marketplace_accounts") is True
```

Apply the matrix to account IDs, seller IDs, cursors, filters, external IDs, chat IDs, and reply text. Assert no unrelated row is returned or mutated.

- [ ] **Step 3: Write RED SSRF and secret tests**

Pass absolute URLs, scheme-relative URLs, encoded path traversal, userinfo hosts, redirect responses, forged payload links, and hostile Avito credential JSON. Assert requests remain on the fixed provider origin or fail before transport. Capture structured logs and API responses and assert synthetic API keys, client secrets, access tokens, `Authorization`, `Api-Key`, and reply/customer text are absent.

- [ ] **Step 4: Fix only root-cause boundary defects exposed by the tests**

Tenant-scope initial queries rather than authorizing after loading another tenant's row. Validate/encode provider identifiers before request construction. Centralize metadata/log allowlists and remove raw provider details from safe errors. Keep all query values as SQLAlchemy bound values.

- [ ] **Step 5: Run the complete security matrix and commit**

```powershell
python -m pytest app/tests/test_marketplace_security_contract.py app/tests/test_marketplace_sql_injection.py app/tests/test_marketplace_ssrf.py app/tests/test_marketplace_secret_redaction.py app/tests/test_tenant_context.py app/tests/test_credentials_service.py -q
python -m ruff check app/services/marketplace_account_service.py app/services/sync_service.py app/services/reply_execution_service.py app/api/marketplace_accounts.py app/schemas/marketplace_account.py app/tests/test_marketplace_security_contract.py app/tests/test_marketplace_sql_injection.py app/tests/test_marketplace_ssrf.py app/tests/test_marketplace_secret_redaction.py
python -m pyright app
git add -- apps/api/app/services/marketplace_account_service.py apps/api/app/services/sync_service.py apps/api/app/services/reply_execution_service.py apps/api/app/api/marketplace_accounts.py apps/api/app/schemas/marketplace_account.py apps/api/app/tests/test_marketplace_security_contract.py apps/api/app/tests/test_marketplace_sql_injection.py apps/api/app/tests/test_marketplace_ssrf.py apps/api/app/tests/test_marketplace_secret_redaction.py
git commit -m "test(api): close marketplace security boundaries"
```

### Task 15: Remove superseded code and run the final exact-tree gate

**Files:**
- Modify: `apps/api/app/adapters/__init__.py`
- Modify: `apps/api/app/services/sync_service.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Create or modify: `docs/integrations/marketplace-contract-evidence.md`
- Modify only files with defects proven by final verification.

**Interfaces:**
- Produces: exact final tree with one adapter path, one sync path, one dispatch path, documented provider evidence, and no stale compatibility layer.
- Consumes: all prior task commits.

- [ ] **Step 1: Delete superseded paths after repository-wide usage proof**

Run:

```powershell
rg -n "MarketplaceAdapter|WildberriesAdapter\(|_adapter_for|get_marketplace_adapter|select\(.+external_id|MockTransport" apps/api/app
```

Remove the obsolete broad adapter, hardcoded provider factories, first-page sync implementation, select-before-insert duplicate code, and production-visible test hooks. Retain `MockTransport` only in tests.

- [ ] **Step 2: Run static dead-code and draft-marker scans**

```powershell
$draftMarkers = @('TO' + 'DO', 'TB' + 'D', 'place' + 'holder', 'tempo' + 'rary', 'Not' + 'Implemented', 'pragma: no cover', 'type: ignore', 'noqa', 'except Exception', 'pass$')
rg -n -i ($draftMarkers -join '|') apps/api/app apps/api/alembic docs/integrations
```

Every match must be either removed or justified by an existing repository convention unrelated to this increment. Do not add suppression to silence a new issue.

- [ ] **Step 3: Run final backend, migration, and dependency gates**

From `apps/api`:

```powershell
python -m pytest -q
python -m ruff format --check app alembic
python -m ruff check app alembic
python -m pyright app
python -m compileall -q app
python -m alembic heads
python -m alembic upgrade head
python -m alembic downgrade 20260911_0011
python -m alembic upgrade head
python -m pip_audit
```

Expected: all tests pass, format/lint/type/compile checks pass, exactly one Alembic head exists, the PostgreSQL migration cycle passes, and the dependency audit has no unresolved production finding.

- [ ] **Step 4: Run repository integrity and required frontend/browser gates once**

From repository root and `apps/web` as appropriate:

```powershell
python scripts/check_integrity.py
npm audit --omit=dev
npm run design:detect
npm run typecheck
npm run lint
npm run test:unit
npm run test:design
npm run build
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

Run the repository-defined container/image build commands used by the existing local release gate. Inspect visual results; do not regenerate snapshots to accept a regression.

- [ ] **Step 5: Verify exact repository scope**

```powershell
git diff --check
git status --short --branch
git log --oneline --decorate -20
```

Confirm `.handoff/` and `apps/cms/` remain untouched, no credentials or provider data exist in the diff, and no push/merge/tag/version/deploy action occurred.

- [ ] **Step 6: Commit final cleanup/evidence only if files changed**

```powershell
git add -- apps/api/app/adapters/__init__.py apps/api/app/services/sync_service.py apps/api/app/services/reply_execution_service.py docs/integrations/marketplace-contract-evidence.md
git diff --cached --check
git commit -m "chore(api): finalize marketplace backend MVP"
```

- [ ] **Step 7: Report factual certification status**

Report exact test counts and commands from the final tree. Mark Wildberries, Ozon, Yandex Market, and Avito `contract-complete / runtime-unverified` unless an independently authorized live probe produced current evidence. A blocked live probe does not change contract completion and does not become a production-certification claim.
