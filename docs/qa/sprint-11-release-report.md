# Sprint 11 release report

Release: `0.1.11`  
Scope: live authentication, organization bootstrap, Inbox API integration and Review Queue API integration.

## Added

Backend:

- `GET /api/replies/review-queue`;
- tenant-scoped review queue projection joining Reply, CustomerMessage and Product;
- persisted SafetyGate metadata projection;
- review queue route and metadata tests.

Frontend:

- typed API client with request IDs and structured errors;
- Zod schemas for auth, organizations, messages, replies and review queue;
- TanStack Query provider;
- authenticated workspace provider;
- first-workspace onboarding;
- real login/register forms;
- active organization selector;
- real logout;
- live Inbox;
- live Review Queue workflow.

Deployment:

- `NEXT_PUBLIC_API_BASE_URL` added to web image build contract;
- local Compose injects `http://localhost:8000`;
- production Compose injects the required public API URL;
- deployment version synchronized to `0.1.11` across backend, frontend, health response, Compose and environment examples.

## Not claimed

This release does not claim that every SaaS dashboard screen is live. AI Assistant, Automation Rules and Integrations still retain earlier foundation/UI behavior where not explicitly wired in this sprint.

This release also does not claim Docker runtime validation in the artifact environment. The Windows `container-gate.ps1` remains the authoritative runtime check for local PostgreSQL, Redis, migration, API, worker and web startup.
