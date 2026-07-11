# Sprint 12 release report

Release: `0.1.12`  
Scope: Analytics + usage metrics + plan limits + billing-ready schema + internal admin overview.

## Functional scope

- Six tenant-scoped analytics endpoints.
- Live `/app/analytics` workspace.
- Billing plans and subscriptions schema.
- `/api/billing/overview` and `/app/billing`.
- Data-driven plan limit evaluation and enforcement hooks.
- Marketplace imported-message usage events.
- Backend-only superadmin boundary and `/api/admin/overview`.
- Live dashboard metrics.

## Explicit non-claims

- Final commercial prices are not defined.
- A payment provider is not connected.
- Checkout, invoices, webhooks and tax handling are not implemented.
- Large-scale analytics warehouse/rollups are not implemented.
- Docker runtime is not claimed unless `container-gate.ps1` passes in an environment with Docker Desktop.
