# Backend readiness — 30 September 2026

Scope: current dirty checkout on `feat/auth-email-resend`, HEAD `42e5810`. This is a local verification report, not a deployment certificate.

## Fresh checks

- Full backend pytest suite: **475 passed, 15 skipped**. The isolated PostgreSQL tests require their dedicated database setting and passed in a separate run below.
- Ruff for `app` and `alembic`: **passed**.
- Strict Pyright: **0 errors, 0 warnings**.
- Native PostgreSQL credit/automatic-draft checks: **15 passed**, including competing reservations, immutable events and tenant constraints, concurrent trial/recovery, concurrent automatic discovery/claim/process, expired-token rejection, human draft priority and mocked import → AI → rules → Ozon adapter send. The isolated database verified the new migration head → `20260930_0017` → head (`20260930_0018`). Earlier credit-migration reversal was also checked separately.
- The native demo database applied `20260930_0018`. Its live/demo/organizations/billing HTTP checks returned **200** with the new balance response and read-only demo role.
- The real local demo uses PostgreSQL and the ordinary authenticated workspace. Its browser verification is recorded in `public-fixes-demo-2026-09-30.md`.
- Live readiness request: database `ok`; Redis `redis_unavailable`; `/health/ready` returns 503.

The Python suite exercises local fixtures, SQLite and mocked external requests. Passing it does not establish seller-account permissions, external delivery or concurrent PostgreSQL behavior in every subsystem.

## Implemented foundation

- Authentication, sessions, email action flows, organizations and backend access controls.
- Marketplace adapter registrations for Wildberries, Ozon, Yandex Market and Avito, with synchronization and reply safety tests.
- AI draft workflow, review queue, automation rules and analytics.
- Durable reply grants, reservations, atomic draft/credit completion, failure release and idempotent request replay. Trial grants expire after 14 days; paid credits carry over and require an active paid subscription to spend. Legacy provider-free `active` subscriptions do not enable paid spending.
- Bounded scheduler recovery for expired reservations and trial grants, with partial database indexes. This is implemented and tested locally; the continuous scheduler process is not running here.
- Durable automatic draft discovery after imports, delivery leases, credit-safe crash recovery, authorization rechecks and routing into the existing automatic send or human review queue. See `automatic-drafts-verification-2026-09-30.md` for the implementation boundaries and PostgreSQL evidence.
- Read-only demo session with disabled marketplace credentials and server-side mutation rejection.
- Contact and transactional email code using the existing Resend integration.

## Required before calling the backend complete

1. **Verified paid grant issuance.** The ledger and trial activation are implemented. Monthly/add-on grants still need authoritative paid period/order events from the payment provider at the domain stage. The public calculator does not create a payment or credit grant.
2. **Full background runtime.** Redis, the worker and the scheduler are not running in the local demo stack. Queue delivery, process recovery and scheduled execution still need an integrated runtime check. Docker remains unused following the user's instruction; no non-Docker Linux WSL distribution or native Redis executable was found.
3. **Remaining advertised capabilities.** Answer-template CRUD/application, separate grammar checking, plan-specific history/analytics/support entitlements and monetary daily AI budget enforcement still require implementation/certification. The new automatic draft pipeline is verified locally with mocked providers; continuous broker operation and live automatic handling remain part of runtime certification.
4. **Release database verification.** The new credit migration and concurrency matrix passed on isolated native PostgreSQL. This does not certify the full release upgrade/recovery and concurrency matrix for every subsystem.

The trial activation currently follows the announced working assumption of one 350-reply trial per owner account, in its first workspace. The owner confirmed trial expiry but did not answer the separate owner-versus-workspace clarification.

## Domain-stage checks requested by the owner

- Payment-provider integration and verified payment events that issue credits.
- OpenRouter connection, scenario routing and real generated-answer evaluation.
- Actual receipt of registration/reset/contact email, including delivery to `support@mpreply.ru`.
- Seller-account integration and outbound reply checks with authorized access.
- Dokploy environment, production secrets, domain/TLS and process health.

No production deployment, live provider operation, email send or payment was performed for this report. Frontend verification and the remaining **10 visual baseline failures** are recorded separately in `pricing-credits-verification-2026-09-30.md`. The backend and whole project are not certified production-ready.
