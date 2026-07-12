# Respio patch 0.1.21

## Scope

Live Integrations: replace the static marketplace card grid and non-functional Wildberries form with a real tenant-scoped product flow over the existing marketplace-account and sync APIs.

## Why this patch is next

The backend already supports marketplace account creation, encrypted credentials, masked fingerprints, validation, metadata updates, credential rotation/revocation and manual Wildberries sync. The dashboard still exposed static Sprint-era copy and a form that did not call the API.

## Changed

- Replaced the static Integrations screen with a live overview of real marketplace accounts for the active organization.
- Added explicit active/problem connection counts and preserved truthful unavailable states for Ozon, Yandex Market and Avito.
- Replaced the non-functional Wildberries form with live create/list/select/update/validate/sync/rotate/revoke flows over existing backend endpoints.
- Removed the manual Organization ID field; tenant scope now comes from the active workspace context.
- Owner/admin roles can manage accounts; manager/viewer roles remain read-only.
- Raw credentials are never returned by the frontend contract; only `credentials_masked` is accepted from account responses.
- Added Zod contracts, frontend unit coverage, Playwright E2E and axe accessibility specs.
- Added W3C/Nu rendered-route validation for `/app/integrations` and `/app/integrations/wildberries`.
- Kept new dashboard styling on the existing centralized design-token system.
- Synchronized project version to `0.1.21` across real version sources.

## Not changed

- No new marketplace adapter, service, database model, Alembic migration or worker architecture was created.
- Ozon, Yandex Market and Avito are still not production-ready adapters.
- Wildberries remains the only enabled marketplace adapter in the current backend.

## Validation

See `docs/qa/patch-0.1.21-release-report.md` for exact completed checks and environment-blocked categories.
