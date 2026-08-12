# Ozon Marketplace Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a production Ozon review/question vertical using the current official Seller API contracts and MPReply's existing marketplace-neutral orchestration.

**Architecture:** Keep `MarketplaceAccount`, `CustomerMessage`, sync states, replies, scheduler, audit, and entitlement flows generic. Add one Ozon HTTP boundary plus typed provider message context for SKU-dependent question operations. Enable Ozon only after credential validation, per-account stream scopes, read sync, exact preflight, and guarded writes are all covered.

**Tech Stack:** Python 3.13+, FastAPI, Pydantic 2, SQLAlchemy asyncio, httpx, Dramatiq, pytest/pytest-asyncio, Ruff, strict Pyright 1.1.411.

## Global Constraints

- Branch is `codex/0.1.104-backend` from exact baseline `f6d0bf4f8009538ffd47c1a3e629bc0614b5f5ac`.
- Version remains exactly `0.1.103`; no release, deploy, tag, merge, force-push, or dependency upgrade.
- Use only official Ozon contracts recorded in `docs/superpowers/specs/2026-08-12-ozon-marketplace-vertical-design.md`.
- No real provider request or write; tests use `httpx.MockTransport`.
- No raw credentials in logs, responses, fixtures, snapshots, audit metadata, or exceptions.
- Every behavior change follows RED, observed expected failure, minimal GREEN, focused regression, and one logical commit.
- Do not weaken Ruff, strict Pyright, tests, authorization, tenant isolation, idempotency, or retry safety.

## File structure

- `apps/api/app/adapters/ozon.py`: Ozon request construction, response narrowing, cursor handling, normalization, exact reply preflight, and send contracts.
- `apps/api/app/adapters/base.py`: optional typed provider context on preflight/send methods.
- `apps/api/app/services/reply_execution_service.py`: passes persisted message context and records ambiguous non-Yandex writes fail-closed.
- `apps/api/app/services/marketplace_account_service.py`: Ozon Client ID validation and safe validation metadata retention.
- `apps/api/app/services/marketplace_scheduler_service.py`: enables only streams present in the validated account scopes.
- `apps/api/app/adapters/capabilities.py`, `apps/api/app/adapters/registry.py`: expose Ozon only after the complete adapter is safe.
- `apps/api/app/tests/test_ozon_adapter_contract.py`: exact official wire contracts, parsing, normalization, pagination, error and ambiguity cases.
- `apps/api/app/tests/test_ozon_account_contract.py`: Client ID and validation metadata/account-scope behavior.
- `apps/api/app/tests/test_ozon_reply_safety.py`: context-aware preflight/send behavior and ambiguous-write blocking.

---

### Task 1: Typed provider context and fail-closed outbound ambiguity

**Files:**
- Modify: `apps/api/app/adapters/base.py`
- Modify: `apps/api/app/adapters/wildberries.py`
- Modify: `apps/api/app/adapters/yandex_market.py`
- Modify: `apps/api/app/services/reply_execution_service.py`
- Test: `apps/api/app/tests/test_ozon_reply_safety.py`
- Test: existing WB/Yandex reply safety tests

**Interfaces:**
- Consumes: existing `CustomerMessage.metadata_json` and `AdapterResult`.
- Produces: `ProviderMessageContext = Mapping[str, object]`; optional `context` on `send_review_reply`, `send_question_reply`, and `has_existing_reply`; generic non-Yandex ambiguity marker `outbound_send_ambiguity`.

- [ ] **Step 1: Write failing context-forwarding and ambiguity tests**

Create a typed fake adapter whose methods capture context. Assert `_send_through_adapter()` and preflight receive `message.metadata_json`. Add an execute-level regression where a non-Yandex send returns `network_timeout`: the reply becomes `manual_review_required`, message becomes `needs_manual_check`, entitlement is released, metadata contains an active ambiguity marker, and a subsequent execution never calls send.

```python
assert adapter.question_contexts == [{"ozon_sku": 646399170}]
assert reply.metadata_json["outbound_send_ambiguity"]["active"] is True
assert send_calls == 1
```

- [ ] **Step 2: Run the focused tests and capture RED**

Run: `python -m pytest -q app/tests/test_ozon_reply_safety.py`

Expected: context keyword/signature is missing and a network timeout currently enters retry-pending instead of manual review.

- [ ] **Step 3: Extend the adapter contract without changing existing provider behavior**

Use this exact type shape and optional keyword:

```python
from collections.abc import Mapping

ProviderMessageContext = Mapping[str, object]

async def send_question_reply(
    self,
    credential: str,
    external_id: str,
    reply_text: str,
    seller_id: str | None = None,
    *,
    context: ProviderMessageContext | None = None,
) -> AdapterResult: ...
```

Apply the same keyword to review send and preflight. Existing WB/Yandex adapters accept and ignore it where their official contracts do not need extra context. Pass a copied mapping from `CustomerMessage.metadata_json` at the service boundary.

- [ ] **Step 4: Persist fail-closed ambiguity through existing state/audit paths**

