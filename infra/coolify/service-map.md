# Coolify service map

## Staging

Application services:

- `mpreply-api-staging`
- `mpreply-web-staging`
- `mpreply-worker-staging`
- `mpreply-scheduler-staging`
- `mpreply-cms-staging`
- one-shot migration job per deployment
- one-shot CMS migration job per deployment

Stateful resources:

- `mpreply-postgres-staging`
- `mpreply-redis-staging`
- `mpreply-cms-postgres-staging`
- persistent `cms-media` volume attached only to the CMS application

## Production

Application services:

- `mpreply-api-prod`
- `mpreply-web-prod`
- `mpreply-worker-prod`
- `mpreply-scheduler-prod`
- `mpreply-cms-prod`
- one-shot migration job per deployment
- one-shot CMS migration job per deployment

Stateful resources:

- `mpreply-postgres-prod`
- `mpreply-redis-prod`
- `mpreply-cms-postgres-prod`
- persistent `cms-media` volume attached only to the CMS application

Provision a dedicated scheduler service from `apps/scheduler/Dockerfile`; it claims due polling states and dispatches marketplace-sync jobs to Dramatiq.

## Domains

- `mpreply.ru` -> web
- `www.mpreply.ru` -> redirect to `mpreply.ru`
- `app.mpreply.ru` -> web
- `api.mpreply.ru` -> api
- `cms.mpreply.ru` -> CMS editor/admin interface
- `admin.mpreply.ru` -> reserved for the MPReply service administration surface
- `status.mpreply.ru` -> reserved for status tooling
- `docs.mpreply.ru` -> reserved for documentation

## Rules

- No floating `latest` tags for application/runtime images.
- Production secrets only in server-side secret storage.
- PostgreSQL and Redis are not exposed publicly.
- The application and CMS PostgreSQL resources use separate databases, users and backup policies.
- The CMS internal port is not published; Coolify routes only `cms.mpreply.ru` to it.
- CMS media and both PostgreSQL resources must be backed up and restore-tested before production launch.
- API traffic uses readiness checks; liveness alone is insufficient for routing.
- Migrations complete before API and worker startup.
- Production rollback does not automatically downgrade the database schema.
