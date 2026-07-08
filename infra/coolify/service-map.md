# Coolify service map

## Staging

- `respio-api-staging`
- `respio-web-staging`
- `respio-postgres-staging`
- `respio-redis-staging`
- `respio-worker-staging`
- `respio-scheduler-staging`

## Production

- `respio-api-prod`
- `respio-web-prod`
- `respio-postgres-prod`
- `respio-redis-prod`
- `respio-worker-prod`
- `respio-scheduler-prod`

## Domains

- `respio.ru`
- `www.respio.ru`
- `app.respio.ru`
- `api.respio.ru`
- `admin.respio.ru`
- `status.respio.ru`

## Rules

- No floating `latest` tags.
- Production secrets only in Coolify secret storage.
- Internal ports closed except reverse proxy exposure.
- Healthchecks required for API, web, database and broker.
