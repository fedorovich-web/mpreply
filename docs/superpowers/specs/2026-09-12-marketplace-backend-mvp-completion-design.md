# Marketplace Backend MVP Completion Design

**Date:** 2026-09-12

**Status:** awaiting consolidated design review

**Target branch:** `feat/auth-email-resend`

**Scope:** backend marketplace integrations for Wildberries, Ozon, Yandex Market, and Avito

## 1. Goal and delivery status

Complete the marketplace backend as a production-grade MVP with explicit provider capabilities, safe synchronization, deterministic outbound-reply behavior, tenant isolation, and contract-level verification that does not require real marketplace credentials.

The deliverable is complete when all four providers satisfy their supported contracts through deterministic fixtures and mock transports, migrations are reversible and verified against PostgreSQL, security regression coverage passes, and the repository's final quality gates pass on the exact final tree.

Without authorized live credentials, a provider can reach **contract-complete / runtime-unverified** status. It must not be described as live-certified or production-certified until an authorized, non-destructive runtime probe succeeds with the required scopes.

## 2. Product truth and supported capabilities

Respio remains auto-first, with manual review optional. Wildberries is the current verified MVP execution path. The implementation adds complete contracts for the other providers without claiming live sending before runtime verification.

| Provider | Credential validation | Reviews | Questions | Chats | Outbound reply type |
| --- | --- | --- | --- | --- | --- |
| Wildberries | Yes | Sync and reply | Sync and reply | No | Review and question replies |
| Ozon | Yes | Sync and reply | Sync and reply | No | Review and question replies |
| Yandex Market | Yes | Sync and reply | Sync and reply | No | Review and question replies |
| Avito | Yes | No | No | Sync | Text chat reply |

Unsupported operations fail closed with `unsupported_capability`. Avito is modeled as a conversation provider; it is not represented as a review or question provider.

## 3. Source and porting strategy

The current branch contains the active schema, authentication hardening, and release-gate work. The historical `codex/0.1.104-backend` branch contains a more mature marketplace subsystem, but its history and schema have diverged substantially.

Implementation will selectively port and adapt proven concepts and contract tests from the historical branch. It will not merge the branch, replay its commit chain, or copy stale provider assumptions unchanged. Every imported component must conform to the current branch's models, service boundaries, error vocabulary, dependency lifecycle, and migration head.

Provider endpoint details are revalidated against current official documentation immediately before each provider slice. Historical endpoint behavior is useful implementation evidence, not authority when it conflicts with current documentation. No live call is required for this validation.

## 4. Adapter architecture

### 4.1 Capability-specific protocols

The current all-in-one `MarketplaceAdapter` contract is replaced locally with three focused protocols:

- `CredentialAdapter`: validates the account identifier, credential shape, authentication, and required scopes.
- `ReviewQuestionAdapter`: fetches and normalizes review/question pages, performs provider-specific reply preflight, and sends review/question replies.
- `ConversationAdapter`: fetches chats and messages, performs conversation reply preflight, and sends text chat replies.

An adapter implements only the protocols its provider supports. Unsupported methods are absent from its contract and cannot be selected through the registry.

### 4.2 Explicit capability model

Each provider registration declares an immutable capability set. Service code asks the registry for a specific capability rather than switching on marketplace strings. A missing capability returns a typed failure before credentials are decrypted or network I/O begins.

The central registry owns provider construction and exposes separate lookups for credentials, reviews/questions, and conversations. Provider-specific conditionals remain inside adapters or narrowly scoped policies; application services do not hardcode Wildberries, Ozon, Yandex Market, or Avito.

### 4.3 Result and page contracts

Adapter results are typed and carry only:

- success data in a provider-neutral contract;
- a normalized safe error code and safe operator message;
- an optional bounded retry delay;
- an optional opaque next cursor;
- safe provider metadata explicitly approved for persistence.

Review/question pages contain normalized records plus an opaque next cursor. Conversation pages use bounded provider-native pagination but expose the same termination guarantees. A successful HTTP status with an invalid body is `malformed_payload`, never an empty successful page.

### 4.4 HTTP client lifecycle

