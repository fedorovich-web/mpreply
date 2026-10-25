# Account recovery and concurrent auth mutations — 25 October 2026

## Repaired behavior

Password changes now reload and serialize the user before checking the current password and incrementing the authentication version. Issuing an action token uses the same per-user lock before evaluating account eligibility, cooldown and outstanding tokens. Consuming a verification/reset token discovers its owner, then locks user → token and reloads both entities. This prevents stale-hash acceptance, stale token replay, concurrent token issuance and the opposing lock order that deadlocked two reset tokens.

The user lock is PostgreSQL `FOR NO KEY UPDATE`, preserving compatibility with child-row foreign-key checks. Existing password reset/change session revocation, token digests, generic public responses, Redis limits and route contracts remain. The existing endpoint transaction, including bounded email delivery during token issuance, still commits or rolls back as a unit; no outbox or new framework is introduced.

Login exposes the existing password-recovery and verification-resend actions. Their request pages are available in RU and EN; actual email links retain the existing backend routes. English forms display localized generic outcomes after a valid API response, without exposing the Russian server text or revealing account existence.

Password-reset input and mutation state belong to the current URL token. Verification handles replacement tokens, ignores late results from an earlier token, and retains its request through React StrictMode effect replay. The previous mutation observer could detach during replay and leave the page pending indefinitely.

Removed the unreachable disabled Yandex placeholder prop, markup, its obsolete test and 60 dedicated CSS lines. No production caller requested the placeholder. The real provider-driven `YandexAuthButton`, active layout, assets and design tokens are unchanged.

README now describes the actual `auto`/`semi_auto` modes, Groq configuration and the difference between a configured release label and verified deployed source.

## Regression and integration evidence

- Six new SQLite service regressions failed against the original source, then passed: cached password/authentication-version state, consumed-token replay and changed account eligibility.
- Four native PostgreSQL auth cases also failed before the fix. Distinct reset tokens reproduced an actual `DeadlockDetectedError`; competing password changes accepted the original password twice, and token issuance bypassed cooldown serialization.
- After the fix, the native auth/OAuth/worker selection passed **11 tests, zero skipped**. Schema upgrade and ORM metadata checks passed. The isolated loopback cluster was stopped and its test port verified closed. No Docker or production database was used.
- Complete default backend suite: **804 passed, 58 PostgreSQL-dependent skips**, with the same two upstream test-client deprecation warnings. This batch's four new PostgreSQL cases executed separately; the other native selections have their prior receipts and were not repeated without a changed risk.
- Complete frontend unit suite: **622 passed**; design-token suite: **59 passed**. TypeScript, ESLint, Knip, CSS syntax, production build and repository integrity passed. Whole-API Ruff, strict Pyright, compilation and Alembic-head checks passed.
- Two production-build Chromium browser scenarios passed for RU/EN login → recovery/resend navigation and mocked API submission. Axe scanned each form before submission and its success state afterward. API routes were intercepted, and unknown API requests were blocked. No real email or provider call was made.
- W3C/Nu checks passed for **49 stylesheet sources and 66 rendered routes**. The route-coverage guard first rejected the two newly added English request pages; adding those exact routes preserved the guard and brought them under validation.
- Frontend regressions cover query-token replacement, late success/failure isolation, reset input/completion state, StrictMode replay and localized recovery outcomes. Independent source review found no blocking P1/P2 issue in the auth implementation/tests and confirmed removal of the unused placeholder. The review's accessibility coverage finding was addressed before the browser run.

Only changed-flow browser/accessibility checks were run. No visual baseline or tolerance changed; pixel comparison and Lighthouse were not repeated for this auth behavior batch.

## Delivery boundary

The PostgreSQL auth file joins the existing CI selection without removing any prior gate. Local evidence, GitHub Actions, Git delivery, deployment and provider outcomes remain separate. The account's zero-dollar Actions budget is unchanged.

Any deployment must explicitly target API/web with `--no-deps`, keeping worker/scheduler paused. No real marketplace reply, paid AI generation, payment, outbound email or production password mutation is part of this verification. Protected `.handoff/`, `apps/cms/`, the retained backend work and original stashes remain untouched.
