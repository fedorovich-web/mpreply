# Avito Client Credentials Lifecycle Design

Date: 2026-08-13
Branch: `codex/0.1.104-backend`
Status: approved for autonomous implementation under the backend handoff

## Goal

Replace the expiring-token-only Avito integration path with a production-safe OAuth 2 client-credentials lifecycle while preserving existing access-token accounts during migration.

## Verified provider contract

The current official Avito auth specification at `https://www.avito.ru/web/1/openapi/info/auth` defines:

- token URL `https://api.avito.ru/token/`;
- `POST` with `application/x-www-form-urlencoded`;
- required fields `grant_type=client_credentials`, `client_id`, and `client_secret`;
- a successful JSON response containing `access_token`, `expires_in`, and `token_type`;
- `token_type=Bearer` and a documented token lifetime of 24 hours.

The Messenger OpenAPI supplied by the user confirms that chat operations accept OAuth 2 client credentials and use `Authorization: Bearer <ACCESS_TOKEN>`.

## Credential contract

The existing generic marketplace request schema remains unchanged. For Avito, a new client-credentials value is an exact JSON object:

```json
{"client_id":"<CLIENT_ID>","client_secret":"<CLIENT_SECRET>"}
```

Both values must be non-empty strings after trimming. Unknown keys, non-string values, malformed JSON, and missing fields fail before HTTP. Existing non-JSON access tokens remain supported and are reported internally as `access_token`; they are not rewritten or exposed.

The complete raw credential string continues to be encrypted and fingerprinted by the existing `CredentialService`. Client ID, Client Secret, and access tokens never enter public responses, audit metadata, safe errors, logs, cache keys, or evidence.

## Token boundary

A focused `AvitoCredentialResolver` owns parsing, token acquisition, response validation, caching, and invalidation. It returns a typed resolved bearer token plus the non-secret authentication method.

Client-credentials tokens are cached in process memory under a SHA-256 digest of the complete credential JSON. The cache expires 60 seconds before provider expiry. Non-positive, boolean, non-integral, or excessive `expires_in` values and non-Bearer token types are malformed responses. Cache entries are bounded and oldest-expiring entries are evicted.

Token endpoint timeout, transport failure, `429`, and `5xx` map to the existing safe retryable error vocabulary. Deterministic `400`, `401`, and `403` map to `invalid_credentials`. Provider bodies are never propagated.

## Adapter request policy

Every Avito Messenger call resolves a bearer token immediately before HTTP.

- A successful GET may invalidate the cached token and repeat once after an authentication response (`401` or `403`). GET is read-only, so this cannot duplicate a provider mutation.
- A POST invalidates the token on `401` or `403` but is never repeated. Reply execution and mark-read ambiguity rules remain unchanged.
- No timeout, network error, `429`, `5xx`, or malformed post-send response is retried inside the adapter.

Legacy access tokens cannot be refreshed. Their authentication failures retain the current safe error behavior.

## Account lifecycle

Credential validation returns the existing `fetch_chats` scope plus an `authentication` value of `client_credentials` or `access_token`. `MarketplaceAccountService` persists only that non-secret method in `scopes_json`. Create, rotate, revoke, scheduler pause/activation, tenant checks, encryption, and masking continue through existing shared services.

No database migration is required because the encrypted credential column already stores opaque strings and `scopes_json` already stores safe validation metadata.

## Testing and verification

Synthetic `httpx.MockTransport` tests cover exact form fields, strict response parsing, safe error mapping, cache reuse/expiry, one read-only auth refresh, zero POST retry, legacy compatibility, account metadata, and secret non-disclosure.

The implementation uses one RED run for the new contract, one grouped GREEN matrix, touched Ruff, strict Pyright, neighboring Avito regressions, and one final backend/tooling gate. No live Avito request or write is permitted.

## Excluded

- authorization-code user delegation and refresh-token persistence;
- webhook subscription or ingress;
- image, voice, attachment, location, or link sending;
- frontend credential form changes;
- migration, version bump, merge, deploy, or release publication.