Adapters receive a reusable `httpx.AsyncClient` from the application lifecycle. Production code does not construct one client per request. Tests inject `httpx.MockTransport` through the same construction path.

Clients use fixed provider base URLs, redirects disabled, bounded connect/read/write/pool timeouts, bounded connection pools, and explicit user-agent/integration headers where permitted. Adapters accept only relative provider paths built from validated identifiers. User-controlled absolute URLs, schemes, hosts, proxies, and redirects are rejected by construction, closing the SSRF boundary.

Yandex Market's documented connection behavior is handled through its provider-specific client settings while preserving the shared ownership/lifecycle contract.

## 5. Credential contracts

Marketplace credentials remain encrypted at rest through the existing credential encryption boundary. Decrypted values exist only for the minimum request scope and are never written to logs, error details, metadata, traces, fixtures, or API responses.

| Provider | Account identifier (`seller_id`) | Encrypted credential payload |
| --- | --- | --- |
| Wildberries | Optional seller label only; not used to construct arbitrary hosts | API token |
| Ozon | Required positive Client-Id | API key |
| Yandex Market | Required positive business ID | API key |
| Avito | Required positive account user ID | Versioned JSON containing `client_id` and `client_secret` |

Credential parsers reject unknown versions, missing fields, blank values, malformed JSON, unexpected types, and oversized input. Avito obtains access tokens through the documented client-credentials flow, caches them only in process for a bounded lifetime, invalidates them on authentication failure, and never persists bearer tokens. Concurrent refreshes for one credential are coalesced to avoid a token-refresh stampede.

Validation proves both authentication and the scopes required by the provider's declared capabilities. Authentication success with missing permissions returns `insufficient_scope`; it does not activate the account.

## 6. Provider contracts

### 6.1 Wildberries

- Base host: `https://feedbacks-api.wildberries.ru`.
- Reviews: `GET /api/v1/feedbacks`; review detail/preflight: `GET /api/v1/feedback`; reply: `POST /api/v1/feedbacks/answer`.
- Questions: `GET /api/v1/questions`; question detail/preflight: `GET /api/v1/question`; reply: `PATCH /api/v1/questions`.
- Offset pagination is bounded by page count, total item count, and repeated-page detection.
- The adapter validates documented authorization/error behavior and strict success payloads.

Wildberries is migrated first to the common protocols, registry, shared HTTP client, normalized errors, and safe synchronization pipeline. Existing supported behavior is preserved while removing provider hardcoding.

### 6.2 Ozon

- Base host: `https://api-seller.ozon.ru`.
- Credential/scope probe: `POST /v1/roles`.
- Reviews: `POST /v2/review/list`; reply lookup: `POST /v1/review/comment/list`; reply: `POST /v1/review/comment/create`.
- Questions: `POST /v1/question/list`; answer lookup: `POST /v1/question/answer/list`; reply: `POST /v1/question/answer/create`.
- Ozon Client-Id is the marketplace account identifier and the encrypted secret is sent only as `Api-Key`.
- Required scope pairs are validated per stream, so review access does not imply question access or write access.

Pagination cursors, `has_next`, and item arrays must agree. A repeated cursor, inconsistent terminal marker, invalid record, or page-cap overflow fails closed. A write preflight checks existing seller-authored comments/answers before sending.

### 6.3 Yandex Market

- Base host: `https://api.partner.market.yandex.ru`.
- Authentication uses `Api-Key`; the business ID is a positive account identifier.
- Reviews use the goods-feedback API under `/v2/businesses/{businessId}/goods-feedback`, with comment lookup/update endpoints under the same resource.
- Questions use `POST /v1/businesses/{businessId}/goods-questions`, `/answers`, and `/update`.
- `pageToken` is opaque and page size is capped at 50.
- Required permission is Customer communication or its documented all-methods equivalent.

Credential validation uses a current documented read operation that proves business access and required permission. The historical `/v2/auth/token` probe is not assumed valid and will not be carried forward unless current official documentation still defines it.

Question backfill covers twelve months in 28-day windows with a one-day overlap, newest window first, and `needAnswer=true`. The active window and page token are persisted in the generic sync-state metadata so restarts resume deterministically.

