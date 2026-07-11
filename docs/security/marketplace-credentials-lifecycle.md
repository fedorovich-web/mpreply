# Marketplace credentials lifecycle

## Principle
Marketplace credentials are customer secrets. Respio stores them encrypted-at-rest and uses them only inside backend services and workers.

## Lifecycle

```text
created
→ pending_validation
→ valid
→ used_for_sync
→ used_for_send
→ rotated
→ revoked
```

## Storage

- `credentials_encrypted`: encrypted secret value.
- `credentials_fingerprint`: non-secret fingerprint for masked display.
- `credentials_status`: validation/lifecycle state.

## UI display

The frontend may show only masked values, for example:

```text
••••••••A12F
```

## Prohibited

- Returning raw credentials from API.
- Logging raw credentials.
- Sending marketplace credentials to OpenRouter.
- Storing credentials in browser storage.
- Reusing one customer API key for another organization.

## Audit actions

- `marketplace_account.credentials.created`
- `marketplace_account.credentials.used_for_validation`
- `marketplace_account.credentials.validated`
- `marketplace_account.credentials.validation_failed`
- `marketplace_account.credentials.rotated`
- `marketplace_account.credentials.revoked`
