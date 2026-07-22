# Sprint 9 production-readiness checklist

## Code quality

- [ ] `python scripts/check_integrity.py`
- [ ] `ruff check app alembic`
- [ ] Pyright strict mode with the project Python interpreter
- [ ] `pytest -q`
- [ ] `python -m compileall -q app alembic`
- [ ] `alembic heads` returns exactly `20260710_0007 (head)`
- [ ] `npm ci`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

## Runtime hardening

- [ ] Production settings reject placeholder secrets.
- [ ] Production settings require secure cookies.
- [ ] Production settings require HTTPS public URLs.
- [ ] Wildcard host/CORS values are rejected in production.
- [ ] Request IDs are returned in API responses.
- [ ] Security headers are present.
- [ ] Sentry does not enable default PII collection.

## Health and lifecycle

- [ ] `/health/live` returns HTTP 200 while the process is alive.
- [ ] `/health/ready` verifies PostgreSQL and Redis.
- [ ] `/health/ready` returns HTTP 503 when a required dependency is unavailable.
- [ ] SQLAlchemy engine is disposed during application shutdown.

## Containers

- [ ] API image builds.
- [ ] Worker image builds.
- [ ] Web standalone image builds.
- [ ] API and worker run as non-root `mpreply` user.
- [ ] Web runs as non-root `nextjs` user.
- [ ] Local Compose validates.
- [ ] Production Compose validates with required environment variables.
- [ ] Migration service completes before API/worker startup.
- [ ] `scripts/container-gate.ps1` passes against Docker Desktop.

## Operations

- [ ] Staging deployment checklist completed.
- [ ] Backup restore drill completed.
- [ ] Rollback procedure reviewed.
- [ ] Incident owner/on-call process defined.
- [ ] Automatic reply containment procedure reviewed.

## Production launch blockers

- [ ] Legal operator details finalized.
- [ ] Privacy/terms legally reviewed.
- [ ] Production domains and TLS configured.
- [ ] Alerting destinations configured.
- [ ] PostgreSQL backup retention defined and restore tested.
- [ ] Marketplace production credentials provisioned.
- [ ] Abuse/rate-limit controls enabled where public exposure requires them.
