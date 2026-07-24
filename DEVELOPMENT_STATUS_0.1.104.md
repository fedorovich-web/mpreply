# MP Reply 0.1.104 development snapshot

This full development copy continues from the verified remote feature branch:

- branch: `work/0.1.104-yandex-foundation`;
- base commit: `922e1788d99863e2e631addd52d68e07dec3c932`;
- base release version inside project contracts: `0.1.103`;
- development target: `0.1.104`.

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

The common foundation is ready, but the Ozon production adapter remains disabled until a current official field-level Seller API contract, credential model, pagination, reply states, errors and runtime account are available. Third-party API mirrors are not treated as implementation authority.

### Avito

Avito remains a separate conversation integration: chats, thread cursors, messages, delivery/read states, attachments and webhook or polling semantics.

## Verification performed on this exact project copy

- Python compileall: PASS;
- runtime-probe unit tests: `6 passed`;
- Yandex adapter and runtime-probe matrix: `18 passed`;
- available backend suite in the artifact container: `180 passed` (six existing modules excluded because `pwdlib`, `asyncpg` or `redis` are unavailable).

The artifact environment does not contain a real seller credential and cannot claim external runtime success. Exact Windows Ruff 0.14.9, strict Pyright 1.1.411, full pytest, frontend gates, release gate and container gate remain mandatory before commit.

## Recommended next order

1. Apply this runtime-kit increment to `922e1788d99863e2e631addd52d68e07dec3c932`.
2. Run exact Windows Ruff, Pyright, full pytest, release and container gates.
3. Commit and push the runtime-kit increment.
4. Run the read-only Yandex Market probe with a real test seller account.
5. Review the sanitized evidence and close any provider-specific discrepancies.
6. Run one explicitly approved write probe for a test review or question.
7. Obtain a current official Ozon Seller API contract before implementing Ozon.
8. Bump all version contracts only when the agreed release scope and runtime checks are closed.