Question reply reconciliation recognizes `ABSENT`, `PUBLISHED`, `UNMODERATED`, `BANNED`, `DELETED`, and `UNKNOWN`. `canModify=true` is accepted as seller ownership even when author type is absent. Conflicting ownership signals, multiple seller answers, unknown states, or malformed answer identity yield `UNKNOWN` and block automatic resend.

### 6.4 Avito

- Base host: `https://api.avito.ru`; token endpoint: `POST /token/`.
- Chats: `GET /messenger/v2/accounts/{userId}/chats`.
- Messages: `GET /messenger/v3/accounts/{userId}/chats/{chatId}/messages/`.
- Mark read: `POST /messenger/v1/accounts/{userId}/chats/{chatId}/read`.
- Text reply: `POST /messenger/v1/accounts/{userId}/chats/{chatId}/messages`.
- Chat identifiers are percent-encoded as one path segment; account IDs are positive decimal values.

Pagination uses documented limit/offset bounds with a hard maximum offset and repeated-page protection. Only non-empty text messages up to the documented 1000-character limit are sent. The response must prove a new outbound text message with matching content and a provider message ID.

Avito chat context can refer to an item, a user-to-user conversation, or another supported chat type. Product association is therefore nullable. The system does not create synthetic product identities for chats without an item.

## 7. Persistence and migration

A single new Alembic migration is created from current head `20260911_0011`. It adds `marketplace_sync_states` with:

- primary key and tenant/account foreign-key relationships consistent with current models;
- `marketplace_account_id` and `stream` with a unique constraint;
- streams `reviews`, `questions`, and `chats`;
- status constrained to `idle`, `leased`, `error`, or `paused`;
- opaque cursor and bounded allowlisted metadata JSON;
- `next_run_at`, `lease_owner`, and `lease_expires_at`;
- consecutive failure count, last safe error code, last attempt time, last success time, and timestamps;
- indexes supporting due-work selection and account lookup.

The migration has a complete downgrade and must pass upgrade, downgrade, and re-upgrade on PostgreSQL. Application constraints mirror database constraints, but database constraints remain authoritative.

Existing uniqueness is retained:

- products are unique by tenant/account/provider external identity according to the current model;
- customer messages are unique under `uq_customer_messages_external`;
- replies remain protected by the existing idempotency-key unique index.

Ingestion does not use select-then-insert as its concurrency guard. It attempts inserts inside a savepoint, handles only the expected named unique violation, reloads the winning row, and re-raises unrelated integrity errors. This makes manual and scheduled sync safe when they overlap.

Provider metadata is persisted through explicit allowlists. Raw headers, raw credential responses, authorization details, full provider payloads, and unexpected keys are discarded.

## 8. Synchronization, scheduling, and transactions

Manual and scheduled sync invoke the same stream runner and compete for the same database lease. A worker obtains a lease through an atomic conditional update; expired leases are recoverable, active leases are not stealable, and lease ownership is checked on renewal and release.

For each page:

1. Acquire or confirm the short-lived lease in a short transaction.
2. Read the current opaque cursor/checkpoint.
3. Fetch and validate the provider page outside a database transaction.
4. Normalize every record before mutating persistent state.
5. Persist the page with conflict-safe inserts in one bounded transaction.
6. Advance the cursor only in the transaction that commits the complete page.
7. Release or renew the lease and schedule the next run in a short transaction.

The cursor never advances after a partial page failure. Cursor cycles, repeated pages, excessive page counts, invalid next cursors, and provider records missing required identity fail the stream. Successful replay is idempotent.

Transient read failures update failure counters and next-run time with bounded exponential backoff and jitter. Permanent account errors pause the affected stream until credentials or permissions change. One provider or stream failure does not silently mark another stream successful.

## 9. Outbound reply safety

Every outbound reply follows one state machine:

1. In a short transaction, authorize tenant access, lock the reply/message state, validate eligibility, and mark the attempt as `sending` with an idempotency key.
2. Commit before network I/O.
3. Perform the provider-specific existing-reply preflight.
4. If an existing seller reply is proven, reconcile local state without sending.
5. Otherwise send exactly once.
6. Accept success only when the response contains provider-specific proof.
7. Persist the terminal result in a short transaction guarded by the attempt identity.

