# Coolify service map

## Staging

Application services:

- `mpreply-api-staging`
- `mpreply-web-staging`
- `mpreply-worker-staging`
- `mpreply-scheduler-staging`
- one-shot migration job per deployment

Stateful resources:

- `mpreply-postgres-staging`
- `mpreply-redis-staging`

## Production

Application services:

- `mpreply-api-prod`
- `mpreply-web-prod`
- `mpreply-worker-prod`
- `mpreply-scheduler-prod`
- one-shot migration job per deployment

Stateful resources:

- `mpreply-postgres-prod`
- `mpreply-redis-prod`

Provision a dedicated scheduler service from `apps/scheduler/Dockerfile`; it claims due polling states and dispatches marketplace-sync jobs to Dramatiq.

## Domains

- `mpreply.ru` -> web
- `www.mpreply.ru` -> redirect to `mpreply.ru`
- `app.mpreply.ru` -> web
- `api.mpreply.ru` -> api
- `admin.mpreply.ru` -> reserved; do not expose until an admin surface exists
- `status.mpreply.ru` -> reserved for status tooling
- `docs.mpreply.ru` -> reserved for documentation

## Rules

- No floating `latest` tags for application/runtime images.
- Production secrets only in server-side secret storage.
- PostgreSQL and Redis are not exposed publicly.
- API traffic uses readiness checks; liveness alone is insufficient for routing.
- Migrations complete before API and worker startup.
- Production rollback does not automatically downgrade the database schema.
