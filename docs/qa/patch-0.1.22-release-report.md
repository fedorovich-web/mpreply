# Respio 0.1.22 release verification

## Scope

CI recovery hotfix. Restores the missing Vitest configuration, Vitest setup, and the two baseline frontend unit-test files that GitHub Actions reported as absent.

## Root cause

The GitHub branch did not contain four files introduced in patch `0.1.17`. Later patches were packaged incrementally from an internal baseline that already contained those files, so they did not re-include them. As a result:

- integrity gate failed because required files were missing;
- Vitest fell back to the Node environment;
- React Testing Library tests failed with `ReferenceError: document is not defined`.

This was a patch-packaging/process error. Patch `0.1.22` is cumulative for these missing baseline files and no longer assumes that `0.1.17` was applied correctly.

## Files restored

- `apps/web/vitest.config.ts`
- `apps/web/vitest.setup.ts`
- `apps/web/tests/unit/api-client.test.ts`
- `apps/web/tests/unit/theme-toggle.test.tsx`

## Actual verification results

- Integrity gate: PASSED.
- `npm ci`: PASSED.
- `npm audit --audit-level=high`: PASSED, 0 vulnerabilities.
- Frontend unit tests: PASSED, 19/19 tests across 8 files.
- Design-system tests: PASSED, 15/15 tests.
- TypeScript typecheck: PASSED.
- ESLint: PASSED.
- Next.js production build: PASSED, 31/31 static pages generated.

## Not repeated

Backend business logic, marketplace adapters, database models, Alembic migrations, public-site HTML/CSS and browser E2E logic were not changed by this hotfix. Their unrelated gates were not repeated solely for a test-infrastructure repair.
