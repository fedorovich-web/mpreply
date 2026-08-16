# Avito Client Integration Design

Date: 2026-08-16
Branch: `codex/0.1.104-backend`
Status: approved for implementation

## Goal

Expose the implemented Avito Messenger adapter as a secure, observable and role-aware customer integration workspace. The client flow uses Avito `Client ID` and `Client Secret`; existing access-token accounts remain readable for backend migration compatibility but the UI does not offer access tokens as a new credential type.

## Product truth and scope

The backend already supports Avito account validation, client-credentials token acquisition, chat synchronization and guarded text-message sending through synthetic contract coverage. Live Avito OAuth and Messenger behavior remain unverified. This frontend increment must not claim production readiness or call Avito directly.

Included:

- make Avito available in the authenticated integration catalog;
- add `/app/integrations/avito`;
- create accounts with display name, Avito user ID, Client ID, Client Secret and response mode;
- expose safe account health, chat capability, authentication method, scheduler state, sync jobs and integration events;
- support validation, manual chat sync, Avito user ID replacement, client-credential rotation and credential revocation for owner/admin roles;
- keep manager/viewer roles read-only;
- add unit, Chromium E2E, accessibility and visual contracts with local fixtures only.

Excluded:

- live provider calls or credentials;
- access-token entry for new or rotated accounts;
- authorization-code OAuth, refresh-token persistence or user delegation;
- webhooks;
- media, voice, attachments, location or link sending;
- chat content inside the integration screen;
- backend, migration, dependency, version, deploy, merge or release changes unless a verified frontend contract gap makes a backend correction unavoidable.

## Architecture

Create a dedicated `AvitoIntegrationWorkspace`. Do not extend `ReviewQuestionIntegrationWorkspace`, because Avito operates on conversations rather than review/question streams. Do not refactor Wildberries, Ozon or Yandex Market.

The new workspace reuses the existing marketplace-account API schemas, overview endpoint, TanStack Query invalidation contract, dashboard CSS classes and design tokens. Small shared helpers may be extracted only when this removes exact duplication without changing established provider behavior.

## Creation contract

The form contains:

- connection display name;
- positive decimal Avito user ID;
- Client ID;
- Client Secret;
- default response mode.

The frontend trims all identifiers and constructs the existing opaque credential field as an exact JSON object:

```json
{"client_id":"<CLIENT_ID>","client_secret":"<CLIENT_SECRET>"}
```

The marketplace-account request is:

```json
{
  "organization_id": "<ORGANIZATION_ID>",
  "marketplace": "avito",
  "display_name": "<DISPLAY_NAME>",
  "seller_id": "<AVITO_USER_ID>",
  "credentials": "{\"client_id\":\"<CLIENT_ID>\",\"client_secret\":\"<CLIENT_SECRET>\"}",
  "default_response_mode": "inherit"
}
```

The raw Client ID and Client Secret exist only in controlled form state until submission and are cleared after a successful mutation. They are never read back. The backend intentionally omits the Avito user ID from browser responses, so later replacement is a separate explicit operation.

## Account lifecycle and observability

The list/detail workspace follows the established authenticated integration hierarchy. It shows:

- connection status and safe credential mask;
- validated `fetch_chats` capability as customer-facing chat access;
- safe authentication metadata: `client_credentials` as `Client ID и Client Secret`, or `access_token` as `Старое подключение по access token`;
- chat scheduler state;
- recent safe sync jobs and integration events;
- health reasons and recoverable errors.

Owner/admin controls:

- update display name and response mode;
- replace the hidden Avito user ID;
- validate credentials;
- request manual chat synchronization;
- rotate credentials using only a new Client ID and Client Secret encoded into the opaque JSON credential;
- revoke credentials through the existing guarded confirmation flow.

Manager/viewer roles receive account state and overview data but no credential forms or mutation controls. Backend RBAC remains authoritative.

Successful mutations return the Promise from relevant `invalidateQueries` calls so pending state lasts until account and overview data have refreshed.

## Validation and error handling

Client-side validation requires:

- display name of at least two characters after trimming;
- ASCII positive decimal Avito user ID;
- non-empty trimmed Client ID and Client Secret.

Known backend error codes map to concise Russian customer copy. Required categories include invalid account identifier, invalid credentials, insufficient scope, payment required, rate limiting, temporary provider unavailability, network timeout/error, malformed provider response, pagination safety limits and a neutral fallback.

No provider response body, raw Client ID, Client Secret, access token, full Avito user ID, cursor or customer message content may render in the DOM, history, console-oriented errors or snapshots. Safe request IDs may remain available for support when supplied by the existing API client.

## Visual and interaction contract

Use existing dashboard tokens and integration workspace classes. No dependency or design-token additions are planned. The screen remains operations-first: status and required action precede configuration and history. Narrow layouts collapse to one column, mutation buttons become usable touch targets and horizontal overflow is prohibited.

The implementation must cover loading, empty, selected, error, success, pending, read-only and revoked states. Destructive revocation remains explicit. No decorative marketplace landing treatment, generic AI gradient, nested card proliferation or emoji is introduced.

## Testing and delivery

Implementation follows grouped TDD:

1. Unit RED/GREEN for catalog availability, route, required fields, exact create payload, secret clearing and manager/viewer read-only behavior.
2. Unit RED/GREEN for authentication labels, chat capability, safe history/errors, Avito user ID replacement, and credential rotation payload without `seller_id`.
3. Schema-valid Avito browser fixtures that reject undeclared routes and never contact a marketplace provider.
4. Chromium E2E for creation/overview behavior and desktop/mobile overflow.
5. Axe route coverage and one new desktop visual baseline, followed by manual PNG inspection.
6. One final affected-frontend gate from `apps/web`: `npm run qa:web`, `npm run test:e2e`, `npm run test:a11y`, `npm run test:visual`, and `npm run lighthouse`.
7. `git diff --check`, exact diff inspection and secret/internal-comment scan before delivery.

Backend full tests are not repeated if backend code does not change. The existing branch and draft PR are updated without merge, deploy, tag or version bump. Live Avito runtime remains explicitly unverified.