Read-only preflights may use bounded retry. Outbound writes are never blindly retried after the request may have reached the provider. A timeout, connection loss after transmission, malformed success response, or any other ambiguous outcome transitions to `manual_review_required`. Subsequent automatic dispatch is blocked until reconciliation proves absence or an operator resolves the attempt.

Provider-specific preflights are mandatory:

- Wildberries checks the current feedback/question detail and seller answer state.
- Ozon checks seller comments/answers with bounded pagination.
- Yandex Market reconciles seller comments or question-answer state, treating ambiguity as blocking.
- Avito checks for an outbound message at or after the inbound message timestamp with bounded message pagination.

## 10. Error and retry policy

Application-facing provider errors use this closed vocabulary:

- `invalid_credentials`
- `insufficient_scope`
- `marketplace_validation_error`
- `marketplace_not_found`
- `rate_limited`
- `marketplace_unavailable`
- `network_timeout`
- `network_error`
- `malformed_payload`
- `unsupported_capability`

Internal validation errors may use narrowly typed local codes, but public/API mapping must remain deterministic and safe.

Read-only operations retry only network timeouts, eligible request errors, rate limits, and transient provider failures. Retry count, total elapsed time, backoff, and server-provided `Retry-After` are bounded. Permanent 4xx responses do not retry. Invalid or excessive `Retry-After` values are rejected in favor of a bounded local delay.

Logs include provider, account UUID, stream, operation, attempt count, duration, safe error code, and correlation ID. They exclude credentials, tokens, authorization headers, provider request/response bodies, customer message text, reply text, and unbounded external identifiers.

## 11. Security boundaries

- Every account, message, reply, and sync-state query is tenant-scoped at the database query boundary.
- Cross-tenant UUIDs return the same safe not-found behavior as absent resources.
- RBAC is enforced before credential decryption and before provider calls.
- Dynamic SQL is prohibited; all filters, identifiers, and state transitions use SQLAlchemy expressions and bound parameters.
- Cursor and filter values are treated as opaque data, never SQL fragments.
- Provider hosts are fixed in code and redirects are disabled.
- External identifiers used in paths are type-validated and encoded as one segment.
- Error payloads, structured logs, traces, and persisted metadata are secret-redacted by construction.
- Mock transports and fixtures are test-only dependencies and cannot be selected by production configuration.
- Account creation and credential updates validate length, encoding, marketplace type, account identifier semantics, and encrypted payload version.
- Failures are fail-closed: malformed provider data cannot activate an account, advance a cursor, mark a send successful, or downgrade a security decision.

## 12. Verification strategy

Implementation proceeds by targeted test-driven vertical slices. During a slice, run the smallest tests and static checks that prove the changed behavior. Full repository and security gates run once after all five slices are integrated on the exact final tree.

### 12.1 Provider contract tests

Each provider receives fixture-backed `MockTransport` tests for:

- exact method, fixed host, path, headers, query parameters, and JSON body;
- credential and account-identifier validation;
- permission/scope validation;
- first, middle, and terminal pagination pages;
- repeated cursor/page and page-cap failures;
- normalization of valid records and rejection of malformed records;
- every normalized error mapping;
- bounded `Retry-After` behavior and retry eligibility;
- existing-reply preflight;
- successful send proof;
- ambiguous write outcomes blocking automatic retry;
- secret redaction from results, logs, and stored metadata.

Fixtures use synthetic IDs, names, text, tokens, and secrets. They contain no copied production credentials or customer data.

### 12.2 Application and persistence tests

- Capability registry routing and unsupported-capability failures.
- Manual and scheduled sync through the same service path.
- Lease acquisition, contention, expiry recovery, renewal, and ownership checks.
- Cursor advancement only after complete page commit.
- Duplicate product/message ingestion under concurrent transactions.
- Idempotent replay and recovery after a failed page.
- Outbound state-machine transitions, concurrent dispatch, and attempt ownership.
- PostgreSQL migration upgrade, downgrade, and re-upgrade.

### 12.3 Security regression tests

