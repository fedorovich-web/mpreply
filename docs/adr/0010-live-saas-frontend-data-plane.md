# ADR 0010 — Live SaaS frontend data plane

Status: accepted  
Version: 0.1.11

## Context

The dashboard shell, Inbox and Review Queue existed before Sprint 11, but the visible data was still local demonstration state. Backend contracts for authentication, organizations, messages and the manual reply workflow already existed.

Keeping the UI on demo data would create a second source of truth and hide integration defects until late deployment stages.

## Decision

Use the FastAPI backend as the only source of truth for authenticated SaaS state.

The frontend now uses:

- `GET /api/auth/me` for the current session;
- `GET /api/organizations` for tenant workspaces;
- `POST /api/organizations` for first-workspace onboarding;
- `GET /api/messages` and `PATCH /api/messages/{id}` for Inbox;
- `GET /api/replies/review-queue` for the manual-review projection;
- existing manual reply workflow endpoints for edit, review, approval, rejection and send.

Client responses are validated with Zod before entering React state. Requests always use `credentials: include` because authentication remains backend-issued and HTTP-only-cookie based.

## Frontend state model

TanStack Query owns remote server state. Local React state is limited to:

- filters;
- selected row IDs;
- unsaved editor text;
- rejection reason;
- active organization preference stored in `localStorage`.

Server responses are invalidated after mutations rather than manually rewriting cached domain objects.

## Multi-tenant boundary

The selected organization ID is a client preference, not an authorization mechanism. Every backend read/write still validates organization membership and role.

## Review Queue projection

A dedicated read endpoint joins reply, customer message and product context in one tenant-scoped response. This avoids browser-side N+1 requests and keeps the editor projection consistent with backend reply state.

The endpoint includes only semi-auto replies in actionable review states:

- `draft`;
- `manual_review_required`;
- `waiting_review`;
- `approved`.

## API base URL

`NEXT_PUBLIC_API_BASE_URL` is injected at web build time:

- local: `http://localhost:8000`;
- production: public API URL such as `https://api.respio.ru`.

No secret is placed in this variable.

## Consequences

Positive:

- authentication forms are real;
- new users can create their first workspace;
- Inbox is backed by real marketplace-normalized messages;
- Review Queue operates on real replies with optimistic revision control;
- stale API payloads fail schema validation instead of silently entering the UI.

Trade-offs:

- frontend availability now depends on API reachability after login;
- the dashboard still has other demo/foundation screens that must be wired in later sprints;
- CSRF hardening remains a separate security item for the final production pass.
