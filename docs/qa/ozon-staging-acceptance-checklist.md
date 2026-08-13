# Ozon staging acceptance checklist

## Purpose

This checklist certifies Ozon in controlled stages without treating synthetic tests or an adapter probe as proof of production readiness.

Current boundary:

- the repository implements Ozon credentials, roles, review/question reads, scheduler streams, guarded sends, client workspace, and sanitized runtime evidence;
- automated verification uses synthetic payloads and `httpx.MockTransport`;
- no live Ozon request was made during the 2026-08-13 readiness audit;
- live provider behavior, the authorized seller account, and production sending remain **unverified** until the corresponding stages below are completed.

Only an authorized operator may run provider checks. The read-only stage does not authorize a reply, comment, answer, credential change at Ozon, merge, or deployment.

## Readiness verdict

| Surface | Status | Evidence or blocker |
| --- | --- | --- |
| Synthetic Ozon backend contracts | Ready | Focused local gate: 138 tests and 4 wrapper subtests passed on 2026-08-13. |
| Client workspace contracts | Ready | Current branch Quality Gate covers the Ozon workspace; live provider behavior is not part of that gate. |
| Authorized read-only adapter probe | Ready to run | Requires an authorized Ozon Client ID and API key. |
| Deployed-product read-only acceptance | Not certified | Requires an isolated staging organization, controlled scheduler state, approved handling of marketplace content, and an authorized account. |
| Provider write probe | Not authorized | Requires a separate approval, one exact disposable target, one approved non-sensitive text, and provider-cabinet reconciliation. |
| Production sending | Unverified | Requires reviewed read-only and write evidence plus an application-path pilot. |

## Confirmed implementation boundaries

- Ozon API credentials are sent as `Client-Id` and `Api-Key` only by the backend adapter.
- The API key is encrypted at rest; account responses expose only `credentials_masked`.
- Ozon `seller_id` stores Client ID internally and is returned as `null` by marketplace-account responses.
- Owner/admin may create, update, validate, rotate, revoke, and sync. Manager/viewer are read-only.
- Validation retains only `validated`, `checked_at`, normalized `scopes`, and optional `expires_at` in `scopes_json`.
- Reviews and questions activate independently. Each stream requires its complete fetch/send scope pair.
- A Client ID change or failed validation clears Ozon scopes and pauses scheduler states.
- Scheduler execution rechecks account status, credential status, and stream scopes before decrypting credentials.
- Ozon sends use an existing-reply preflight. Unknown preflight state blocks the write.
- Timeout, network failure, rate limit, provider unavailability, or malformed success after a send starts is not blindly retried; the reply requires reconciliation/manual review.
- Runtime evidence stores fingerprints, masked identifiers, counters, scopes, and safe error codes. It does not store provider content, raw credentials, full targets, or reply text.
- Backend overview metadata recursively removes keys containing credential, secret, token, API-key, authorization, cursor, Client ID, seller ID, or provider-body markers before returning integration events.

## Known certification limitations

These are not synthetic-test failures, but they prevent a broader readiness claim:

1. `.handoff/ozon-runtime-verification.json` does not exist as reviewed live evidence yet.
2. `ozon_runtime_probe.py` calls the adapter directly. It deliberately bypasses the deployed API, database, credential encryption lifecycle, scheduler, broker, worker, and client UI. A probe `PASS` certifies only the selected provider contract at the recorded SHA.
3. Runtime evidence schema version 2 does not expose Ozon `expires_at`. The deployed-product stage must verify the safe value from account `scopes_json` and stop if it is missing, malformed, or not later than the inspection time.
4. The PowerShell wrapper records the Git SHA but does not enforce a clean worktree itself. The operator must perform the clean-worktree gate below.
5. Manual application sync can read up to the application's bounded pagination limit and persists marketplace content. Do not use a real seller account until staging data access and retention are approved.

## Stage 0 — authorization and environment gate

