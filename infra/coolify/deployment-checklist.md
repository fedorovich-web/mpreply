# Coolify deployment checklist

## 1. Resources

Create separate staging and production resources. Do not share PostgreSQL, Redis or application secrets between environments.

Required application services:

- `web` — public site and SaaS frontend;
- `api` — FastAPI backend;
- `worker` — Dramatiq auto-reply and marketplace-sync execution;
- `scheduler` — database-backed marketplace polling dispatcher;
- `migrate` — one-shot Alembic migration job per deployment.

## 2. External stateful services

Provision PostgreSQL and Redis as separate resources. Store their connection URLs only as server-side secrets.

Required production variables include:

```text
API_BASE_URL
WEB_APP_URL
PUBLIC_SITE_URL
DATABASE_URL
REDIS_URL
AUTH_SECRET_KEY
CREDENTIALS_ENCRYPTION_KEY
OPENROUTER_API_KEY
CORS_ALLOWED_ORIGINS
ALLOWED_HOSTS
DEPLOYMENT_VERSION
FORWARDED_ALLOW_IPS
RATE_LIMIT_ENABLED
AUTH_LOGIN_ACCOUNT_LIMIT
AUTH_LOGIN_IP_LIMIT
AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS
AUTH_REGISTRATION_ACCOUNT_LIMIT
AUTH_REGISTRATION_IP_LIMIT
AUTH_REGISTRATION_RATE_LIMIT_WINDOW_SECONDS
AUTH_REFRESH_TOKEN_LIMIT
AUTH_REFRESH_IP_LIMIT
AUTH_REFRESH_RATE_LIMIT_WINDOW_SECONDS
```

`CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS` use JSON arrays.

## 3. Domains

Expected production mapping:

```text
mpreply.ru      -> web
www.mpreply.ru  -> redirect to mpreply.ru
app.mpreply.ru  -> web
api.mpreply.ru  -> api
```

Do not expose PostgreSQL or Redis publicly.

## 4. Health checks

API:

```text
/health/live
/health/ready
```

Web:

```text
/api/health
```

Use readiness, not liveness, to decide whether the API should receive traffic.

## 5. Deployment order

1. PostgreSQL and Redis available.
2. Run migration job.
3. Start API.
4. Verify API readiness.
5. Start worker.
6. Start scheduler.
7. Start web.
8. Run smoke tests.
9. Only then enable or resume automatic reply execution.

## 6. Security checks

- production settings start successfully with no placeholder secrets;
- `AUTH_COOKIE_SECURE=true`;
- HTTPS on public URLs;
- explicit `ALLOWED_HOSTS`;
- explicit CORS origins;
- no wildcard host/CORS configuration;
- Redis-backed authentication rate limiting enabled;
- marketplace credentials remain backend-only and encrypted;
- no `.env`, secrets or internal package-registry URLs in images or repository.

## 7. Pre-launch blockers

Do not call the system production-ready until legal review, tested backups/restores, alerting, real domains/TLS, staging verification and incident ownership are complete.
