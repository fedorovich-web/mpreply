# Respio 0.1.101 — team invitations and refresh-session security

## Scope

- Organization invitations with single-use hashed tokens and bounded expiry.
- Owner/admin member management without ownership mutation.
- Server-side refresh sessions with rotation and token-family reuse detection.
- Session listing, selected revocation and logout-all.
- No public UI, CSS or visual snapshot changes.

## Migration

Alembic head: `20260722_0013`.

## Security contract

Raw refresh and invitation tokens are returned or stored only in cookies/API responses as required; the database stores SHA-256 hashes. Refresh-token reuse revokes the full token family.
