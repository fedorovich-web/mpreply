# Sprint 11 QA checklist — live frontend integration

Version: 0.1.11

## Acceptance criteria

- [x] Login form calls `POST /api/auth/login`.
- [x] Registration form calls `POST /api/auth/register`.
- [x] Workspace boot loads `GET /api/auth/me` and `GET /api/organizations`.
- [x] Unauthorized sessions redirect to login.
- [x] A new account with zero organizations gets first-workspace onboarding.
- [x] Active organization is a client preference only; backend tenant checks remain authoritative.
- [x] Inbox loads real messages from `GET /api/messages`.
- [x] Inbox filters are mapped to backend query parameters.
- [x] Inbox supports real message status updates through `PATCH /api/messages/{id}`.
- [x] Review Queue loads a tenant-scoped backend projection.
- [x] Review Queue supports save with `expected_revision`.
- [x] Review Queue supports submit, approve, reject and send.
- [x] Safety decision, flags and reasons come from persisted backend metadata.
- [x] Browser API responses are schema-validated with Zod.
- [x] All API requests use `credentials: include`.
- [x] `NEXT_PUBLIC_API_BASE_URL` is wired into local and production web builds.
- [x] No secret is exposed to the frontend.
- [x] Backend migration head remains `20260710_0008` because Sprint 11 adds no schema migration.

## Local static verification performed in the artifact environment

Backend:

- Ruff: passed.
- Pyright 1.1.411 strict: 0 errors, 0 warnings, 0 informations.
- pytest: 55 passed.
- compileall: passed.
- Alembic head: `20260710_0008`.

Frontend:

- `npm ci`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- TypeScript typecheck: passed.
- ESLint: passed.
- Next.js production build: passed.
- 28 app routes generated.

Docker runtime was not executed in the artifact environment. Run `./scripts/container-gate.ps1` on the Windows development machine after the release gate.
