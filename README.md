# MPReply

MPReply is a SaaS platform for AI-assisted and automatic replies to marketplace reviews and questions. The product is auto-first by default: AI prepares a response, SafetyGate evaluates risk, automation rules decide whether to send automatically or require review, and worker-backed execution publishes through marketplace adapters with idempotency and retry controls.

## Current foundation

Implemented through Sprint 11:

- FastAPI backend with organizations, RBAC and tenant isolation;
- encrypted marketplace credentials;
- Wildberries synchronization and reply execution foundation;
- Yandex Market Partner API integration for accounts, reviews, questions and replies;
- client dashboard observability for account health, scopes, scheduler streams, sync jobs and safe integration events;
- safe Yandex Market runtime verification kit with bounded read checks, optional confirmed write probes and sanitized evidence;
- operation-aware marketplace sync foundation with bounded cursor pagination;
- unified Inbox API and dashboard UI;
- OpenRouter AI draft generation;
- deterministic SafetyGate;
- automation rules engine;
- Dramatiq/Redis worker-backed auto-reply execution;
- public site, SEO and legal drafts;
- production-readiness baseline with health checks, runtime validation, non-root containers, migration orchestration, release gates and operational runbooks;
- optional semi-automatic manual review workflow: draft editing, optimistic revision checks, SafetyGate re-checks, submit for review, approve/reject, idempotent queueing and marketplace execution;
- live SaaS frontend data plane for authentication, first-workspace onboarding, organization selection, Inbox and Review Queue.

Wildberries remains the established integration. The 0.1.104 feature branch now contains the Yandex Market Partner API vertical slice and its health dashboard; this development batch adds the runtime-verification kit required before release. Ozon and Avito remain disabled until their current official contracts and runtime requirements are implemented and verified. See `DEVELOPMENT_STATUS_0.1.104.md`.

## Repository structure

```text
apps/api        FastAPI backend, models, services, migrations and tests
apps/web        Next.js App Router public site and SaaS frontend
apps/worker     Dramatiq worker image
apps/scheduler  Placeholder only; intentionally excluded from deployment
infra/docker    Local and production Compose manifests
infra/coolify   Coolify deployment mapping and checklist
docs            ADRs, security, QA, legal and operations runbooks
scripts         Integrity, release and container gates
```

## Yandex Market runtime verification

After applying and verifying the runtime-kit batch, run the default read-only probe with a real seller Api-Key and Business ID:

```powershell
.\scripts\yandex-market-runtime-probe.ps1
```

The key is entered through a secure prompt. Evidence is written under ignored `.handoff/` storage and contains no raw credential, full Business ID, cursor, customer text, or provider payload. See `docs/integrations/yandex-market-runtime-verification.md`.

## Local code verification

From PowerShell in the repository root:

```powershell
.\scripts\release-gate.ps1
```

The code gate checks repository integrity, backend imports/dependencies, Ruff, Pyright strict mode, tests, compileall, Alembic head, frontend clean install, security audit, TypeScript, ESLint and production build.

## Local container verification

With Docker Desktop running:

```powershell
.\scripts\container-gate.ps1
```

This builds and starts PostgreSQL, Redis, migrations, API, worker and web, waits for health checks and verifies API/web readiness. The stack is stopped after the gate unless `-KeepRunning` is supplied.

```powershell
.\scripts\container-gate.ps1 -KeepRunning
```

## Manual local Compose

```powershell
cd C:\Work\mpreply
docker compose -f infra\docker\docker-compose.local.yml up --build -d --wait
```

Readiness endpoints:

```text
http://localhost:8000/health/live
http://localhost:8000/health/ready
http://localhost:3000/api/health
```

Stop the stack:

```powershell
docker compose -f infra\docker\docker-compose.local.yml down
```

## Production deployment

Production Compose expects PostgreSQL and Redis as external stateful services and requires explicit secrets and origin/host configuration. See:

- `infra/docker/docker-compose.production.yml`
- `infra/coolify/deployment-checklist.md`
- `docs/operations/backup-restore.md`
- `docs/operations/rollback.md`
- `docs/operations/incident-runbook.md`

Production launch remains blocked until legal review, actual domains/TLS, staging verification, tested backup/restore, alerting and production credentials are complete.
