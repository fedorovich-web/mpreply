# Avito Client Credentials Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified, encrypted Avito client-credentials token lifecycle without risking duplicate Messenger writes.

**Architecture:** Add a typed authentication boundary beside the Avito adapter. Keep the shared marketplace credential API and database model unchanged, resolve bearer tokens before provider calls, allow one read-only auth refresh, and never retry a POST.

**Tech Stack:** Python 3.13, FastAPI, HTTPX, Pydantic settings, SQLAlchemy, pytest, Ruff, strict Pyright.

## Global Constraints

- Project version remains `0.1.103`.
- No live marketplace calls or writes.
- Yandex protected Question ID `27265525` is never used.
- No new dependency, migration, merge, deploy, tag, force-push, or version bump.
- Do not print or persist raw Client ID, Client Secret, access token, provider body, or customer content outside the existing encrypted credential field.
- Do not retry an Avito POST after the request starts.

---

### Task 1: Typed Avito OAuth boundary

**Files:**
- Create: `apps/api/app/adapters/avito_auth.py`
- Create: `apps/api/app/tests/test_avito_client_credentials.py`

**Interfaces:**
- Produces: `AvitoCredentialResolver.resolve(raw: str) -> AvitoResolvedCredential | AdapterResult` and `invalidate(raw: str) -> None`.
- Produces: `AvitoResolvedCredential(access_token: str, authentication: Literal["client_credentials", "access_token"])`.

- [ ] Write tests for exact form encoding, strict JSON credential parsing, strict token response parsing, safe status/error mapping, cache reuse, cache expiry, bounded eviction, and legacy access-token compatibility.
- [ ] Run `python -m pytest app/tests/test_avito_client_credentials.py -q` once and verify collection fails because `app.adapters.avito_auth` does not exist.
- [ ] Implement the minimal typed resolver with injected `httpx.AsyncBaseTransport` and injected monotonic clock.
- [ ] Run the same test module once and obtain GREEN.
- [ ] Run touched Ruff and strict Pyright for the new boundary.

### Task 2: Safe adapter integration

**Files:**
- Modify: `apps/api/app/adapters/avito.py`
- Modify: `apps/api/app/tests/test_avito_adapter_contract.py`
- Modify: `apps/api/app/tests/test_avito_reply_safety.py`

**Interfaces:**
- Consumes: Task 1 resolver.
- Produces: all existing `AvitoAdapter` public methods with unchanged signatures and resolved bearer authentication.

- [ ] Add RED tests proving client credentials obtain a token before Messenger GET, two GETs reuse one token, an auth-failed GET refreshes once, and an auth-failed POST performs exactly one Messenger POST.
- [ ] Inject an optional resolver into `AvitoAdapter`; default construction uses the production resolver.
- [ ] Resolve before each request, invalidate on `401/403`, retry only one GET, and retain current no-blind-retry POST results.
- [ ] Run the new auth module plus Avito adapter/reply/sync focused matrix once.
- [ ] Run touched Ruff and strict Pyright.

### Task 3: Account metadata and truthful documentation

**Files:**
- Modify: `apps/api/app/services/marketplace_account_service.py`
- Modify: `apps/api/app/tests/test_avito_account_contract.py`
- Modify: `DEVELOPMENT_STATUS_0.1.104.md`
- Modify: `docs/qa/marketplace-runtime-certification-runbook.md`

**Interfaces:**
- Consumes: adapter validation data key `authentication`.
- Produces: safe `scopes_json.authentication` with no credential material.

- [ ] Add a RED account-service assertion for `authentication=client_credentials` and no Client ID/secret in response or metadata.
- [ ] Persist only the normalized authentication method after successful Avito validation.
- [ ] Document the exact JSON input contract, legacy access-token compatibility, and synthetic-only verification status.
- [ ] Run the focused account/auth/adapter matrix once.
- [ ] Run `git diff --check` and scan the diff for secrets and authored production comments.

### Task 4: Final grouped verification and commit

**Files:**
- Verify all intended files only.

- [ ] Run full backend pytest once.
- [ ] Run Ruff over `app` and `alembic`, strict Pyright over `app`, compileall, Alembic heads/history, repository tooling tests, and integrity once.
- [ ] Commit only the design, plan, implementation, tests, and truthful documentation with a scoped message.
- [ ] Push the existing feature branch and observe one current-SHA GitHub Quality Gate.
- [ ] Report live Avito OAuth/Messenger runtime as unverified; do not merge, deploy, tag, or bump the version.
