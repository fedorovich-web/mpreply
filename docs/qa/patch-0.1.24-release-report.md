# MPReply 0.1.24 release verification

## Scope

Targeted CI recovery for the remaining Automation Rules Chromium E2E failure reported by GitHub Actions.

## Root cause

The E2E mock returned the created rule for POST but then returned only the original base rule on the collection refetch triggered by React Query invalidation. The UI therefore could not render the newly created rule heading expected by the browser test.

## Fix

The mock now keeps in-memory rule state for the lifetime of the test page. POST appends the created rule; subsequent GET returns the updated collection. A unit regression test covers this exact create-then-refetch invariant.

## Verification performed

- `npm ci`: PASSED, 0 vulnerabilities.
- Frontend unit tests: PASSED, 21/21.
- TypeScript typecheck: PASSED.
- ESLint: PASSED.
- Integrity gate: PASSED after generated dependency artifacts were removed.

## Browser E2E status

The exact GitHub Chromium scenario cannot be executed in the current sandbox because local browser navigation is blocked by environment policy. GitHub Actions E2E remains NOT VERIFIED until the user pushes this patch and the Quality Gate completes.
