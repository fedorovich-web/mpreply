# Auth Session Security Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the evidenced CSRF, rate-limit, refresh replay, explicit revocation, lifecycle coverage, and audit-data gaps in Draft PR #13 without expanding beyond auth/email/session.

**Architecture:** Keep cookie authentication and the existing rotating opaque refresh-token model. Add a non-secret custom-header CSRF proof for unsafe cookie-authenticated endpoints, independent IP and account Redis counters, refresh-session family identifiers with reuse-triggered family revocation, and explicit refresh-session revocation on password changes. Exercise the real FastAPI routes against an isolated SQLite database and the real frontend API client against controlled fetch responses.

**Tech Stack:** FastAPI, SQLAlchemy asyncio, Alembic, Redis asyncio, PyJWT, pytest/pytest-asyncio, Next.js, TypeScript, Vitest.

**Spec:** User handoff for Draft PR #13 in Codex task `019ffb39-56be-7d33-b37e-91196e0d1738`.

## Global Constraints

- Work directly on `feat/auth-email-resend`; do not create a branch/worktree or merge, deploy, tag, release, or bump versions.
- Do not apply `codex-old-auth-lifecycle-before-pr13` or touch user-owned `.handoff/` and `apps/cms/`.
- Change only proven auth/email/session gaps; keep ORM/parameterized queries and digest-only token storage.
- Add regression tests before production changes, observe the expected RED, then implement the minimal GREEN and refactor only while green.
- Do not weaken tests; stage only named files and record the exact final SHA.

---

### Task 1: Cookie-auth CSRF contract and frontend single-flight

**Files:**
- Create: `apps/api/app/core/csrf.py`
- Modify: `apps/api/app/api/auth.py`
- Test: `apps/api/app/tests/test_auth_routes.py`
- Modify: `apps/web/lib/api/client.ts`
- Test: `apps/web/tests/unit/api-client.test.ts`

**Interfaces:**
- Produces: `require_csrf_header(request: Request) -> None` and `require_cookie_auth_csrf(request: Request) -> None` dependencies.
- Produces: unsafe frontend requests and the internal refresh request carry `X-CSRF-Token: 1`.
- Preserves: Bearer-authenticated `change-password` requests do not require the cookie CSRF proof.

- [x] **Step 1: Write failing backend route tests**

  Add route assertions that `/api/auth/refresh` and `/api/auth/logout` reject a valid cookie without `X-CSRF-Token`, and that `/api/auth/change-password` requires it for access-cookie auth but accepts a valid Bearer token without it.

- [x] **Step 2: Run the focused backend tests and verify RED**

  Run `pytest -q app/tests/test_auth_routes.py -k csrf` from `apps/api`; expect requests without the header to return the current success/auth result instead of HTTP 403.

- [x] **Step 3: Add the minimal backend dependency and wire the three routes**

  Require the exact public proof value `1` for refresh/logout, and for change-password only when a Bearer credential is not selected. Return HTTP 403 with a generic CSRF detail before any mutation.

- [x] **Step 4: Write failing frontend concurrency/header tests**

  Add a controlled concurrent pair of protected requests that both receive 401, hold the refresh response behind one promise, and assert only one refresh fetch occurs. Assert unsafe requests and refresh include `X-CSRF-Token: 1`, while GET does not.

- [x] **Step 5: Run Vitest and verify RED**

  Run `npm run test:unit -- tests/unit/api-client.test.ts` from `apps/web`; expect missing header assertions to fail while the concurrency assertion characterizes the existing single-flight behavior.

- [x] **Step 6: Add the frontend header policy and verify GREEN**

  Set the header from the normalized HTTP method for POST/PATCH/PUT/DELETE and on the internal refresh request, without overwriting a caller-provided header. Re-run the focused backend and frontend tests.

### Task 2: Independent brute-force limits

**Files:**
- Modify: `apps/api/app/core/rate_limit.py`
- Create: `apps/api/app/tests/test_auth_rate_limit.py`

**Interfaces:**
- Preserves: `enforce_auth_rate_limit(request, scope, identifier, limit, window_seconds) -> None`.
- Produces: separate hashed Redis keys for the client IP and normalized account/action identifier.

- [x] **Step 1: Write failing limiter tests**

  Use a stateful fake Redis boundary to show one account is blocked after the limit across changing IPs and one IP is blocked after the limit across changing email identifiers. Assert persisted keys contain hashes, not raw email, token, or IP text.

- [x] **Step 2: Run and verify RED**

  Run `pytest -q app/tests/test_auth_rate_limit.py`; expect both bypass scenarios to remain allowed with the composite key.

