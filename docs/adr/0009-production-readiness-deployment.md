# ADR-0009 — Production-readiness and deployment baseline

Status: accepted for Sprint 9 foundation.

## Context

Respio had working application code, migrations, a worker and a basic local Compose file, but production deployment still lacked explicit runtime validation, dependency-aware readiness, non-root production images, repeatable migration orchestration, container smoke testing and operational runbooks.

## Decision

Adopt the following baseline:

- API, worker and web run in dedicated non-root production images.
- Next.js uses standalone output for a smaller production runtime image.
- Database migrations run as an explicit one-shot deployment service before API and worker startup.
- `/health/live` reports process liveness; `/health/ready` checks PostgreSQL and Redis.
- Production settings reject placeholder secrets, insecure cookies, HTTP public URLs, wildcard hosts and wildcard CORS.
- Request IDs are propagated and returned to clients; security headers are enabled by default.
- Sentry remains optional and is initialized only when `SENTRY_DSN` is present, with default PII collection disabled.
- `scripts/release-gate.ps1` remains code-focused so Docker Desktop is not required for every edit.
- `scripts/container-gate.ps1` is a separate integration gate for the complete local stack.
- GitHub Actions validates backend, frontend, dependency audit, Compose configuration and production image builds.

## Production boundary

Sprint 9 does not itself make the product legally or operationally ready for public launch. Production launch remains blocked until at least:

- legal documents are finalized with actual operator details;
- production domains and TLS are configured;
- PostgreSQL and Redis backup/restore are tested against the chosen infrastructure;
- alerting destinations are configured;
- marketplace production credentials are provisioned;
- rate limiting and abuse controls are enabled for public endpoints;
- an actual staging deployment passes the deployment checklist.

## Scheduler status at the Sprint 9 decision

At Sprint 9, the placeholder scheduler image was intentionally excluded from local and production deployment manifests until a real scheduler responsibility and implementation existed. No production-ready scheduler capability was claimed by that decision.

The current local and production manifests include a scheduler running `app.workers.marketplace_scheduler`. It polls due work and dispatches background jobs; see [the service map](../../infra/dokploy/service-map.md) for the current topology. Its presence in the manifests does not certify a deployed release or authorize resuming paused background processing.
