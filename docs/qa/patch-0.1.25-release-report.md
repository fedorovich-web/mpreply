# Respio 0.1.25 — accessibility CI recovery report

## Scope

Focused fix for the remaining GitHub Actions `test:a11y` contrast blockers reported on 0.1.24. No backend business logic, marketplace adapter logic, database schema, or product scope was changed.

## Known GitHub blockers addressed

1. `.safety-decision-block`: danger text contrast was 4.01:1, below WCAG AA 4.5:1.
2. `.automation-decision-block`: danger text contrast was previously reported at 4.15:1.
3. `.ui-badge-info`: info text contrast was previously reported at 3.58:1.
4. Wildberries integrations workspace: the selected account secondary metadata used the muted text token on a violet-soft active surface with insufficient/near-threshold effective contrast in axe.

## Changes

- Added `--color-danger-text` and `--color-info-text`.
- Made danger/info soft surfaces stable opaque semantic tokens.
- Applied accessible semantic text tokens to danger decisions, danger badges, info badges and form errors.
- Applied `--color-text-secondary` to selected Wildberries account secondary metadata.
- Added design-token contrast regressions for danger/info semantic pairs.
- Improved integrations accessibility failure diagnostics.

## Checks actually passed locally

- `npm ci`: passed; 0 vulnerabilities reported.
- Frontend unit tests: 21/21 passed.
- Design-system tests: 17/17 passed.
- TypeScript typecheck: passed.
- ESLint: passed.
- CSS syntax validation: passed.
- W3C/Nu CSS validation: passed for all 5 stylesheet sources with no errors.
- Next.js production build: passed; 31/31 static pages generated.

## Contrast margins after the fix

- Danger text `#b42318` on danger-soft `#fef3f2`: 6.05:1.
- Info text `#175cd3` on info-soft `#eff8ff`: 5.57:1.
- Selected integration secondary text `#4f4755` on violet-soft `#f2edf7`: 7.71:1.

These values exceed the WCAG AA 4.5:1 requirement for normal text with deliberate margin rather than threshold-level tuning.

## Browser accessibility status

BLOCKED locally: system Chromium is governed by an environment policy with `URLBlocklist: ["*"]`, causing `net::ERR_BLOCKED_BY_ADMINISTRATOR` even for localhost. The GitHub Actions `test:a11y` result is therefore the source of truth after user push.

This patch must not be called complete or GREEN until GitHub Actions confirms the Quality Gate.
