# Frontend design QA tooling

## Exact direct versions

- Impeccable CLI `3.2.1` — deterministic design anti-pattern scan.
- Playwright Test `1.61.1` — E2E/responsive/visual testing.
- `@axe-core/playwright` `4.12.1` — accessibility scan.
- Lighthouse CI `0.15.1` — performance/accessibility/best-practices/SEO budgets.

Official direct package tarballs are vendored in `vendor/npm/` for traceability/offline inspection. `package.json` keeps exact registry versions so the web Docker build context remains valid.

## Windows bootstrap

Run from project root: `./scripts/bootstrap-design-tooling.ps1`. It runs `npm ci`, audit, version checks, Impeccable scan, provider-skill installation and Chromium download. Options: `-AllBrowsers`, `-SkipBrowser`, `-SkipImpeccableSkills`. Browser binaries are platform-specific and intentionally not stored in the release ZIP.

## Commands

`design:detect`, `design:detect:json`, `impeccable:install`, `test:e2e`, `test:e2e:all`, `test:a11y`, `test:visual`, `test:visual:update`, `test:report`, `lighthouse`, `qa:web`.

## Gates

Normal release gate includes install, audit, typecheck, lint, Impeccable and build. Dedicated `scripts/web-design-gate.ps1` additionally installs Chromium, runs public E2E, axe and Lighthouse. Visual regression stays opt-in until intentional baselines exist.

## Context contract

Agents must read `PRODUCT.md`, `DESIGN.md`, `AGENTS.md` and relevant product/SEO/design specs. Impeccable is not a replacement for market research, design review, manual accessibility review or product truth.

## Lighthouse foundation thresholds

Performance warning below 0.75; accessibility error below 0.90; best-practices error below 0.90; SEO error below 0.90. Raise targets after final redesign and representative measurement.

## Composio decision

Intentionally omitted. It does not solve the current brand/design/SEO/browser-QA problem and should not sit between Respio and core marketplace adapters without a separate architecture decision.
