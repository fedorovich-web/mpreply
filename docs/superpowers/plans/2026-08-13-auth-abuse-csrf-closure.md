# Auth Abuse and CSRF Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce CSRF protection for cookie-authenticated API writes, throttle registration and refresh abuse, and remove duplicate-registration account enumeration.

**Architecture:** A focused middleware enforces one explicit custom header on unsafe `/api/` requests while exempting only the verified provider webhook. The existing Redis fixed-window limiter becomes action-aware through immutable policies, and route dependencies enforce limits before expensive or credential-sensitive work. The shared browser API client supplies the header automatically.

**Tech Stack:** FastAPI, Starlette middleware, Redis Lua fixed windows, SQLAlchemy async sessions, Pydantic Settings, Next.js/TypeScript, Vitest, Pytest.

## Global Constraints

- Do not add dependencies, migrations, provider calls, product capabilities, or a version bump.
- Do not expose emails, refresh tokens, IP addresses, secrets, or internal errors in keys, logs, or responses.
- Keep YooKassa webhook verification unchanged and exempt only `/api/payments/webhooks/yookassa` from CSRF.
- Use TDD: one grouped RED before production changes, one grouped targeted GREEN after implementation, and no repeated unchanged test runs.
- Preserve strict production CORS origins and keep CORS outside the CSRF middleware.
- Do not add production comments or user-visible implementation notes.

---

### Task 1: Lock the security contracts with failing tests

**Files:**
- Modify: `apps/api/app/tests/test_auth_rate_limit.py`
- Create: `apps/api/app/tests/test_csrf_protection.py`
- Modify: `apps/web/tests/unit/api-client.test.ts`

**Interfaces:**
- Consumes: existing `AuthRateLimiter`, `create_app()`, and `apiRequest<T>()`.
- Produces: behavioral contracts for `enforce_registration(email, client_ip)`, `enforce_refresh(refresh_token, client_ip)`, server CSRF enforcement, duplicate-registration privacy, and browser header injection.

- [ ] **Step 1: Add backend failing tests**

Add literal assertions that registration uses `auth-register:account` and `auth-register:ip` hashed buckets with limits `5/20/3600`, refresh uses `auth-refresh:token` and `auth-refresh:ip` hashed buckets with limits `120/600/900`, and neither key includes its raw subject. Add route doubles that raise `429` from registration and refresh enforcement before database authentication/rotation. Add an `IntegrityError` service regression asserting rollback and a generic response that does not contain the email or existence claim.

- [ ] **Step 2: Add CSRF failing tests**

Create TestClient cases asserting unsafe `/api/auth/login` requests without `X-CSRF-Token: 1` return `403`, wrong values return `403`, the exact value reaches normal validation, `GET /api/health/live` succeeds without the header, credentialed CORS preflight permits the header, and the YooKassa webhook is not rejected with the CSRF error.

- [ ] **Step 3: Add frontend failing tests**

Assert that a `POST` through `apiRequest` contains `X-CSRF-Token: 1` and that a `GET` omits it.

- [ ] **Step 4: Run one grouped RED**

Run backend auth/CSRF tests and the frontend API-client unit test once. Expected: failures identify the missing limiter methods, missing middleware enforcement, missing generic duplicate handling, and missing browser header.

### Task 2: Implement action-aware authentication throttling

**Files:**
- Modify: `apps/api/app/services/auth_rate_limit_service.py`
- Modify: `apps/api/app/api/auth.py`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/core/lifecycle.py`
- Modify: `.env.example`
- Modify: `infra/coolify/.env.production.example`
- Modify: `infra/docker/docker-compose.production.yml`

**Interfaces:**
- Produces: immutable `AuthRateLimitPolicy(subject_limit: int, ip_limit: int, window_seconds: int)` and `AuthRateLimiter.enforce_registration`, `.enforce_login`, `.enforce_refresh` returning `None` or raising `HTTPException`.
- Consumes: `RateLimitStore.consume(key, limit, window_seconds)` and settings values for all three policies.

- [ ] **Step 1: Generalize bucket consumption**

Store login, registration, and refresh policies on the limiter. Implement a private enforcement path accepting an action name, subject dimension, normalized/raw subject, and policy. Generate `mpreply:rate-limit:auth-{action}:{dimension}:{sha256}` keys and preserve the fail-closed and `Retry-After` behavior.

- [ ] **Step 2: Enforce registration and refresh at the routes**

Inject the existing limiter dependency into both routes. Registration calls enforcement before constructing `AuthService`; refresh calls enforcement after the missing-cookie rejection and before constructing `AuthSessionService`.

- [ ] **Step 3: Wire validated settings**

Add registration limits `5/20/3600` and refresh limits `120/600/900` with bounded Pydantic fields. Construct all three policies during application lifespan and add identical variables to local/production examples and production Compose.

### Task 3: Enforce CSRF and remove enumeration

**Files:**
- Modify: `apps/api/app/core/middleware.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/api/app/services/auth_service.py`

**Interfaces:**
- Produces: `CsrfProtectionMiddleware`, exact header contract `X-CSRF-Token: 1`, and generic duplicate registration failure.
- Consumes: Starlette `RequestResponseEndpoint`, existing exact CORS configuration, and `Headers` in the shared web client.

- [ ] **Step 1: Add the middleware**

Reject unsafe `/api/` requests unless the header equals `1`; bypass safe methods, OPTIONS, non-API paths, and only the YooKassa webhook path. Register it before CORS so CORS remains the outer layer.

- [ ] **Step 2: Add the browser header**

Normalize the request method once and set `X-CSRF-Token` only for `POST`, `PUT`, `PATCH`, and `DELETE`, preserving caller headers and all existing request behavior.

- [ ] **Step 3: Make duplicate registration generic**

Keep rollback after `IntegrityError`, but raise `bad_request("Unable to register with provided credentials")` without the email or existence disclosure.

### Task 4: Protect deployment integrity and verify once

**Files:**
- Modify: `scripts/check_integrity.py`
- Modify: `scripts/tests/test_integrity_quality_gate_contract.py`
- Modify: deployment/security documentation only where the existing variable inventory requires it.

**Interfaces:**
- Consumes: runtime settings, Compose environment, middleware registration, and executable integrity checks.
- Produces: a gate that fails if CSRF enforcement or any auth action policy is omitted from the production contract.

- [ ] **Step 1: Extend executable integrity coverage**

Exercise the checker against controlled source/config fixtures or its existing contract surface so removal of a required rate-limit setting or CSRF wiring fails behaviorally.

- [ ] **Step 2: Run one grouped targeted GREEN**

Run the exact backend auth/CSRF test files and frontend API-client unit file from Task 1. Fix implementation defects without weakening assertions.

- [ ] **Step 3: Run one final affected-project gate**

Run backend Ruff, strict Pyright, full Pytest, compileall, Alembic head/history, integrity and tooling tests; run web unit tests, design detector, typecheck, lint, build, e2e, accessibility, visual, and Lighthouse checks once. Record any environmental blocker exactly and do not claim an unrun pass.

- [ ] **Step 4: Review, commit, push, and verify CI**

Review the full diff for secret exposure, SQL construction, bypasses, and production comments. Commit only intended files, push the existing branch, wait for one Quality Gate, and update the existing draft PR without merging or deploying.
