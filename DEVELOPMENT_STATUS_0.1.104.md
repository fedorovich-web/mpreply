# MP Reply 0.1.104 development snapshot

This full development copy continues from the verified remote feature commit:

- branch: `work/0.1.104-yandex-foundation`;
- base commit: `ecf0b170060681dd6747d6871a8b44e72c39c6c1`;
- base release version inside project contracts: `0.1.103`;
- development target: `0.1.104`.

The snapshot contains the committed Yandex Market foundation plus an uncommitted client-dashboard observability increment. It is not a released build and does not claim external runtime verification.

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

### Client dashboard observability increment

- generic tenant-scoped account overview endpoint;
- connection health with explicit reasons;
- normalized safe scope list;
- review/question scheduler state;
- last success, last error and next scheduled run;
- recent manual sync jobs and counters;
- recent integration events and user-facing error explanations;
- recursive removal of credential, token, secret and authorization metadata;
- failed manual sync is retried through the existing guarded sync endpoint;
- no schema migration.

## Still intentionally incomplete

### Yandex Market external runtime verification

A real seller Api-Key and Business ID are still required to verify token scopes, account access, provider pagination, comment publication, question-answer publication, moderation delay, ambiguous-timeout reconciliation and actual limit headers.

### Ozon

The common foundation is ready, but the Ozon production adapter remains disabled until the current official field-level contract, credentials model, pagination, statuses, errors and runtime account are verified.

### Avito

Avito remains a separate conversation integration: chats, thread cursors, messages, delivery/read states, attachments and webhook or polling semantics.

## Verification performed on this exact project copy

- Python compileall: PASS;
- targeted overview/Yandex/scheduler regression matrix: `60 passed`;
- available backend suite: `174 passed`;
- changed TypeScript/TSX parser and isolated transpile: PASS;
- CSS parser: PASS;
- synthetic exact-scope `git diff --check`: PASS.

The artifact environment cannot install the complete pinned frontend dependency tree. Exact Windows Ruff, strict Pyright, Vitest, TypeScript typecheck, ESLint, Next.js build, release gate and container gate remain mandatory before the next commit.

## Recommended next order

1. Apply this dashboard increment to the existing feature branch.
2. Run exact Windows release and container gates.
3. Commit and push the dashboard increment as a second feature commit.
4. Validate Yandex Market with a test seller account.
5. Close provider runtime discrepancies.
6. Implement Ozon from a current official exported contract.
7. Expand shared account health and reply reconciliation for all marketplaces.
8. Design Avito as a separate conversation adapter family.
9. Bump all version contracts only when the release scope is actually closed.
