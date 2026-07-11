# ADR-0011: Analytics, billing-ready schema and internal admin boundary

Status: Accepted  
Version: 0.1.12  
Date: 2026-07-10

## Context

Respio already persists customer messages, replies, AI drafts, usage events, integration events and tenant memberships. Sprint 12 must expose useful workspace analytics, introduce a billing-ready data model and add an internal superadmin overview without inventing final commercial prices or weakening tenant isolation.

## Decision

1. Analytics is computed from the operational source tables for the current MVP. No warehouse or materialized rollup is introduced before volume justifies it.
2. Every analytics endpoint requires an authenticated organization membership and filters by `organization_id`.
3. Billing plans and subscriptions are persisted in dedicated tables. Public prices remain nullable until unit economics is finalized.
4. Plan limits are data-driven through `billing_plans.limits_json`. Missing limits mean no commercial hard limit has been configured; this avoids inventing product policy in code.
5. Enforcement hooks are active for AI draft generation, marketplace account creation and workspace member addition whenever a numeric limit exists.
6. AI and reply usage continues to be recorded, while marketplace sync now records imported-message usage events.
7. Internal admin access is protected by a dedicated `users.is_superadmin` backend flag. There is no frontend-only bypass and no organization-role shortcut.
8. The current default plan catalog (`Start`, `Growth`, `Team`, `Agency`) has no finalized price and no fabricated commercial usage caps.

## Consequences

- The dashboard and analytics UI can use live API data.
- Billing provider integration can later attach provider IDs and webhook state without redesigning the core schema.
- Plan limits can be configured in data without code changes.
- Analytics queries are intentionally simple and tenant-scoped; a future warehouse/rollup ADR is required before large-scale aggregation is introduced.
