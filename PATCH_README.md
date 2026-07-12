# Respio patch 0.1.18

## Scope

Live Automation Rules vertical slice: tenant-scoped dashboard UI over the existing automation-rule backend, explicit role-aware interaction, regression tests, and release-gate enforcement for the critical browser flow.

## Why this patch is next

The backend already had automation-rule CRUD/evaluation and SafetyGate-aware execution, while the dashboard workspace still rendered static demonstration cards. This patch closes that product gap without creating a second service, adapter, backend or parallel architecture.

## Changed

- Replaced the static Automation Rules workspace with live API-backed loading, filtering, selection, creation, editing, enable and disable flows.
- Preserved existing backend authorization and exposed the current organization membership role in organization responses so the UI can present owner/admin write controls and manager/viewer read-only behavior without guessing.
- Added explicit loading, empty, error, success, disabled and read-only states.
- Kept SafetyGate stop/review controls visible in the editor and retained backend enforcement as the security boundary.
- Added backend schema tests for current organization role serialization and validation.
- Added frontend unit tests for organization-role and automation-rule contracts plus owner/viewer workspace behavior.
- Added Playwright E2E coverage for live Automation Rules and axe accessibility coverage for the same critical flow.
- Included the new Automation Rules E2E/a11y specs in existing package scripts used by GitHub Actions.
- Extended the local release gate and repository integrity contract so the new critical browser flow cannot silently disappear.
- Synchronized project version to `0.1.18` across the real version sources, including `DESIGN.md`.

## Not changed

- No new database model or Alembic migration was required.
- No second automation engine, backend service or marketplace adapter was created.
- Existing automation-rule evaluation, SafetyGate, worker, retry and marketplace behavior were not replaced.
- Marketplace readiness truth is unchanged: Wildberries remains the current MVP execution path; Ozon, Yandex Market and Avito remain planned until verified and implemented.

## Validation

See `docs/qa/patch-0.1.18-release-report.md` for exact commands, passed checks and environment-blocked checks. Browser E2E/accessibility are included in the patch and GitHub Actions contract, but local pass status is reported only when a browser run actually completes.
