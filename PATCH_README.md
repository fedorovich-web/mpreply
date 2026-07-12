# Respio patch 0.1.23

CI hotfix for the three failing Chromium E2E scenarios reported by GitHub Actions on `0.1.22`.

## Fixed

- Replaced the ambiguous `getByText("Balanced auto")` Automation Rules assertions with a semantic heading locator, removing Playwright strict-mode collisions between the rule-list button and the detail heading.
- Narrowed the AI draft-history route mock so it no longer intercepts `/api/ai/drafts/generate` and returns a history payload to the generation request.
- Added a regression unit test for the AI mock route contract.
- Synchronized the project version to `0.1.23` across real version sources.

## Scope

No product functionality, backend business logic, database schema, marketplace adapter, SafetyGate logic, or public-site visual system is changed in this patch.
