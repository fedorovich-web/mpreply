# Respio 0.1.21 verification report

Version: `0.1.21`

## Scope

Live Integrations over the existing marketplace-account and Wildberries sync APIs. No new marketplace adapter, database model, Alembic migration, worker architecture or duplicate backend service was created.

## Frontend checks completed on the final functional 0.1.21 code

- `npm ci`: PASSED; 762 packages audited, 0 vulnerabilities.
- `npm run test:unit`: PASSED; 8 files, 19 tests.
- `npm run test:design-tokens`: PASSED; 1 file, 15 tests.
- `npm run typecheck`: PASSED.
- `npm run lint`: PASSED; no errors or warnings.
- `npm run design:detect`: PASSED.
- `npm run validate:css-syntax`: PASSED.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: PASSED; compilation, TypeScript and 31/31 static pages completed, including `/app/integrations` and `/app/integrations/wildberries`.
- `npm run validate:w3c:css`: PASSED; 5 stylesheet sources, no errors.
- `npm run validate:w3c:html`: PASSED; 16 rendered routes, including both live integration routes, no errors.

After the unit/design/type/lint checks, only version metadata, release documentation and integrity-contract bookkeeping changed; the tested frontend functional code and test code did not change.

## Tests added

- Marketplace-account Zod contract coverage, including the invariant that account responses expose masked credentials rather than raw/encrypted secrets.
- Integrations overview unit coverage for live account counts and explicit unavailable states for unsupported adapters.
- Wildberries workspace unit coverage for tenant-scoped account creation and viewer read-only behavior.
- Playwright E2E coverage for owner validation/sync and viewer read-only behavior.
- axe accessibility coverage for the live Wildberries workspace.
- Design-system regression coverage for semantic tokens, focus, stable motion and responsive integration layouts.

## Backend and external-runtime status

- Backend marketplace-account business logic, Wildberries adapter, database schema, Alembic chain and worker execution were not changed in this patch.
- The previously verified backend baseline remains 66/66 pytest tests with Ruff/Pyright/compileall/one Alembic head GREEN. Those unchanged backend business tests were not repeated solely because version metadata changed.
- Playwright E2E/axe were NOT RUN locally because the execution environment had already been confirmed to block Chromium with `ERR_BLOCKED_BY_ADMINISTRATOR`, while Playwright browser download was blocked by DNS `EAI_AGAIN`. The new specs are included in the existing GitHub Actions commands.
- Docker Compose/runtime was NOT RUN because Docker is unavailable in the execution environment.
- GitHub Actions was NOT RUN because the user performs the push from the local repository.

## Integrity

- `python scripts/check_integrity.py`: PASSED after generated artifacts were removed.
- Patch ZIP content verification: PASSED; only changed/new files are included and generated artifacts/secrets are excluded.
