# Frontend design QA tooling

## Exact direct versions

- Impeccable CLI `3.2.1` — optional ad-hoc design review; it is not installed as project-local provider skills and is not part of the automated gate.
- Playwright Test `1.61.1` — E2E, responsive and visual testing.
- `@axe-core/playwright` `4.12.1` — accessibility scanning.
- Lighthouse CI `0.15.1` — performance, accessibility, best-practices and SEO budgets.

Official direct package tarballs are vendored in `vendor/npm/` for traceability/offline inspection. `package.json` keeps exact registry versions so the web Docker build context remains valid.

## Windows bootstrap

Run from project root: `./scripts/bootstrap-design-tooling.ps1`. It runs `npm ci`, the frontend dependency audit, CLI version checks and Playwright browser installation. Options: `-AllBrowsers` and `-SkipBrowser`. Browser binaries are platform-specific and intentionally not stored in the release ZIP.

## Commands

Core static checks: `test:unit`, `test:design-tokens`, `typecheck`, `lint`, `validate:css-syntax`, `build`, `validate:w3c`.

Browser and quality checks: `test:e2e`, `test:e2e:all`, `test:a11y`, `test:visual`, `test:visual:update`, `test:report`, `lighthouse`, `qa:web`.

## Gates

`scripts/release-gate.ps1` runs frontend install/audit, unit tests, design-token tests, typecheck, lint, CSS syntax validation, production build, W3C validation, critical E2E, accessibility, visual regression and Lighthouse as part of the full repository release gate.

`scripts/web-design-gate.ps1` is the frontend-only equivalent and can install Chromium or all Playwright browsers before the browser checks. Visual regression is part of both explicit gates; baseline updates remain intentional via `test:visual:update`.

## Context contract

Agents must read `PRODUCT.md`, `DESIGN.md`, `AGENTS.md` and relevant product/SEO/design specs. Automated tooling is not a replacement for market research, design review, manual accessibility review or product truth.

## Lighthouse foundation thresholds

Performance warning below 0.75; accessibility error below 0.90; best-practices error below 0.90; SEO error below 0.90. Raise targets after final redesign and representative measurement.

## Composio decision

Intentionally omitted. It does not solve the current brand/design/SEO/browser-QA problem and should not sit between MPReply and core marketplace adapters without a separate architecture decision.
