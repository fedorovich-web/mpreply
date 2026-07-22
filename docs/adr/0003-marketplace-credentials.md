# ADR-0003 — Marketplace credentials lifecycle

## Status
Accepted for Sprint 2.

## Context
MPReply clients connect their own marketplace seller accounts through API keys or other official API credentials. Those secrets must never be stored in plaintext, exposed to the frontend, or written to logs.

## Decision
Sprint 2 adds marketplace account management with backend-only credential encryption and a controlled lifecycle:

- create marketplace account;
- store `credentials_encrypted` only;
- calculate non-secret fingerprint for masked UI display;
- validate credentials through the marketplace adapter;
- rotate credentials;
- revoke credentials;
- write audit events for every credential operation.

The API returns `credentials_masked`, never the raw credential.

## Authorization
Only `owner` and `admin` can create, update, validate, rotate, or revoke credentials. `manager` and `viewer` can read marketplace account metadata but cannot manage secrets.

## Marketplace scope
Wildberries is enabled as the first adapter. Ozon, Yandex Market, and Avito remain disabled until verified endpoint-level contracts are finalized.

## Consequences
- Sprint 3 can safely use decrypted credentials inside worker/adapter memory only.
- Frontend integration screens can display safe connection metadata without secret leakage.
- Audit trail is available before real sync/send jobs are introduced.