- [x] **Step 3: Increment independent counters and verify GREEN**

  Increment `scope:ip` and `scope:identifier` keys through the existing fail-closed Redis lifecycle, preserve `Retry-After`, close the client once, and re-run the tests.

### Task 3: Refresh-family replay response and explicit password revocation

**Files:**
- Modify: `apps/api/app/models/auth_session.py`
- Create: `apps/api/alembic/versions/20260911_0011_auth_session_families.py`
- Modify: `apps/api/app/services/session_service.py`
- Modify: `apps/api/app/services/auth_service.py`
- Modify: `apps/api/app/api/auth.py`
- Test: `apps/api/app/tests/test_auth_sessions.py`
- Test: `apps/api/app/tests/test_auth_routes.py`

**Interfaces:**
- Produces: `AuthSession.family_id: UUID`; login creates a family and rotation preserves it.
- Produces: refresh reuse raises `SessionError("refresh_session_reused")` after revoking active rows in the family; the route commits that defensive revocation before returning generic HTTP 401.
- Preserves: missing, malformed, expired, revoked, and auth-version-mismatched refresh tokens return generic HTTP 401 without leaking token state.

- [x] **Step 1: Write failing service tests**

  Assert rotated children share the original family, replay of the original revokes the active child, and both password reset and password change set `revoked_at` on every active refresh session.

- [x] **Step 2: Run and verify RED**

  Run the named tests in `app/tests/test_auth_sessions.py` and `app/tests/test_auth_routes.py`; expect missing family state and non-revoked active rows.

- [x] **Step 3: Add the family column and minimal service behavior**

  Add a non-null indexed UUID family column with a migration that backfills existing rows from each row's own `id`. Query refresh tokens by digest regardless of revocation, revoke the matching family on reuse, preserve the family on rotation, and explicitly revoke all user sessions during reset/change.

- [x] **Step 4: Commit replay revocation at the route boundary and verify GREEN**

  Commit only the defensive family revocation for `refresh_session_reused`; roll back other failed rotations. Re-run the focused tests, then run all auth backend tests.

### Task 4: Enumeration and audit-data minimization

**Files:**
- Modify: `apps/api/app/services/auth_service.py`
- Modify: `apps/api/app/api/auth.py`
- Test: `apps/api/app/tests/test_auth_routes.py`

**Interfaces:**
- Preserves: generic registration/resend/forgot responses for both existing and absent accounts.
- Produces: registration email-delivery failure does not expose account existence through a distinct HTTP status.
- Produces: auth audit rows identify the actor/entity by UUID and omit redundant normalized email metadata.

- [x] **Step 1: Write failing observable regression tests**

  Compare registration status/body for an existing account and a new account when delivery fails, and inspect persisted registration/login audit metadata to require an empty object.

- [x] **Step 2: Run and verify RED**

  Run `pytest -q app/tests/test_auth_routes.py -k 'enumeration or audit'`; expect the new-account failure to return HTTP 503 and audit rows to contain email.

- [x] **Step 3: Remove the observable and stored leaks, then verify GREEN**

  Roll back failed registration delivery and return the same accepted response as the existing-account path. Remove redundant email metadata while retaining action, actor UUID, and entity UUID.

### Task 5: Full verification and exact SHA

**Files:**
- Verify all files changed above; do not regenerate snapshots to silence failures.

**Interfaces:**
- Produces: fresh command evidence for backend, frontend, E2E/security scope, migration topology, diff hygiene, and final Git identity.

- [x] **Step 1: Run backend gates**

  From `apps/api`, run `pytest -q`, `ruff check app alembic`, strict `npx --yes pyright@1.1.411 --pythonpath <current-python> app`, `python -m compileall -q app alembic`, and `alembic heads`.

- [x] **Step 2: Run frontend gates**

  From `apps/web`, run `npm run test:frontend`, `npm run design:detect`, `npm run typecheck`, `npm run lint`, and `npm run build`.

- [x] **Step 3: Run relevant browser/security checks**

  Run the auth/API-client focused tests plus the repository browser suites required by `AGENTS.md` where the local environment supports them; report any environment-only limitation verbatim instead of claiming a pass.

- [x] **Step 4: Review and record**

  Run `git diff --check`, review `git diff --stat` and the exact changed paths, confirm `.handoff/`, `apps/cms/`, and the stash remain untouched, stage only explicit files, commit one logically complete patch, and report `git rev-parse HEAD` plus current PR/check status without merging or deploying.
