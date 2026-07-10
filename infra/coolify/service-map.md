# Coolify service map

## Staging

Application services:

- `respio-api-staging`
- `respio-web-staging`
- `respio-worker-staging`
- one-shot migration job per deployment

Stateful resources:

- `respio-postgres-staging`
- `respio-redis-staging`

## Production

Application services:

- `respio-api-prod`
- `respio-web-prod`
- `respio-worker-prod`
- one-shot migration job per deployment

Stateful resources:

- `respio-postgres-prod`
- `respio-redis-prod`

The scheduler placeholder is intentionally excluded until a real scheduler responsibility and implementation exist.

## Domains

- `respio.ru` -> web
- `www.respio.ru` -> redirect to `respio.ru`
- `app.respio.ru` -> web
- `api.respio.ru` -> api
- `admin.respio.ru` -> reserved; do not expose until an admin surface exists
- `status.respio.ru` -> reserved for status tooling
- `docs.respio.ru` -> reserved for documentation

## Rules

- No floating `latest` tags for application/runtime images.
- Production secrets only in server-side secret storage.
- PostgreSQL and Redis are not exposed publicly.
- API traffic uses readiness checks; liveness alone is insufficient for routing.
- Migrations complete before API and worker startup.
- Production rollback does not automatically downgrade the database schema.
