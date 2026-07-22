# MPReply 0.1.23 release verification

## Purpose

CI hotfix for the three Chromium E2E failures reported by GitHub Actions after pushing `0.1.22`.

## Root causes

1. `automation-rules.spec.ts` used `getByText("Balanced auto")`, which matched both the rule-list button and the detail-panel heading. Playwright strict mode rejected the ambiguous locator.
2. The generic AI draft-history route mock matched `/api/ai/drafts/generate`, so the generation request could receive the history payload instead of the generated-draft response.

## Changes

- Automation Rules E2E assertions now use `getByRole("heading", { name: "Balanced auto" })`.
- AI draft-history routing now uses an end-anchored regular expression that matches only `/api/ai/drafts` plus an optional query string and excludes `/api/ai/drafts/generate`.
- Added `tests/unit/e2e-route-contract.test.ts` to protect the AI route-matching invariant.
- Version synchronized to `0.1.23`.

## Verification performed on the final 0.1.23 tree

- Frontend unit tests: PASSED — 20/20, 9/9 test files.
- New E2E route regression contract: PASSED.
- TypeScript typecheck: PASSED.
- ESLint: PASSED after removing Playwright-generated artifacts from the failed local browser attempt.
- Chromium E2E in this execution environment: BLOCKED by system policy with `net::ERR_BLOCKED_BY_ADMINISTRATOR` before application assertions run.
- GitHub Actions Chromium E2E: NOT YET VERIFIED. The hotfix must be pushed and the actual Quality Gate result observed before calling CI GREEN.

## Important release status

`0.1.23` is a targeted CI hotfix candidate. It is not claimed as GitHub CI GREEN until the repository Quality Gate completes successfully after push.
