# WB coordination, repository cleanup and reviewed visual baselines

## WB evidence and scope

The production account uses a base token (`acc=1`). One diagnostic read returned HTTP 429 with `X-Ratelimit-Limit: 1`, remaining 0 and retry/reset 566 seconds. No token, seller ID, response body or credentials were recorded. Earlier runtime inspection found 40 automatic replies waiting on rate limits and zero confirmed automatic sends.

The old limiter coordinated only GET requests and keyed each path separately. Reviews, questions, detail preflight and reply writes now share a Redis category budget, keyed by a hash of seller identity when available or credential identity otherwise. `/ping` remains separate. Every write uses the same gate and is attempted at most once; preflight, idempotency and ambiguous-write protections remain intact.

Redis failure before a provider call produces `coordination_unavailable`, a safe deferred attempt with a 30-second retry and no consumed publication attempt. Cleanup failure cannot discard an observed successful provider response or replace the original timeout. Real provider 5xx, malformed success and uncertain HTTP writes remain subject to manual reconciliation.

`WB_SERVICE_SECRET` is backend-only, mapped through both Compose files and the effective Dokploy patch. It supplies `X-Client-Secret` when configured. Cloud credentials reject test/personal tokens. WB remains the authority for token signatures and matching service credentials. See the [official WB authorization rules](https://dev.wildberries.ru/news/144).

**External blocker:** with a one-request budget, preflight can consume the request required for publication. Shared coordination prevents redundant provider requests but does not create a second quota slot or certify automatic sending. Service-secret issuance and applicable WB entitlement must be resolved, then verified against actual provider headers and a permitted send. No fictional success or lowered publication safeguards are introduced.

## Connection status

The green badge means active, validated access. It does not assert successful synchronization. Current load failures and scheduled resumption appear separately. Expected provider cooldown does not count as lost access; invalid/revoked credentials and genuine load errors remain visible. The same separation applies to the generic marketplace account screen.

## Reviewed visual baseline migration

The ten comparisons for `/`, `/features`, `/marketplaces`, `/marketplaces/wildberries` and `/pricing` had failed since earlier approved layout changes. Their old images described obsolete copy, three tariffs, old headers/eyebrows/CTA strips and FAQ composition. Restoring those obsolete states merely to match a golden would contradict current product and design instructions.

Before accepting replacements, an independent read-only reviewer inspected all five approved source renders, desktop/mobile actual–expected–diff images and native-width mobile views. The review found no clipping, overlap, CTA/card/calculator containment or horizontal overflow defects in the inspected 1440/390 captures.

A real home defect was repaired first: the approved ordered journey had lost its numbers and connection. RU/EN now restore the four numbered stages and the visible desktop curve using the existing styles; responsive CSS hides the curve on mobile while preserving the ordered stages. Final desktop/mobile images were reviewed again. Unsupported named AI-provider claims were replaced by implemented product context and review controls, retaining the card composition.

Only the ten corresponding platform-independent PNG baselines were migrated to those individually reviewed captures. Previous PNGs and review captures were preserved outside the repository. This is explicit acceptance of approved changes after correcting and visually reviewing the home defect; tests, tolerances and route coverage were not weakened. The migrated comparisons still require a fresh run and GitHub CI verification.

The first Linux CI run (`37640132771`, head `f273b9a9`) passed all desktop comparisons but found five stable mobile differences of about 2% against Windows captures. Snapshot identity now includes the actual platform, as recommended by [Playwright](https://playwright.dev/docs/test-snapshots); the reviewed Windows images are preserved under that identity. Missing baselines fail without automatic acceptance (`updateSnapshots: none`). CI runs visual comparisons before the other browser suites so failures are found earlier, and preserves failure images/reports for seven days using an immutable upload-artifact action revision. Linux captures must be retrieved and independently inspected before they become expected images. Tolerances and coverage remain unchanged.

The first strict missing-baseline diagnostic run (`37642919653`, head `998a4afb`) preserved viewport failure screenshots and approved-width attachments, but the snapshot matcher returns early for a missing expected file. Each desktop/mobile comparison now explicitly attaches its prepared full-page observed image before asserting. This provides inspectable evidence without accepting a missing reference or changing the comparison outcome.

## Git and documentation

Twenty stale remote branches were removed only after verifying that their commits were reachable through retained refs and no open PR used their head/base. A verified Git bundle and branch/SHA manifest were preserved before deletion. Active PR branches and five branches with unique work were retained. `main` remains the canonical branch and target for production source selection.

README was rewritten in Russian with actual marketplace capabilities, response modes, architecture, PowerShell setup, backend-only secret configuration, provider routes, full QA commands and deployment/health boundaries. It does not claim that all providers or automatic writes are certified.

## Validation

- New regressions were observed failing before implementation: category sharing, write gate, service-secret headers, cloud token types, Redis cleanup/no-send retry, access/load separation, provider-copy truth and connected home journey.
- Backend full suite: 677 passed, 46 skipped in the default local invocation; strict Pyright: 0 errors; Ruff and repository integrity passed.
- Web unit suite: 587 passed. Design tokens, TypeScript, ESLint, CSS syntax and production build passed before the final baseline migration.
- Final visual suite: 19 passed, including all ten migrated comparisons and responsive coverage at 430/755/768/1024/1086 px. Final browser scenarios: 120 passed; accessibility: 27 passed; W3C: 64 rendered routes passed; Lighthouse: all configured assertions passed for four local routes.
- GitHub CI and deployment are verified separately after delivery. Local checks do not certify external WB quota, provider publication or a real payment.