- RBAC denial for every mutating endpoint and scheduled entry point.
- Tenant isolation and IDOR attempts for account, message, reply, and sync-state identifiers.
- SQL injection payloads in search/filter fields, cursors, external IDs, seller IDs, chat IDs, and reply text, asserting bound-parameter behavior and unchanged schema/data.
- SSRF attempts through identifiers, cursor values, credential JSON, redirects, and forged provider payload links.
- Log/API/metadata secret leakage tests for API keys, Avito client secrets, access tokens, and authorization headers.
- Oversized and malformed JSON/pagination/header payloads.
- Duplicate/concurrent sync and reply races against real PostgreSQL constraints.

### 12.4 Final exact-tree gates

The final tree must pass:

- complete backend test suite;
- Ruff format/check and Pyright/type checking;
- Alembic PostgreSQL migration cycle;
- production dependency audit and repository-prescribed security checks;
- frontend typecheck, lint, unit, design, build, end-to-end, accessibility, visual, and Lighthouse gates required by repository instructions;
- container/image build checks already defined by the project.

Tests are not weakened, skipped, or rewritten merely to accept a regression. Snapshot regeneration requires visual review. Dependency remediation does not use forced upgrades, blanket overrides, or audit suppression.

## 13. Implementation sequence

### Slice 1: Foundation and Wildberries migration

Introduce focused protocols, capability definitions, registry, shared HTTP-client lifecycle, common result/error/pagination primitives, sync-state model/migration, lease runner, and conflict-safe ingestion. Migrate Wildberries to the new boundaries and preserve its supported contract.

### Slice 2: Ozon

Implement typed credentials, current endpoint contracts, per-stream scope validation, bounded cursor pagination, normalization, preflight, and reply sending. Integrate through the generic sync and dispatch services.

### Slice 3: Yandex Market

Implement current credential/access validation, review and question contracts, bounded page-token pagination, twelve-month question-window checkpointing, reply reconciliation states, and ambiguity protection.

### Slice 4: Avito

Implement versioned client credentials, coalesced access-token lifecycle, chat/message pagination and normalization, nullable product association, text-only reply preflight and sending, and strict success proof.

### Slice 5: Scheduler, concurrency, and security closure

Complete due-stream scheduling, lease recovery, failure scheduling, cross-provider integration tests, concurrency tests, tenant/RBAC/IDOR/SQL-injection/SSRF/secret-leakage coverage, migration cycle, and the final exact-tree gates.

Each slice removes obsolete hardcoded paths and superseded interfaces as part of the same change. No compatibility wrapper remains unless an active caller demonstrably requires it.

## 14. Non-goals

- Live provider calls, credential collection, or runtime certification without explicit authorization.
- Ozon, Yandex Market, or Avito production-sending claims before live verification.
- Avito review or question support.
- Media, voice, image, location, link, or attachment replies in Avito.
- Webhooks when the provider contract for this MVP is polling.
- Provider analytics, advertising, orders, catalog management, or pricing APIs.
- A wholesale merge or cherry-pick sequence from the historical backend branch.
- New user-facing features unrelated to marketplace backend completion.

## 15. Definition of Done

The backend marketplace MVP is complete only when:

1. The capability table is implemented exactly, and unsupported calls fail before I/O.
2. Application services contain no provider string switches for adapter selection.
3. All network clients are lifecycle-managed and injected; production cannot select mock transport.
4. Credentials are encrypted, typed, scope-validated, and absent from observable output.
5. All supported streams fully paginate with bounded termination and crash-safe checkpoints.
6. Concurrent manual/scheduled sync cannot duplicate rows or corrupt cursor state.
7. Every outbound reply uses preflight, strict success proof, and ambiguous-write protection.
8. Avito chats without items remain valid without fabricated products.
9. The migration passes PostgreSQL upgrade, downgrade, and re-upgrade.
10. Provider contract, tenant isolation, RBAC, IDOR, SQL injection, SSRF, secret leakage, concurrency, duplicate, and recovery tests pass.
11. The exact final tree passes all repository-required backend, frontend, browser, audit, migration, and image/container gates.
12. Obsolete hardcoded adapters, superseded interfaces, unused helpers, dead branches, duplicate logic, and temporary scaffolding are removed.
13. Documentation reports each provider honestly as live-certified or contract-complete/runtime-unverified based on actual evidence.
