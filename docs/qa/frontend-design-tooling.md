# Frontend design QA tooling

## Exact direct versions

- Playwright Test `1.61.1` — E2E/responsive/visual testing.
- `@axe-core/playwright` `4.12.1` — accessibility scan.
- Lighthouse CI `0.15.1` — performance/accessibility/best-practices/SEO budgets.

Official direct package tarballs are vendored in `vendor/npm/` for traceability/offline inspection. `package.json` keeps exact registry versions so the web Docker build context remains valid.

## Windows bootstrap

Run from project root: `./scripts/bootstrap-design-tooling.ps1`. It runs `npm ci`, audit, version checks and Chromium download. Options: `-AllBrowsers`, `-SkipBrowser`. Browser binaries are platform-specific and intentionally not stored in the release ZIP.

## Commands

`test:e2e`, `test:e2e:all`, `test:a11y`, `test:visual`, `test:visual:update`, `test:report`, `lighthouse`, `qa:web`.

## Gates

Normal release gate includes install, audit, typecheck, lint and build. Dedicated `scripts/web-design-gate.ps1` additionally installs Chromium, runs public E2E, axe and Lighthouse. Visual regression is an explicit Chromium gate; baselines are updated only after reviewing the rendered pages and the source changes that caused a difference.

The ten public-page desktop/mobile baselines were reviewed and refreshed on 2026-09-24 after the intentional public UI cleanup following their initial capture in `3c1534e`. The ordinary visual run passed against the refreshed baselines. This does not certify rendering on other browsers or operating systems.

As of 2026-09-24, `npm audit --omit=dev --audit-level=high` reports zero production findings, but the full audit fails on six high-severity findings in the Lighthouse CI development dependency chain (`@lhci/cli` → `lighthouse` → `puppeteer-core` → `@puppeteer/browsers` → `extract-zip`). The audit's suggested fix downgrades `@lhci/cli` from `0.15.1` to `0.12.0`; it has not been applied without compatibility verification. The full-audit gate remains red.

## Context contract

Agents must read `PRODUCT.md`, `DESIGN.md`, `AGENTS.md` and relevant product/SEO/design specs. Automated checks do not replace design review, manual accessibility review or product truth.

## Lighthouse foundation thresholds

Performance warning below 0.75; accessibility error below 0.90; best-practices error below 0.90; SEO error below 0.90. Raise targets after final redesign and representative measurement.

## Composio decision

Intentionally omitted. It does not solve the current brand/design/SEO/browser-QA problem and should not sit between Respio and core marketplace adapters without a separate architecture decision.
