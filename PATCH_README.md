# Respio patch 0.1.22

CI recovery hotfix for the frontend unit-test foundation.

## Fixed

- Restored `apps/web/vitest.config.ts` as a required tracked file.
- Restored `apps/web/vitest.setup.ts` as a required tracked file.
- Restored baseline unit tests:
  - `apps/web/tests/unit/api-client.test.ts`
  - `apps/web/tests/unit/theme-toggle.test.tsx`
- Restored the `jsdom` test environment so React Testing Library tests have `window` and `document` in GitHub Actions.
- Synchronized project version to `0.1.22` across real version sources.

## Why this hotfix exists

The repository branch used by GitHub Actions was missing four files that had been introduced in patch `0.1.17`. Later incremental patches assumed those files were already present, so CI executed Vitest with its default Node environment and failed all React component tests with `ReferenceError: document is not defined`.

This patch is intentionally cumulative for those missing baseline files and does not rely on the user having applied `0.1.17` correctly.
