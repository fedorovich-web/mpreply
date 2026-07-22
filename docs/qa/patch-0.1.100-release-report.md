# Respio 0.1.100 — marketplace scheduler foundation

## Scope

- backend-owned marketplace capability registry;
- only the implemented Wildberries adapter is enabled;
- persisted per-account review/question polling state;
- database leases with `FOR UPDATE SKIP LOCKED`;
- bounded retry backoff and cursor continuation;
- real scheduler container and Dramatiq marketplace-sync worker;
- read-only capability and sync-state API contracts;
- no public UI, CSS or visual snapshot changes.

## Root cause

The previous backend performed a synchronous first-page manual sync, did not persist pagination progress, and shipped a scheduler placeholder. Marketplace enum values were broader than implemented adapter support.

## Verification targets

- Ruff and full backend pytest;
- Alembic single head `20260722_0012` and offline SQL;
- web unit/design regression gates;
- integrity and diff checks;
- Docker Compose parsing where available.

## Build-time verification

- scheduler contract tests: 26 passed;
- combined ledger/settings/scheduler contract tests: 63 passed;
- Python compileall: passed;
- integrity gate: passed;
- Alembic single head and offline SQL: passed;
- local and production Compose YAML parsing: passed;
- public UI freeze check: passed.

Full Ruff, full backend pytest and web unit/design gates are executed by the supplied Windows test-and-push script after manual extraction.