- [ ] Record the authorized operator, Ozon account owner, staging organization, intended Git SHA, and allowed time window outside the repository.
- [ ] Confirm the Ozon account is a test/disposable account or that reading and persisting its reviews/questions in staging is explicitly authorized.
- [ ] Confirm which streams are expected: reviews, questions, or both. Do not interpret a missing subscription-gated stream as a software pass.
- [ ] Keep Client ID, API key, target IDs, SKU, marketplace content, and reply text out of commits, issues, chat, shell history, screenshots, recordings, HAR exports, and normal logs.
- [ ] Use the wrapper's secure prompt for the API key. Do not pass credentials or full identifiers as command-line arguments.
- [ ] Confirm `.handoff/` remains ignored and evidence will not be committed.
- [ ] Confirm the release candidate is deployed to an isolated staging environment before the deployed-product stage.
- [ ] Stop the staging scheduler before account validation. Successful validation activates authorized Ozon streams immediately with `next_run_at` set to the current time.
- [ ] Do not invoke reply queue, approve, retry, manual-send, `write-review`, or `write-question` operations during read-only stages.

## Stage 1 — clean release-candidate gate

Run from the repository root:

```powershell
git status --short --branch
git rev-parse HEAD
```

Acceptance:

- [ ] `git status --short --branch` contains only the branch header and no changed/untracked paths.
- [ ] The 40-character SHA is the intended deployed release candidate.
- [ ] The current GitHub Quality Gate for that exact SHA is green.
- [ ] The project runtime imports the Ozon probe without installing or changing dependencies during certification:

```powershell
Push-Location apps/api
try {
    .\.venv\Scripts\python.exe -c "import app.tools.ozon_runtime_probe"
}
finally {
    Pop-Location
}
```

Stop if any condition differs. Do not generate evidence from a dirty or mismatched checkout.

## Stage 2 — authorized read-only adapter probe

Run exactly once from the repository root. Let the wrapper prompt for missing values:

```powershell
pwsh -NoProfile -File scripts/ozon-runtime-probe.ps1 -Mode read-only -MaxPages 2
```

Expected provider operations are limited to:

- `POST /v1/roles`;
- `POST /v2/review/list` only when the returned methods produce the complete review scope pair;
- `POST /v1/question/list` only when the returned methods produce the complete question scope pair.

The read-only mode must not call review-comment, question-answer, or any other write endpoint.

Inspect only the sanitized structure:

```powershell
$ozonEvidencePath = Join-Path $PWD ".handoff\ozon-runtime-verification.json"
$ozonEvidence = Get-Content -LiteralPath $ozonEvidencePath -Raw | ConvertFrom-Json
$ozonEvidence | Select-Object schema_version,provider,mode,status,git_sha,app_version,page_budget,pages_checked,scopes,write_attempted,write_confirmed
$ozonEvidence.steps | Format-Table name,status,error_code,retry_after_seconds,pages_checked,items_seen
```

Acceptance:

- [ ] `schema_version` is `2`.
- [ ] `provider` is `ozon`, `mode` is `read-only`, and `status` is `PASS`.
- [ ] `git_sha` equals the clean release-candidate SHA.
- [ ] `credential_fingerprint` has the form `sha256:` plus 12 lowercase hexadecimal characters.
- [ ] `account_id_masked` contains only a character count and no Client ID.
- [ ] `page_budget` is `2`; every fetch step reports between 1 and 2 pages.
- [ ] `scopes` contains at least one complete pair:
  - reviews: `fetch_reviews` and `send_review_reply`;
  - questions: `fetch_questions` and `send_question_reply`.
- [ ] `validate_credentials` is the first step and is `PASS`.
- [ ] Only authorized stream fetch steps are present, and each is `PASS`.
- [ ] No `write_preflight`, `write_send`, or `write_postflight` step exists.
- [ ] `write_target_fingerprint` is `null`, `write_attempted` is `false`, and `write_confirmed` is `null`.
- [ ] Independent inspection finds no API key, Client ID, review/question text, full target, SKU, or reply text in the evidence.

Stop on `FAIL`, `BLOCKED`, or `AMBIGUOUS`. Do not rerun to obtain a different result. Record the safe error code and investigate the contract or account configuration first.

## Stage 3 — deployed-product read-only acceptance

This stage verifies the application path that the direct adapter probe does not cover. Keep the scheduler stopped until the explicit scheduler step.

### 3.1 Connection lifecycle

- [ ] Sign in as owner/admin in the isolated staging organization.
- [ ] Create one Ozon connection with a non-sensitive display name, the authorized Client ID/API key, and `semi_auto` response mode.
- [ ] Do not export or retain the browser request payload; it necessarily contains the credential during submission.
- [ ] Confirm the create response and subsequent account/overview responses contain `seller_id: null`, never the raw Client ID, and never the API key.
- [ ] Confirm only a masked credential fingerprint is displayed.
- [ ] Confirm initial account and credential states are `pending_validation` and both scheduler streams are paused.

