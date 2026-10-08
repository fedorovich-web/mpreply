# WB runtime evidence and Linux visual acceptance

## Production evidence collected 2026-10-07

The API container was still running `74cae87d9d76b6312b8d5ae4df4b063d7137f5a7`. `WB_SERVICE_SECRET` was absent. New coordination changes were not deployed.

Read-only queries joined replies to customer messages by both message and organization. WB had zero `sent` replies across all history and the last 30 days. Message statuses had no answered or auto-reply-sent rows. There were 40 automatic `retry_pending/rate_limited` replies; their latest attempt was 15:50:18 UTC and next retry started at 16:00:18 UTC. Other drafts and review states are not sends. The preceding 24-hour event window contained 2,752 `reply.send/retry_pending/rate_limited` events and no successful send event.

Existing events contained only reply/message IDs and attempt counts, so they cannot establish whether each historical retry stopped during preflight or write. New retry events explicitly record `execution_stage` (`preflight` or `write`), the adapter's requested `retry_after_seconds` when present, and the scheduled `retry_delay_seconds`. A write stage means the write adapter was invoked; a local coordination gate may still defer it before HTTP. No customer text, tokens, seller identifiers or arbitrary provider headers are included.

Live [WB category documentation](https://dev.wildberries.ru/docs/openapi/customer-communication) was inspected on 2026-10-08: all category methods share a basic-token budget of five requests per hour, twelve-minute interval and burst one. `X-Ratelimit-Limit` is burst, not hourly quota. Fresh preflight consumes the available slot; a retry starts with another GET. Shared coordination avoids redundant requests but does not create quota. Do not remove preflight, reuse stale checks, bypass the limiter, or report a send without a provider receipt.

The owner excludes Catalog listing. The [current authorization documentation](https://dev.wildberries.ru/docs/openapi/api-information) permits basic keys outside the Catalog, and an absent service secret does not prove an authorization defect. WB also describes enhanced basic-token access for authorized services not listed in the Catalog; its [official moderator response](https://dev.wildberries.ru/forum/2069) explains an application path without Catalog inclusion. This is an external option requiring WB's decision, not an existing MPReply entitlement or a prerequisite for basic authentication.

After the owner restored the Dokploy session, a 2026-10-08 read-only slice still showed deployment `74cae87d`, 40 automatic rate-limited retries and zero WB sends across all history. The preceding 24-hour window contained 5,991 rate-limited retry events. A preflight-only probe of an actual pending item stopped in the old Redis gate with 450 seconds remaining, without HTTP or writes. Token routing fields were `acc=1`, `t=false`, `s=702`; no token value was exposed.

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

CI run `37727780272` on `ae46419a` passed backend and the full frontend gate, including the ten Linux comparisons. Container validation and API/worker image builds passed, but the web image build failed because the workflow omitted its mandatory `NEXT_PUBLIC_API_BASE_URL` argument. The workflow now supplies the same public local API URL used by the frontend job; the Dockerfile's required-argument guard is unchanged. No local Docker invocation or gate suppression was used. The corrected head requires a new CI run.

CI `37729162663` on `599925b0` completed successfully: backend, frontend and containers all passed.

## Own-seller installation

The owner confirmed that cabinet `123` belongs to him and this installation is used only for that cabinet. A fresh backend-only routing inspection found the stored key is basic (`acc=1`, `t=false`), has writable category scope, and is valid. No raw token or seller UUID was printed. Writable rights do not change the basic category quota.

The explicit `self_hosted` mode requires a SHA256 binding to the canonical seller UUID. It permits only non-test basic/personal keys for that seller and forbids mixing a service secret with own mode. Cloud remains the default and continues to reject personal/test keys. Production Redis coordination stays enabled for both modes and adapter roles. Preflight, idempotency, leases, receipt handling and ambiguous-write behavior are untouched.

New tests first failed for missing configuration/constructor support; the production registry regression separately failed with `insufficient_scope`. The implementation passed 75 focused tests, then the full backend suite: 696 passed, 46 skipped, two existing dependency deprecation warnings. Ruff and integrity passed. Strict Pyright identified test argument typing; after explicit annotations it passed with zero errors and all 13 own-mode cases passed. An independent read-only review found no P1/P2. Effective Dokploy patch/environment and live key type must be verified after deployment before claiming working provider sends.
