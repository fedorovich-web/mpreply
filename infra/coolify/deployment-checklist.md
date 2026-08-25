# Coolify deployment checklist

## 1. Resources

Create separate staging and production resources. Do not share PostgreSQL, Redis or application secrets between environments.

Required application services:

- `web` — public site and SaaS frontend;
- `api` — FastAPI backend;
- `worker` — Dramatiq auto-reply and marketplace-sync execution;
- `scheduler` — database-backed marketplace polling dispatcher;
- `migrate` — one-shot Alembic migration job per deployment.
- `cms` — Payload editorial administration and content API;
- `cms-migrate` — one-shot Payload migration job per deployment.

## 2. External stateful services

Provision the application PostgreSQL, CMS PostgreSQL and Redis as separate resources. Store their connection URLs only as server-side secrets. Do not reuse a database user between the application and CMS.

Required production variables include:

```text
API_BASE_URL
WEB_APP_URL
PUBLIC_SITE_URL
DATABASE_URL
REDIS_URL
CMS_DATABASE_URL
CMS_PUBLIC_URL
CMS_API_URL
CMS_READ_TOKEN
CMS_REVALIDATION_URL
CMS_REVALIDATION_SECRET
CMS_REQUEST_TIMEOUT_MS
PAYLOAD_SECRET
AUTH_SECRET_KEY
CREDENTIALS_ENCRYPTION_KEY
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

`OPENROUTER_API_KEY` is an optional first-start bootstrap value. The service administrator can store the provider key and select models in the database-backed LLM settings; leave the environment variable empty after that configuration is verified.

## 3. Domains

Expected production mapping:

```text
mpreply.ru      -> web
www.mpreply.ru  -> redirect to mpreply.ru
app.mpreply.ru  -> web
api.mpreply.ru  -> api
cms.mpreply.ru  -> cms
```

Do not expose PostgreSQL, Redis or the CMS container port publicly. Route the CMS only through Coolify TLS on `cms.mpreply.ru`.

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

CMS:

```text
/api/health
```

Use readiness, not liveness, to decide whether the API should receive traffic.

## 5. Deployment order

1. Application PostgreSQL, CMS PostgreSQL and Redis available in staging.
2. Run the application and CMS migration jobs in staging.
3. Start and verify the staging API and CMS readiness endpoints.
4. Create a CMS service user, store its token as `CMS_READ_TOKEN` for web, and verify that it can read only published content.
5. Start worker, scheduler and web; verify draft, approval, publish, media and webhook revalidation flows.
6. Complete database and CMS-media restore drills in staging.
7. Repeat the same ordered deployment in production.
8. Run production smoke tests before enabling or resuming automatic reply execution.

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
- CMS service user has no admin UI access and no create, update, delete or draft-read permission;
- CMS and web share only the revalidation secret and the read-only service token;
- CMS media volume is writable only by the non-root CMS process.

## 7. Pre-launch blockers

Do not call the system production-ready until legal review, tested application/CMS database and media restores, alerting, real domains/TLS, staging verification and incident ownership are complete.
