# Persistent Auth Session Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep MPReply users signed in for up to 30 days without weakening short-lived access-token security, and add regression coverage for common auth and SQL-injection attacks.

**Architecture:** Keep the existing short-lived signed access JWT, but add a server-side opaque refresh session whose raw value lives only in an HttpOnly cookie and whose digest is stored in PostgreSQL. Refresh tokens rotate atomically and are revocable; password reset/change invalidates the session family through the existing auth-version mechanism plus refresh-session revocation. SQL injection resistance is enforced structurally through SQLAlchemy expressions and verified using hostile payload tests.

**Tech Stack:** FastAPI, SQLAlchemy async ORM, PostgreSQL, Redis, PyJWT, pwdlib/Argon2, Pydantic Settings, pytest, Pyright, Ruff.

**Spec:** Current draft PR #13 plus user requirement from 2026-09-11: persistent cookies/sessions, no 10–15 minute forced logout, security regression checks, SQL-injection resistance.

## Global Constraints

- Work only on `feat/auth-email-resend`; do not modify `main`.
- Access token remains short-lived; refresh session persists up to 30 days.
- Refresh cookie is HttpOnly, Secure in production, SameSite=Lax, and scoped to auth endpoints.
- Persist only refresh-token digests; never raw refresh tokens.
- Rotate refresh token on every refresh and reject replay of a consumed/revoked token.
- Password reset/change revokes outstanding refresh sessions and bumps `auth_version`.
- All auth database access uses SQLAlchemy expressions/bound parameters; no string-built SQL.
- Production auth remains fail-closed when secure cookies or rate limiting are disabled.
- Verification must run on the exact final PR-head SHA.

---

### Task 1: Stateful refresh sessions

**Files:**
- Create: `apps/api/app/models/auth_session.py`
- Create: `apps/api/app/services/session_service.py`
- Create: new Alembic migration under `apps/api/alembic/versions/`
- Modify: `apps/api/app/core/cookies.py`
- Modify: `apps/api/app/api/auth.py`
- Modify: `apps/api/app/services/auth_service.py`
- Test: `apps/api/tests/test_auth_sessions.py`

**Interfaces:**
- Consumes: existing access JWT and `auth_version` contract.
- Produces: opaque refresh session, `respio_refresh` cookie, `/api/auth/refresh`, atomic rotation and revocation.

- [ ] Write failing tests for 30-day persistence, refresh rotation, replay rejection, logout revocation and password-change/reset revocation.
- [ ] Run focused tests and confirm RED.
- [ ] Add the smallest session model/service/migration implementation that satisfies the tests.
- [ ] Wire login/refresh/logout cookies without exposing refresh tokens in JSON.
- [ ] Run focused tests, Ruff and Pyright to GREEN.
- [ ] Commit the persistent-session slice.

### Task 2: Auth attack regression suite

**Files:**
- Create: `apps/api/tests/test_auth_security_regressions.py`
- Modify auth/rate-limit code only for defects demonstrated by failing tests.

**Interfaces:**
- Consumes: public auth endpoints and persisted auth/session models.
- Produces: executable coverage for SQL injection payloads, token replay, session fixation/reuse, malformed bearer/cookies, enumeration resistance and revoked auth-version access.

- [ ] Add hostile input tests including `' OR 1=1 --` in email/token boundaries and prove no account/session bypass occurs.
- [ ] Add session fixation/replay tests proving server-issued rotated refresh tokens replace attacker-supplied/stale credentials.
- [ ] Verify unknown-account registration/reset responses do not disclose account existence beyond the existing contract.
- [ ] Fix only demonstrated defects with ORM/bound parameters and strict validation.
- [ ] Run focused tests plus full backend gate to GREEN.
- [ ] Commit the security regression slice.

### Task 3: Final exact-SHA verification

**Files:**
- Modify CI only if the current Quality Gate does not execute the added tests/migration checks.

**Interfaces:**
- Consumes: final PR head.
- Produces: exact-SHA evidence from Ruff, strict Pyright, pytest, Alembic heads and frontend gate.

- [ ] Fetch final PR head SHA.
- [ ] Observe the full Quality Gate on that SHA.
- [ ] Diagnose any failure instead of suppressing checks.
- [ ] Re-run after fixes and verify the final head is the SHA that passed.
