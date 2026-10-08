# WB runtime evidence and Linux visual acceptance

## Production evidence collected 2026-10-07

The API container was still running `74cae87d9d76b6312b8d5ae4df4b063d7137f5a7`. `WB_SERVICE_SECRET` was absent. New coordination changes were not deployed.

Read-only queries joined replies to customer messages by both message and organization. WB had zero `sent` replies across all history and the last 30 days. Message statuses had no answered or auto-reply-sent rows. There were 40 automatic `retry_pending/rate_limited` replies; their latest attempt was 15:50:18 UTC and next retry started at 16:00:18 UTC. Other drafts and review states are not sends. The preceding 24-hour event window contained 2,752 `reply.send/retry_pending/rate_limited` events and no successful send event.

Existing events contained only reply/message IDs and attempt counts, so they cannot establish whether each historical retry stopped during preflight or write. New retry events explicitly record `execution_stage` (`preflight` or `write`), the adapter's requested `retry_after_seconds` when present, and the scheduled `retry_delay_seconds`. A write stage means the write adapter was invoked; a local coordination gate may still defer it before HTTP. No customer text, tokens, seller identifiers or arbitrary provider headers are included.

The measured one-request provider budget remains a blocker: a successful fresh preflight can consume the only slot, deferring the subsequent write; another execution starts with a fresh preflight again. Shared coordination avoids redundant requests but does not create quota. Do not remove preflight, reuse stale checks, bypass the limiter, or report a send without a provider receipt. Official [WB token limits](https://dev.wildberries.ru/news/281) distinguish base and service token budgets; [service authorization](https://dev.wildberries.ru/news/144) describes the service token and WB-issued `X-Client-Secret`. Configuration alone does not certify entitlement or successful publication.

The 2026-10-08 continuation reached an expired Dokploy session. Fresh runtime/header verification and deploy remain dependent on restoring that access; the previous slice is timestamped evidence, not current state.

## Sent analytics provenance

Preflight convergence on an existing answer retains its terminal state and duplicate-send protection, but is excluded from MPReply send counters, daily sent series, team sends, AI acceptance and own response-time calculations. The predicate excludes only an explicit `externally_already_answered=true`; legacy rows with no flag continue to count. Organization and period filters remain in place. Runtime quotas and plan limits are unchanged by this statistics correction.

Regressions exercise actual and legacy sends, an external answer, a different organization, and an out-of-period receipt in a real SQL session. Separate execution regressions prove retry events distinguish preflight and write while preserving retry status, attempt accounting and no-write preflight behavior.

## Linux visual acceptance

An independent read-only reviewer examined all five approved source renders, full-page Linux/Windows desktop pairs, and native-width 390px mobile tiles covering the complete five pages. No clipping, overlap, missing artwork or CTA/card/calculator/table containment defect was found. Small platform text-rendering/wrapping differences remain readable and contained.

The artifact from CI `37645705485`, head `46015399`, contains three byte-identical and pixel-identical observed attachments for every comparison. All thirty comparison errors specifically identified missing Linux expected files. The ten exact pre-matcher attachments were copied to their platform-specific expected filenames after verifying SHA256. No matcher tolerance, test coverage, approved layout, Windows image or update-snapshot policy changed.

| Filename prefix | Desktop attachment | Mobile attachment |
| --- | --- | --- |
| home | 1175e170efc61acb0627c516aecefd22c98352f0.png | fb07b32cd994c8802c69dcd14a36781ffb77fb0e.png |
| features | 9e810a80f4431a0260189b1f39177a363a2b1bf3.png | 9b0874c106326f8b8c23076005898868ec3f7027.png |
| marketplaces | 3f2638ab2b7d229b771b0e04f586718286bc7e69.png | 5f58cc91fccbac9ee54ba7765477f44ac88d571e.png |
| marketplace-wildberries | 37f3f0ae52cf91d562cd52a264b30e6ea1fcb0f2.png | b5834c4674510e802980127fc9dbcbdca2f6025e.png |
| pricing | ff3d050ccf1e548d3c78e8ff3fb3ea86aa6468bf.png | aeb24d1c5a64fe28de6bef6fdf225a1790f78656.png |

These attachment names are relative to the archived `ci-linux-46015399/playwright-report/data`. Review and all retry checksums are preserved outside the repo in the continuation chat's `linux-review/review.md`, `review.json` and `mapping.json` artifacts. Acceptance of images is not a green CI result or a provider/release certification. Final checks and delivery results are recorded below when observed.

## Local validation

The two stage regressions failed first because events lacked stage/delay fields. The analytics regression first observed 3 sends instead of 2 because the external answer was counted. After the minimal fixes, the full backend suite passed: 680 passed, 46 skipped; Ruff and strict Pyright passed, and repository integrity passed. Two existing dependency deprecation warnings remain. SQLite does not implement PostgreSQL interval arithmetic; the response-time test executes the actual aggregate input query and verifies its selected rows and durations instead of claiming PostgreSQL execution on SQLite.

The new code received an independent read-only review with no remaining P1/P2 in this patch. External-answer rows still affect pre-existing runtime quotas/plan-limit accounting; these conservative send constraints were not loosened by the analytics change.
