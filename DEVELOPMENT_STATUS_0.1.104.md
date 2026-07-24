# MP Reply 0.1.104 development snapshot

This archive is a full development copy of the MP Reply repository based on verified commit:

- branch: `develop`
- base commit: `179ae0c254df44d6e480357864f60d8fa70e603e`
- base release version inside project contracts: `0.1.103`
- development target: `0.1.104`

It is not a released build and does not contain a new Git commit. The historical `HANDOFF/` directory belongs to the verified 0.1.103 baseline and must not be treated as release evidence for the changes in this archive.

## Implemented in this development snapshot

### Marketplace-neutral integration foundation

- marketplace capabilities determine which sync streams are provisioned;
- manual sync invokes only supported streams;
- manual sync follows provider cursors across multiple pages;
- cursor cycles and excessive page counts fail closed;
- scheduled sync passes marketplace-specific account identifiers to adapters;
- generic reply execution obtains adapters from the registry instead of hard-coding Wildberries;
- adapter results can carry `retry_after_seconds`.

### Yandex Market Partner API vertical slice

- production adapter class for the official Partner API host;
- Api-Key validation through `/v2/auth/token`;
- validation of `COMMUNICATION` or `ALL_METHODS` scope;
- mandatory positive Business ID;
- review synchronization through the official goods-feedback API;
- question synchronization through the official goods-questions API;
- page-token pagination;
- review comments and question answers;
- safe error mapping for 400/401/403/404/420/429/5xx;
- no raw API key in frontend responses;
- separate customer dashboard page at `/app/integrations/yandex-market`;
- create, validate, rotate, revoke, edit and manual-sync account flows through the existing account API.

## Still intentionally not marked complete

### Ozon

The common foundation is ready for an Ozon adapter, but Ozon remains disabled until the current official Seller API field-level contract, credentials model, pagination, reply states and runtime account are verified. No fake Ozon adapter is included.

### Avito

Avito remains disabled. A complete Avito integration needs a chat/conversation contract rather than a mechanical copy of review/question adapters: thread cursors, messages, delivery/read state, attachments and webhook or polling rules.

### Yandex Market external runtime verification

The implementation is covered by repository tests and the official OpenAPI contract, but it has not been executed with a real seller Api-Key and Business ID in this environment. Treat it as implementation-complete with external runtime verification pending.

## Verification performed on the exact project copy

- Python compileall: PASS;
- backend targeted integration/regression tests: 64 passed;
- available broad backend suite: 166 passed;
- TypeScript/TSX parser check for changed frontend files: PASS;
- the 31 strict Pyright diagnostics reported by the Windows gate were corrected in source and tests;
- source audit for the exact reported private/protected/unknown-type patterns: PASS.

The artifact environment could not execute Pyright 1.1.411 or install the frontend dependency tree because its package mirrors were unavailable. Therefore strict Pyright, project `npm test`, typecheck, lint and build still require confirmation on the Windows checkout. Do not commit or push until the repository gates finish with exit code 0.

## Recommended next development order

1. Run exact Ruff, strict Pyright, full pytest and frontend gates on Windows.
2. Validate Yandex Market with a test seller account without exposing credentials.
3. Close any provider-specific runtime discrepancies.
4. Add Ozon from an exported current official API contract.
5. Extend the client dashboard with account health, stream status, sync history and reply reconciliation.
6. Design Avito as a separate conversation adapter family.
7. Only then bump all version contracts to 0.1.104 and run full release/container gates.
