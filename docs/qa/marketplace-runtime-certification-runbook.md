# Marketplace runtime certification runbook

## Purpose and current boundary

This runbook collects sanitized runtime evidence for Wildberries, Yandex Market, Ozon, and Avito. Unit and contract tests do not prove that a live credential, account, target, or provider response currently works. Until a probe is run against the provider and its JSON evidence is inspected, live runtime certification is **unverified**.

The commands below are read-only. They may contact the selected marketplace, but they do not intentionally send a reply, create a chat message, or mark a chat as read. Do not run them without authorization to use the relevant credential and account.

## Required safety sequence

Use this complete sequence separately for each provider:

1. Confirm the repository SHA and clean worktree.
2. Run `read-only` once.
3. Inspect the JSON status, fingerprint, page counts, scopes, and steps.
4. Confirm that no raw credential, full identifier, or marketplace content is present.
5. Stop on `FAIL`, `BLOCKED`, or `AMBIGUOUS`.
6. Obtain separate authorization before selecting a write mode.
7. Use one exact disposable target and one non-sensitive reply text.
8. Run the write mode once.
9. Verify the provider cabinet before any further action.

Before every probe, run:

```powershell
git status --short --branch
git rev-parse HEAD
```

Stop if the worktree is not clean or the SHA is not the intended release candidate. Evidence is written atomically under `.handoff/` and must remain uncommitted.

## Read-only commands

Run from the repository root in this fixed order. Each wrapper prompts securely for a missing credential unless `-NoPrompt` is explicitly selected.

### 1. Wildberries

```powershell
pwsh -NoProfile -File scripts/wildberries-runtime-probe.ps1 -Mode read-only -MaxPages 2
```

Evidence: `.handoff/wildberries-runtime-verification.json`.

### 2. Yandex Market

```powershell
pwsh -NoProfile -File scripts/yandex-market-runtime-probe.ps1 -Mode read-only -MaxPages 2
```

Evidence: `.handoff/yandex-market-runtime-verification.json`.

### 3. Ozon

```powershell
pwsh -NoProfile -File scripts/ozon-runtime-probe.ps1 -Mode read-only -MaxPages 2
```

Evidence: `.handoff/ozon-runtime-verification.json`.

### 4. Avito

The production account credential accepts either a pre-obtained access token or the exact encrypted JSON value `{"client_id":"<CLIENT_ID>","client_secret":"<CLIENT_SECRET>"}`. Client credentials are exchanged through the official OAuth 2 token endpoint. The current certification wrapper deliberately continues to require a separately obtained `AVITO_ACCESS_TOKEN`; this keeps the live probe read/write arming surface independent from stored production credentials and does not constitute a live OAuth verification.

```powershell
pwsh -NoProfile -File scripts/avito-runtime-probe.ps1 -Mode read-only -MaxPages 2
```

Evidence: `.handoff/avito-runtime-verification.json`.

## Evidence inspection

A successful wrapper accepts only `status: "PASS"`. Inspect the file independently before treating it as evidence. Verify:

- `schema_version` is `2`;
- `git_sha` equals the intended clean repository SHA;
- `provider` and `mode` are correct;
- credential, account, and target values appear only as masked fingerprints;
- `page_budget`, `pages_checked`, `scopes`, and every step are plausible for the authorized account;
- no review text, question text, chat text, reply text, raw credential, or full identifier is present.

`FAIL` means a contract or response check failed. `BLOCKED` means configuration, authorization, scope, or preflight prevented execution. `AMBIGUOUS` means a write may have reached the provider but could not be proven; never repeat it automatically. Any of these statuses ends the run.

## Write-mode authorization data

This section deliberately contains no executable write command, real credential, target, SKU, timestamp, or reply text. Supplying the variables and selecting a write mode requires separate authorization for one disposable target.

### Wildberries

Modes: `write-review`, `write-question`.

Required names:

- `WILDBERRIES_API_KEY`
- `WILDBERRIES_REVIEW_ID` or `WILDBERRIES_QUESTION_ID`
- `WILDBERRIES_REPLY_TEXT`

Exact confirmation: `I_UNDERSTAND_WILDBERRIES_WRITE`.

### Yandex Market

Modes: `write-review`, `write-question`.

Required names:

- `YANDEX_MARKET_API_KEY`
- `YANDEX_MARKET_BUSINESS_ID`
- `YANDEX_MARKET_REVIEW_ID` or `YANDEX_MARKET_QUESTION_ID`
- `YANDEX_MARKET_REPLY_TEXT`

Exact confirmation: `I_UNDERSTAND_YANDEX_MARKET_WRITE`.

Yandex Question ID `27265525` is forbidden and must never be used by the runtime probe.

### Ozon

Modes: `write-review`, `write-question`.

Required names:

- `OZON_API_KEY`
- `OZON_CLIENT_ID`
- `OZON_REVIEW_ID` or `OZON_QUESTION_ID`
- `OZON_QUESTION_SKU` for a question
- `OZON_REPLY_TEXT`

Exact confirmation: `I_UNDERSTAND_OZON_WRITE`.

### Avito

Modes: `write-chat-message`, `write-mark-read`.

Required names for a chat message:

- `AVITO_ACCESS_TOKEN`
- `AVITO_USER_ID`
- `AVITO_CHAT_ID`
- `AVITO_INBOUND_CREATED_UNIX`
- `AVITO_MESSAGE_TEXT`

Exact chat-message confirmation: `I_UNDERSTAND_AVITO_CHAT_WRITE`.

Mark-read requires `AVITO_ACCESS_TOKEN`, `AVITO_USER_ID`, and `AVITO_CHAT_ID`. Exact mark-read confirmation: `I_UNDERSTAND_AVITO_MARK_READ`.

## Stop and escalation rules

- Never rerun a write after `AMBIGUOUS`; inspect the provider cabinet first.
- Never substitute a different target without new authorization.
- Never attach raw evidence containing marketplace content or identifiers to an issue or commit.
- If the evidence fingerprint, SHA, page counts, scopes, or step order is unexpected, classify the live result as unverified and stop.
