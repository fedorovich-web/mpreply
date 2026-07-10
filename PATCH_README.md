# Respio Sprint 7 patch

Apply this patch on top of a clean Sprint 6 / `develop` working tree.

## Sprint 7 scope

- Dramatiq + Redis worker-backed automatic reply execution.
- Real Wildberries review/question sends through the adapter.
- Preflight reconciliation to suppress duplicate outbound sends when WB already has an answer.
- Durable reply state, attempts, retry metadata, worker message id and error codes.
- Application-level idempotency with a unique database index.
- Runtime organization and automation-rule quotas.
- Explicit message/reply state-machine guards.
- API endpoints for enqueue/list/detail/retry.
- Docker Compose worker service.
- Alembic migration `20260710_0007`.

## Version

- `respio-api`: `0.1.7`
- `respio-web`: `0.1.7`
- `APP_VERSION`: `0.1.7`

## Verification completed

- Ruff: passed.
- Pyright: 0 errors, 0 warnings.
- Pytest: 32 passed.
- Compileall: passed.
- Alembic head: `20260710_0007`.
- Frontend typecheck: passed.
- Frontend lint: passed.
- Frontend production build: passed.
- Docker runtime validation: not executed because Docker daemon was unavailable in the build environment.
