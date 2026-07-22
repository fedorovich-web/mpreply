# ADR-0002 — Auth, organizations, RBAC foundation

## Status

Accepted for Sprint 1.

## Context

MPReply is a multi-tenant SaaS. Every business entity must be scoped to an organization/workspace, and every user action that touches tenant data must pass authentication and RBAC checks.

## Decision

Sprint 1 adds:

- user registration and login;
- HTTP-only access cookie session baseline;
- organization creation;
- owner membership creation;
- organization list/detail/update endpoints;
- organization-scoped membership checks;
- RBAC roles: `owner`, `admin`, `manager`, `viewer`, `superadmin`;
- audit log writes for registration, login and organization changes.

## Security notes

- The frontend must not store marketplace credentials, OpenRouter keys or auth secrets.
- API routes that require organization context must verify membership before returning tenant data.
- `owner` and `admin` are the only roles allowed to update organization settings in Sprint 1.
- The default organization response mode is `auto`.

## Consequences

- Sprint 2 can safely build marketplace account and encrypted credentials flows on top of the RBAC baseline.
- Future API modules should use shared auth/tenant dependencies rather than ad-hoc checks.