For non-Yandex outbound `network_timeout` or `network_error`, write:

```python
reply.metadata_json = {
    **(reply.metadata_json or {}),
    "outbound_send_ambiguity": {
        "active": True,
        "marketplace": message.marketplace,
        "reason": error_code,
        "recorded_at": now.isoformat(),
    },
}
```

Release entitlement, transition to manual review, emit the existing integration event and audit action, and never classify the result as broker-retryable. Do not replace the specialized Yandex exact-ID logic.

- [ ] **Step 5: Run focused regressions and commit**

Run focused Ozon/WB/Yandex reply tests, `python -m ruff check` on touched files, and strict Pyright. Commit only touched files:

```text
fix(marketplace): block ambiguous outbound retries
```

---

### Task 2: Ozon credentials and official HTTP boundary

**Files:**
- Create: `apps/api/app/adapters/ozon.py`
- Modify: `apps/api/app/services/marketplace_account_service.py`
- Test: `apps/api/app/tests/test_ozon_adapter_contract.py`
- Test: `apps/api/app/tests/test_ozon_account_contract.py`

**Interfaces:**
- Consumes: `AdapterResult`, encrypted `credentials`, account `seller_id`.
- Produces: private `_OzonClient`; `validate_credentials(api_key, client_id)` result data containing normalized operation scopes and `expires_at`.

- [ ] **Step 1: Write RED wire-contract tests for validation**

With `httpx.MockTransport`, assert `POST https://api-seller.ozon.ru/v1/roles`, JSON headers, no credential in URL/body, and response parsing. Use synthetic values only.

```python
assert request.headers["Client-Id"] == "client-123"
assert request.headers["Api-Key"] == "synthetic-api-key"
assert request.url.path == "/v1/roles"
assert result.data == {
    "scopes": ["fetch_reviews", "send_review_reply"],
    "expires_at": "2026-12-01T00:00:00Z",
}
```

Cover a review-only key, question-only key, neither supported contract, missing Client ID before network, malformed roles, 401/403/429/5xx, timeout, and `Retry-After` seconds.

- [ ] **Step 2: Run tests and capture expected RED**

Run: `python -m pytest -q app/tests/test_ozon_adapter_contract.py app/tests/test_ozon_account_contract.py`

Expected: Ozon client/provider validation does not exist and Ozon seller ID currently has no required check.

- [ ] **Step 3: Implement typed Ozon client request/error boundary**

Create `_OzonClient` with base URL `https://api-seller.ozon.ru`, a bounded timeout, optional injected transport, `_headers(api_key, client_id)`, `_request(path, json)`, safe JSON narrowing, and this status normalization:

```python
401 -> invalid_credentials
403 -> insufficient_scope
429 -> rate_limited
500..599 -> marketplace_unavailable
timeout -> network_timeout
other httpx transport error -> network_error
other provider rejection -> marketplace_error
```

Parse `Retry-After` as bounded non-negative seconds when present.

- [ ] **Step 4: Normalize exact method permissions and safe account metadata**

Treat a stream as supported only when all methods needed for that production flow are present:

```python
REVIEW_METHODS = {
    "/v2/review/list", "/v1/review/comment/list", "/v1/review/comment/create"
}
QUESTION_METHODS = {
    "/v1/question/list", "/v1/question/answer/list", "/v1/question/answer/create"
}
```

Return normalized operation scopes. Require a non-empty Ozon `seller_id` and retain only `expires_at`, checked time, and normalized scopes in `scopes_json`; never persist the raw roles payload.

- [ ] **Step 5: Run focused tests and commit**

Run the new contract tests, marketplace-account tests, touched Ruff, and strict Pyright. Commit:

```text
feat(ozon): add seller credential validation
```

---

### Task 3: Ozon review/question sync and normalization

**Files:**
- Modify: `apps/api/app/adapters/ozon.py`
- Test: `apps/api/app/tests/test_ozon_adapter_contract.py`
- Test: existing marketplace sync pagination/capability tests

**Interfaces:**
- Consumes: `_OzonClient`, `AdapterResult`, existing normalized customer-message dictionary shape.
- Produces: concrete `OzonAdapter(MarketplaceAdapter)` read operations and provider context `{"ozon_sku": int}`.

- [ ] **Step 1: Write RED review list/pagination/normalization tests**

Assert exact `POST /v2/review/list` body with `limit=100`, `sort_dir="ASC"`, and optional `last_id`; `next_cursor` is returned only for `has_next is True` plus a non-empty `last_id`. Assert only provider records with returned `status == "UNPROCESSED"` are extracted. Normalize exact review ID, text, rating, published timestamp, SKU, and source metadata; malformed ID/text/date/SKU is skipped rather than synthesized.

- [ ] **Step 2: Write RED question list/pagination/normalization tests**

Assert exact body:

```python
{
    "filter": {"status": "ALL"},
    "limit": 100,
    "last_id": "",
    "sort_dir": "ASC",
}
```

Only extract questions with `answers_count == 0` and returned status not `PROCESSED`. Normalize `id`, `text`, author name, published timestamp, product URL, and a positive integer SKU into both product data and `metadata_json["ozon_sku"]`.

