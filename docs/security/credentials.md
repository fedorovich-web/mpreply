# Credentials security policy

## Scope

This policy applies to marketplace API keys, Groq API key, authentication secrets, encryption keys and any future provider tokens.

## Hard rules

- Marketplace API keys are never stored as plaintext.
- Marketplace API keys are never sent back to the frontend after creation.
- Marketplace API keys are never logged.
- Marketplace API keys are never sent to Groq.
- Groq API key is backend-only.
- Database URL, auth secret and credentials encryption key are backend-only.

## Storage

Marketplace credentials must be persisted only in `marketplace_accounts.credentials_encrypted`.
A non-secret fingerprint may be stored in `credentials_fingerprint` for display and audit.

## UI display

Display only masked values, for example: `••••••••A12F`.

## Audit events

Required actions:

- `marketplace_account.credentials.created`
- `marketplace_account.credentials.validated`
- `marketplace_account.credentials.validation_failed`
- `marketplace_account.credentials.rotated`
- `marketplace_account.credentials.revoked`
- `marketplace_account.credentials.used_for_sync`
- `marketplace_account.credentials.used_for_send`

## Logging

Structured logs must scrub:

- marketplace API keys;
- Groq API key;
- auth secret;
- credentials encryption key;
- database URL password;
- refresh tokens;
- cookies.