### 3.2 Validation and scopes

- [ ] Run account validation once.
- [ ] Confirm successful state is `active` with `credentials_status: valid`.
- [ ] Confirm `scopes_json` contains only safe validation metadata: `validated`, `checked_at`, `scopes`, and `expires_at` when supplied by Ozon.
- [ ] Parse `expires_at` and confirm it is later than the current UTC inspection time. Stop if it is missing, malformed, or expired.
- [ ] Confirm review-only credentials leave `questions` paused.
- [ ] Confirm question-only credentials leave `reviews` paused.
- [ ] Confirm credentials with both complete pairs activate both streams.
- [ ] Confirm an unsupported/missing complete scope pair produces a safe blocked/error state and does not activate that stream.

### 3.3 Read-only sync

- [ ] Confirm the account is authorized to persist its marketplace content in staging before starting sync.
- [ ] Run one manual sync and record only sanitized counters/status, not marketplace content.
- [ ] Confirm the sync uses only validated streams and finishes with either a reviewed safe failure or `success`.
- [ ] Confirm normalized messages have provider external IDs; Ozon question records have a validated positive `ozon_sku` in backend metadata.
- [ ] Run a second manual sync only if duplicate/idempotency verification was explicitly included in the authorization. Confirm existing messages update instead of creating duplicates.
- [ ] Inspect the account overview: health, stream states, recent jobs, and recent integration events must contain no raw Client ID, API key, provider body, authorization header, cursor, or marketplace content.

### 3.4 Controlled scheduler cycle

- [ ] Start the staging scheduler and worker only after manual-sync inspection is complete.
- [ ] Observe one scheduler claim and one completed page/cycle for each authorized stream.
- [ ] Confirm unauthorized streams remain paused and are never claimed.
- [ ] Confirm cursor-cycle/page-budget protection produces a safe stopped/error state rather than an unbounded loop.
- [ ] Stop the scheduler after the observed cycle unless continued read-only polling was explicitly authorized.
- [ ] Disable the Ozon account after the read-only session if no immediate write-certification session is approved.

### 3.5 RBAC and redaction

- [ ] Owner/admin can see the intended credential actions.
- [ ] Manager/viewer see read-only state and no credential mutation controls.
- [ ] A direct manager/viewer mutation attempt returns authorization failure before credential decryption or provider access.
- [ ] Application logs, audit records, account responses, overview responses, and evidence contain no raw Client ID/API key or provider request/response body.

## Stage 4 — separately authorized write certification

Do not begin this stage from the approval for read-only work.

Required approval must identify exactly one operation and target:

- review: `OZON_REVIEW_ID` and approved `OZON_REPLY_TEXT`;
- question: `OZON_QUESTION_ID`, positive `OZON_QUESTION_SKU`, and approved `OZON_REPLY_TEXT`;
- exact confirmation: `I_UNDERSTAND_OZON_WRITE`.

Safety sequence:

- [ ] Reconfirm clean SHA, account fingerprint, target, text, and provider-cabinet visibility.
- [ ] Confirm the target is disposable, unanswered, and belongs to the authorized account.
- [ ] Run the matching write mode exactly once.
- [ ] Confirm preflight ran before one provider mutation.
- [ ] Confirm postflight and the Ozon cabinet show the expected single reply.
- [ ] Stop after `AMBIGUOUS`; inspect the cabinet and never automatically resend.
- [ ] Treat adapter write-probe `PASS` as provider-contract evidence only.
- [ ] Separately execute one guarded application-path pilot if production sending is to be certified.

## Final certification record

The reviewed record may contain only:

- release-candidate Git SHA and application version;
- evidence filename and its sanitized fingerprint fields;
- provider, mode, final status, scopes, page counts, safe step/error codes, and timestamps;
- staging account's internal MPReply UUID when access policy permits it;
- operator decision: `verified`, `blocked`, `failed`, or `ambiguous`.

It must not contain raw credentials, Client ID, full provider target, SKU, marketplace content, reply text, HAR data, or provider request/response bodies.

Ozon may be described as runtime-certified only after the required stages are reviewed for the exact release candidate. A read-only adapter `PASS` alone is not production-sending certification.
