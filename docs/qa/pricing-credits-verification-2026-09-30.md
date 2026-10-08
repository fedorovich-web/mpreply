# Pricing and reply credits — 30 September 2026

Current dirty checkout: `feat/auth-email-resend`, HEAD `42e5810`. Existing work remains preserved; no commit, deployment or provider activation was performed.

## Changes

- Added fourth Corporate plan with an individual quote and the existing site contact form. Business remains a regular plan at 6,990 ₽, with the same registration action as Start and Team.
- Pricing FAQ now has its shared section heading above a single column. Every question spans the container; opening one answer only moves later rows down. The obsolete narrow heading and two-column layout were removed in RU and EN.
- Added durable reply accounting, trial activation, paid entitlement gating, safe idempotent AI generation and bounded expiry/recovery maintenance. See the backend readiness report and reply credit implementation plan for detail and remaining gaps.
- Added durable preparation after imports and routing through existing automation/safety into the send or human review queue. Human drafts take priority, crash recovery reuses the original generated draft, and failed generation releases credits. See `automatic-drafts-verification-2026-09-30.md`.
- Updated 43 public unit-contract files against the current approved layout, prices, assets, shared chrome and actual read-only demo. Tests retain behavioral, localization, asset-decoding and accessibility invariants; production UI/copy/assets and visual baselines were not changed by this contract repair.
- Full-page visual captures now scroll to visible images and verify lazy-loaded artwork before comparing screenshots. The visual-server configuration also uses the port from `PLAYWRIGHT_BASE_URL`.

## Current verification

| Check | Result |
| --- | --- |
| API pytest | 475 passed; 15 isolated PostgreSQL cases skipped in this default invocation |
| PostgreSQL credit / automatic-draft suite | 15 passed separately; migration 0018 up/down/up passed on an isolated test database |
| API Ruff / Pyright | Passed / 0 errors, 0 warnings |
| Web unit | 545 passed in 120 files; no failed or skipped tests |
| Design tokens | 59 passed |
| Web TypeScript / ESLint / CSS syntax | Passed |
| Production build | Passed |
| W3C CSS / rendered HTML | 49 sources / 62 routes passed |
| Browser scenarios | 72 passed |
| Real PostgreSQL demo API in browser | 3 passed again after the final API restart; RU/EN entry, read-only mutations and responsive cabinet |
| Accessibility | 22 passed |
| Visual baselines | 9 passed, 10 failed; no baseline regeneration |
| Lighthouse | All configured assertions passed; performance, accessibility, best practices and SEO each scored 100 on the four tested local routes |

The pricing FAQ geometry was checked on both language routes at 320, 390, 768 and 1440 px. All rows matched container width; the next closed row retained its height after opening the first answer, and there was no horizontal overflow. Desktop and mobile screenshots were also inspected. Native `details` interactions performed before React initialization can produce a development hydration attribute warning; the geometry check waits for the page to settle before interacting.

The complete unit suite now passes. Earlier public failures came from retired shell/stylesheet imports, prior prices/assets, removed duplicate sections and the replaced fictional demo journey. The repaired contracts verify current rendered behavior and approved constants instead of restoring retired product sections.

The visual comparison still fails for desktop/mobile snapshots of home, features, marketplaces, Wildberries and pricing: **10 failures remain**, including after the lazy-image capture fix. Current screenshots were inspected against `02-approved-page-renders.zip` and the later owner-approved changes. Four marketplace marks, shared header/footer, removed eyebrow/duplicate sections, current models, four tariff cards, calculators and current prices differ from older source/baseline compositions. No clipped text or overlapping content was observed in the inspected captures; that review does not turn the automated visual failures into passes. Baselines were not regenerated.

The source audit also found EN pricing behind RU in history/automation/analytics/support tiers and an obsolete demo-flow description in the EN FAQ. These translation differences remain recorded rather than changing approved copy during the backend/contract work.

## Runtime limits

- Native local API applies migration `20260930_0018`; live/demo/organizations/billing HTTP responses are 200, including the actual new reply-balance schema. The task-owned API was restarted after the final backend changes.
- Database readiness is OK; `/health/ready` still returns 503 because Redis is unavailable. Worker and continuous scheduler execution remain unverified.
- The demo remains read-only and receives no fabricated trial or paid credits.
- OpenRouter, real paid credit events, email delivery, marketplace writes and Dokploy/domain certification remain separate domain-stage work. Automatic preparation after imports is now implemented and locally verified; Redis/continuous worker operation remains unverified. Other advertised implementation boundaries are recorded in `backend-readiness-status-2026-09-30.md`.

Passing the pricing layout checks is not a production-readiness certificate for the whole project.
