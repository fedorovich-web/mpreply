# MPReply

MPReply is a SaaS platform for AI-assisted and automatic replies to marketplace reviews, buyer questions and supported buyer messages. The product combines contextual AI reply preparation, automation rules, human review where required and marketplace execution with idempotency and retry controls.

## Current foundation

Implemented through Sprint 11:

- FastAPI backend with organizations, RBAC and tenant isolation;
- encrypted marketplace credentials;
- marketplace integrations for Wildberries, Ozon, Yandex Market and Avito, with public coverage claims limited to verified runtime capabilities;
- unified Inbox API and dashboard UI;
- Groq/Qwen 3.8 AI draft generation;
- deterministic SafetyGate;
- automation rules engine;
- Dramatiq/Redis worker-backed auto-reply execution;
- public site, SEO and legal drafts;
- production-readiness baseline with health checks, runtime validation, non-root containers, migration orchestration, release gates and operational runbooks;
- optional semi-automatic manual review workflow: draft editing, optimistic revision checks, SafetyGate re-checks, submit for review, approve/reject, idempotent queueing and marketplace execution;
- live SaaS frontend data plane for authentication, first-workspace onboarding, organization selection, Inbox and Review Queue.

Marketplace runtime is implemented for all four supported platforms: Wildberries, Ozon and Yandex Market use review/question streams, while Avito uses its Messenger chat stream. Actual account capabilities still depend on the credentials, seller/account identifier and scopes granted by each marketplace.

## Repository structure

```text
apps/api        FastAPI backend, models, services, migrations and tests
apps/web        Next.js App Router public site and SaaS frontend
apps/worker     Dramatiq worker image
apps/scheduler  Marketplace polling scheduler and dispatch recovery
infra/docker    Local and production Compose manifests
infra/dokploy   Dokploy deployment mapping and checklist
docs            ADRs, security, QA, legal and operations runbooks
scripts         Integrity, release and container gates
```

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

This builds and starts PostgreSQL, Redis, migrations, API, worker, scheduler and web, waits for health checks and verifies API/web readiness. The stack is stopped after the gate unless `-KeepRunning` is supplied.

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
- `infra/dokploy/deployment-checklist.md`
- `docs/operations/backup-restore.md`
- `docs/operations/rollback.md`
- `docs/operations/incident-runbook.md`

Production launch remains blocked until legal review, actual domains/TLS, staging verification, tested backup/restore, alerting and production credentials are complete.
