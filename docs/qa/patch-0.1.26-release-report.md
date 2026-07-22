# MPReply 0.1.26 — project-wide accessibility contrast hardening

## Scope

Focused recovery patch after the final `0.1.25` GitHub accessibility failure. No marketplace adapter, AI, billing, worker, database or backend business-logic changes.

## GitHub evidence analysed

The `0.1.25` Chromium accessibility run passed 15 of 16 tests and failed only on:

- route: `/app/integrations/wildberries`;
- selector: `.integration-account-button > .ui-badge-success.ui-badge`;
- computed foreground: `#027A48`;
- computed background: `#DFE6EA`;
- measured contrast: `4.28:1`;
- required contrast: `4.5:1`.

## Root cause

The success badge used `--color-success-soft: rgb(3 152 85 / 8%)`. The selected integration-account button used a translucent violet active surface. CSS compositing therefore produced `#DFE6EA` for the badge background instead of a stable success surface. The same badge could pass or fail depending on which parent it was nested inside.

This was a design-token architecture defect, not an isolated badge defect.

## Full frontend contrast audit

The audit inspected:

- every success/warning/danger/info soft-background use in `apps/web/styles`;
- all brand-soft and active-navigation text-bearing surfaces;
- public SafetyGate chips and marketplace readiness/status blocks;
- Automation Rules decision/error states;
- AI Assistant badges;
- Integrations overview and Wildberries selected-account states;
- light-theme token pairs;
- dark-theme token overrides;
- nested/selected surface compositing;
- direct accent-token misuse as text;
- representative browser-level axe flows in both themes.

### Findings

1. `--color-success-soft` and `--color-warning-soft` were translucent, so text contrast depended on the parent surface.
2. `--color-brand-soft` and `--app-nav-active-bg` were also translucent while carrying text in navigation, filters, process markers and public status elements.
3. The dark theme did not override `--color-kicker-text`, causing multiple 12px captions/kickers to fail contrast.
4. Dark-mode brand-primary text on active violet soft surfaces failed in navigation and process/status elements.
5. The dark primary-button text override leaked into `.button-danger`, producing an invalid danger-button text pair.
6. The previous special `.readiness-summary-primary .public-status-mvp` text override became invalid once the success background was made opaque.
7. Automation Rules error copy used `--color-danger` as text instead of the dedicated higher-contrast `--color-danger-text`.
8. Existing light-theme CI did not exercise dark-theme surfaces, allowing these latent failures to remain undetected.

## Fixes

### Stable light-theme semantic surfaces

- success soft: `#ECFDF3`;
- warning soft: `#FFFAEB`;
- danger soft: `#FEF3F2`;
- info soft: `#EFF8FF`;
- warning text: `#93370D`.

### Stable dark-theme semantic surfaces

- success: `#75E0A7` on `#053321`;
- warning: `#FEC84B` on `#3F2A0A`;
- danger: `#FDA29B` on `#55160C`;
- info: `#84ADFF` on `#102A56`.

### Brand and small-text contracts

- light brand-soft surface: `#F2EDF7`;
- dark brand-soft surface: `#342340`;
- dark brand text on soft surface: `#C49BE5`;
- dark kicker text: `#AB9FB1`;
- dark primary violet: `#AD72DC`;
- dark on-brand text: `#211A26`;
- danger-button text uses separate `--color-text-on-danger: #FFFFFF`.

## Regression protection

`tests/design/design-tokens.test.ts` now verifies:

- light-theme core text/surface pairs;
- dark-theme core text/surface pairs;
- all success/warning/danger/info text-on-soft pairs in both themes;
- inherited secondary/muted text on all semantic and brand-soft surfaces;
- brand text on elevated and brand-soft surfaces;
- kicker text in both themes;
- primary-button and danger-button text contracts;
- opaque text-bearing soft surfaces;
- `--app-nav-active-bg` reuses the opaque brand-soft token;
- no soft-brand text-bearing rule uses `--color-brand-primary` directly;
- public success badges do not receive an invalid dark-panel text override;
- Automation error copy uses `--color-danger-text`.

A permanent `e2e/dark-theme-accessibility.spec.ts` covers six representative dark-theme surfaces:

- homepage;
- marketplaces overview;
- demo;
- AI Assistant;
- Automation Rules;
- Wildberries Integrations.

## Verification

Final `0.1.26` tree results:

- `npm ci`: PASSED — 761 packages added, 762 audited, 0 vulnerabilities.
- frontend unit tests: PASSED — 9 files, 21/21 tests.
- design-token/contrast tests: PASSED — 1 file, 60/60 tests.
- TypeScript typecheck: PASSED.
- ESLint: PASSED.
- CSS syntax validation: PASSED.
- Impeccable design detection: PASSED.
- Next.js production build: PASSED — 31/31 static pages generated.
- W3C/Nu CSS: PASSED — 5 stylesheet sources.
- W3C/Nu HTML: PASSED — 16 rendered routes.
- light public accessibility: PASSED — 13/13 public-route axe tests.
- light authenticated accessibility: PASSED — AI Assistant, Automation Rules and Wildberries Integrations, 3/3.
- dark representative accessibility: PASSED — 6/6.
- total accessibility coverage executed on the final tree: PASSED — 22/22 tests.
- Python compileall: PASSED.
- integrity gate: PASSED after generated-artifact cleanup.

The 22 accessibility tests were executed in deterministic chunks because this sandbox intermittently stalls the Next.js dev server during long one-shot Playwright sessions. The exact same test files are wired into `npm run test:a11y` for GitHub Actions.

Backend pytest was not completed in this sandbox because the available Python environment is missing runtime dependencies (`pwdlib`, `asyncpg`, `redis`). No backend business logic changed in 0.1.26; only synchronized version sources changed there.

GitHub Actions is not considered GREEN until the user pushes the patch and the remote Quality Gate finishes successfully.
