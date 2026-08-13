# MP Reply 0.1.104 development snapshot

This full development copy continues from the verified remote feature branch:

- branch: `work/0.1.104-yandex-foundation`;
- base commit: `922e1788d99863e2e631addd52d68e07dec3c932`;
- base release version inside project contracts: `0.1.103`;
- development target: `0.1.104`.

## Client workspace increment in this branch

- grouped authenticated navigation and customer-safe Russian copy;
- tenant-scoped AI instruction sets with default and per-account assignment;
- structured text knowledge scoped to organization, marketplace account or product;
- prompt generation resolves instruction policy and factual knowledge separately;
- team, organization settings and filtered append-only audit surfaces;
- persisted operational attention queue and onboarding checklist;
- Inbox support for reviews, questions and chats with URL-restorable filters;
- unit coverage for RBAC, tenant isolation, validation, prompt separation, SQL parameter binding and frontend workflows.

This increment does not claim live provider verification, release deployment or PDF/file ingestion. Those remain separate gates.

The base commit contains the committed Yandex Market foundation and client-dashboard observability increment. This snapshot adds an uncommitted runtime-verification kit. It is not a released build and does not claim that a real seller account has already passed runtime verification.

## Implemented foundation

### Marketplace-neutral orchestration

- marketplace capabilities determine scheduler streams;
- manual sync invokes only supported streams;
- cursor pagination is bounded and detects cycles;
- scheduled sync passes marketplace-specific account identifiers;
- generic reply execution uses the adapter registry;
- adapter results can carry retry delay metadata.

### Yandex Market Partner API vertical slice

- Api-Key validation through `/v2/auth/token`;
- `COMMUNICATION` or `ALL_METHODS` scope validation;
- mandatory positive Business ID;
- review and question synchronization with `pageToken`;
- review comments and question answers;
- safe handling of 400/401/403/404/420/429/5xx;
- encrypted server-side credentials and masked frontend representation;
- account create, edit, validate, rotate, revoke and manual-sync flows.

### Client dashboard observability

- tenant-scoped account overview endpoint;
- connection health with explicit reasons;
- safe normalized scope list;
- review/question scheduler state;
- last success, last error and next scheduled run;
- recent manual sync jobs and integration events;
- recursive filtering of credential, token, secret, authorization and cursor metadata;
- failed-sync retry through the existing guarded sync endpoint.

### Runtime-verification kit in this snapshot

- production-adapter smoke probe for a real Yandex Market account;
- default read-only credential, Business ID, review and question checks;
- bounded pagination up to five pages;
- cursor-cycle fail-closed behavior;
- normalization check without persisting or printing customer content;
- optional explicitly confirmed review or question write probe;
- preflight duplicate-response check;
- post-write visibility result with `pending` support for moderation/propagation delay;
- sanitized JSON evidence under ignored `.handoff/` storage;
- PowerShell wrapper that never passes the Api-Key as a command-line argument;
- no migration and no version bump.

## Still intentionally incomplete

### Yandex Market external runtime verification

A real seller Api-Key and Business ID are still required. The read-only probe must confirm scopes, Business ID access, review pagination, question pagination and normalization. Write publication must be checked separately against a deliberately selected test review or question.

### Ozon

The Ozon Seller API review/question adapter is enabled in this development branch. It validates `Client-Id` and `Api-Key` permissions, activates only account-scoped streams, performs bounded review/question pagination, runs exact read-only preflight before writes and blocks ambiguous outbound results from blind retry. Contract tests use synthetic `httpx.MockTransport` responses only. A real Ozon account, subscription and provider runtime remain unverified.

### Avito

The Avito Messenger polling/text adapter is implemented against the supplied official OpenAPI and contract-tested with synthetic transports. It covers read-only account validation, bounded unread-chat and message polling, durable text-turn ingestion before read mutation, exact outbound preflight and guarded text sends. The production credential path also supports the official OAuth 2 client-credentials flow through `POST https://api.avito.ru/token/`: an Avito credential can be supplied as the exact JSON object `{"client_id":"...","client_secret":"..."}`. The encrypted credential remains opaque to shared account storage, resolved Bearer tokens are cached only in process memory until an early expiry, read-only calls may refresh once after an authentication failure, and provider POST requests are never repeated.

No live Avito request was used for this implementation. Real client-credentials token acquisition, access-token validation, provider read mutation and message delivery remain unverified. Existing pre-obtained access-token credentials remain supported for migration, but cannot be refreshed. Authorization-code delegation, refresh-token persistence, webhooks, media, voice, attachments and other non-text operations remain unsupported.

The supplied chat-list response exposes item context but does not expose the requested `u2i`/`u2u`/`a2u` filter value as a response field. The adapter preserves the documented response fields and does not infer a chat type; automatic product linking from the live adapter path is therefore unverified.

## Historical verification inherited by this development branch

- Python compileall: PASS at the recorded Yandex runtime-kit snapshot;
- runtime-probe unit tests at that snapshot: `6 passed`;
- Yandex adapter and runtime-probe matrix at that snapshot: `18 passed`;
- backend suite available in the artifact container at that snapshot: `180 passed` (six modules were excluded because `pwdlib`, `asyncpg` or `redis` were unavailable).

These figures predate the Ozon implementation and are not current gate evidence. The artifact environment does not contain a real seller credential and cannot claim external runtime success. Current strict Pyright, Ruff, full pytest, frontend, release and container gates remain mandatory before completion.

## Recommended next order

1. Apply this runtime-kit increment to `922e1788d99863e2e631addd52d68e07dec3c932`.
2. Run exact Windows Ruff, Pyright, full pytest, release and container gates.
3. Commit and push the runtime-kit increment.
4. Run the read-only Yandex Market probe with a real test seller account.
5. Review the sanitized evidence and close any provider-specific discrepancies.
6. Run one explicitly approved write probe for a test review or question.
7. Run read-only Avito validation with a real test account, then a separately approved text-send probe; the first official-contract Messenger slice is implemented, but live runtime behavior and production-ready sending remain unverified.
8. Run a separate, explicitly approved Ozon runtime verification with a real test seller account.
9. Bump all version contracts only when the agreed release scope and runtime checks are closed.