- [ ] **Step 3: Run read-contract tests and capture RED**

Run the new list/normalization test nodes. Expected: concrete Ozon adapter and read methods are absent.

- [ ] **Step 4: Implement narrow parsing and cursor rules**

Use `Mapping[str, object]`, explicit list/item narrowing, strict datetime parsing, and positive-int SKU parsing at the external boundary. Return `malformed_payload` for a structurally invalid successful page instead of treating it as an empty page. Reuse generic sync cycle/page guards.

- [ ] **Step 5: Run focused sync regressions and commit**

Run Ozon adapter tests plus generic pagination/scheduled-sync tests, touched Ruff, strict Pyright. Commit:

```text
feat(ozon): sync seller reviews and questions
```

---

### Task 4: Ozon exact preflight, guarded sends, account-scoped scheduling, and enablement

**Files:**
- Modify: `apps/api/app/adapters/ozon.py`
- Modify: `apps/api/app/adapters/capabilities.py`
- Modify: `apps/api/app/adapters/registry.py`
- Modify: `apps/api/app/services/marketplace_scheduler_service.py`
- Test: `apps/api/app/tests/test_ozon_adapter_contract.py`
- Test: `apps/api/app/tests/test_ozon_account_contract.py`
- Test: `apps/api/app/tests/test_ozon_reply_safety.py`
- Test: existing capability/scheduler/registry tests

**Interfaces:**
- Consumes: `context["ozon_sku"]`, validation scopes, generic ambiguity protection.
- Produces: enabled Ozon capability for validated per-account review/question streams and exact outbound provider contracts.

- [ ] **Step 1: Write RED exact-preflight tests**

For reviews, page through `POST /v1/review/comment/list` (`limit=100`, ascending, increasing offset) and report answered only for a comment where `is_owner is True` and `is_published is True`. For questions, page through `POST /v1/question/answer/list` with exact `question_id`, numeric SKU, and `last_id`; any returned exact answer means answered. Assert missing/malformed SKU, provider error, malformed success, or cursor cycle returns a non-OK preflight and performs no write.

- [ ] **Step 2: Write RED send contract tests**

Assert exact bodies:

```python
{"review_id": review_id, "text": reply_text, "mark_review_as_processed": True}
{"question_id": question_id, "sku": 646399170, "text": reply_text}
```

Assert `comment_id`/`answer_id` is exposed as `marketplace_reply_id`, text outside the official question 2..3000 range fails before network, and timeout/network ambiguity is handled by Task 1 without blind retry.

- [ ] **Step 3: Write RED per-account scheduler tests**

Given Ozon account scopes containing only review operations, assert only the reviews state becomes active and questions stays paused; question-only is the inverse; both scopes enable both. Existing WB/Yandex accounts keep their current streams.

- [ ] **Step 4: Run focused tests and capture RED**

Run Ozon reply/account tests and marketplace scheduler/capability tests. Expected: sends, exact preflight, registry branch, and account-scoped scheduling are absent.

- [ ] **Step 5: Implement writes, scope-aware states, and enablement**

Enable Ozon capability operations for validate/fetch/send and page-token pagination only after the complete adapter is registered. Determine a stream from normalized operation scopes (`fetch_reviews`/`send_review_reply`, `fetch_questions`/`send_question_reply`); never infer provider subscription from account display data. Keep unsupported account streams paused and unscheduled.

- [ ] **Step 6: Run Ozon and neighboring regressions**

Run all Ozon tests, marketplace account/sync/scheduler/reply suites, protected Yandex guard, touched Ruff, and strict Pyright. Confirm no provider call occurred.

- [ ] **Step 7: Commit**

```text
feat(ozon): execute guarded seller replies
```

---

### Task 5: Ozon exact-tree verification and documentation alignment

**Files:**
- Modify only backend docs whose statements are now factually stale.
- Test: full repository/backend quality gate.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: reviewed Ozon production slice with evidence, while version remains `0.1.103`.

- [ ] **Step 1: Review final diff against the design spec**

Confirm exact endpoints/fields, subscription limitations, credentials handling, tenant boundaries, normalized errors, no blind retry, no secret output, no new dependency, no unrequested migration, and no Ozon runtime request.

- [ ] **Step 2: Run the required backend gate**

From repository root run integrity and tooling unittests. From `apps/api` run editable dev install, imports, `pip check`, Ruff, Pyright 1.1.411, full pytest, compileall, `alembic heads`, and `alembic history`.

- [ ] **Step 3: Run production container/config gates**

Build the API, worker, and scheduler production images/Compose targets affected by the shared API package. Record exact commands and results.

- [ ] **Step 4: Request independent code review and fix Critical/Important findings**

Review Ozon commits against this plan/spec. Use the original task implementer for fixes and a scoped reviewer for the changed delta until no Critical or Important issue remains.

- [ ] **Step 5: Commit factual documentation changes if needed**

If docs changed, commit only those files:

```text
docs(ozon): document seller integration limits
```
