# Dokploy deployment checklist

## 1. Project and source

Create separate Dokploy environments for staging and production. Production must deploy from `main` only after the repository Quality Gate passes.

Create one **Docker Compose** application for MPReply and configure:

```text
Repository: fedorovich-web/mpreply
Branch: main
Compose path: ./infra/docker/docker-compose.production.yml
```

Do not use Docker Stack for this repository: the production manifest builds images from repository Dockerfiles.

## 2. Stateful services

Provision PostgreSQL and Redis separately in Dokploy (or use equivalent external managed services). Do not share production databases, Redis instances, credentials or backups with staging.

Do not expose PostgreSQL or Redis publicly.

## 3. Environment variables and secrets

Use `infra/dokploy/.env.production.example` as the inventory. Enter real values in Dokploy's environment/service variable UI; never commit a production `.env` file.

Required production values include:

```text
API_BASE_URL
WEB_APP_URL
PUBLIC_SITE_URL
DATABASE_URL
REDIS_URL
AUTH_SECRET_KEY
CREDENTIALS_ENCRYPTION_KEY
GROQ_API_KEY
CORS_ALLOWED_ORIGINS
ALLOWED_HOSTS
FORWARDED_ALLOW_IPS
DEPLOYMENT_VERSION
```

`CORS_ALLOWED_ORIGINS` and `ALLOWED_HOSTS` are JSON arrays.

The production Compose file references variables explicitly with `${VAR_NAME}` and injects them into the required containers. Dokploy variables are therefore used for Compose interpolation; do not add a repository bind-mounted `.env` file.

`GROQ_API_KEY` is backend-only. The frontend must never receive it. The configured model is `qwen/qwen3.8-27b` through `https://api.groq.com/openai/v1`.

For `FORWARDED_ALLOW_IPS`, use the actual Dokploy/Traefik proxy address or trusted network visible in the effective deployment. Do not use `*`. Verify the effective network in **Preview Compose** before launch.

## 4. Domains

Use Dokploy's native **Domains** tab for the Compose application:

```text
mpreply.ru      -> web:3000
app.mpreply.ru  -> web:3000
api.mpreply.ru  -> api:8000
```

Configure `www.mpreply.ru` to canonicalize/redirect to `mpreply.ru`. DNS must point to the Dokploy host and public routes must use HTTPS.

Do not hardcode Traefik labels into `docker-compose.production.yml` unless native Dokploy domain management cannot satisfy a documented requirement.

## 5. Health and deployment order

API health endpoints:

```text
/health/live
/health/ready
```

Web health endpoint:

```text
/api/health
```

Required order is enforced by Compose where applicable:

1. PostgreSQL and Redis are reachable.
2. `migrate` runs `alembic upgrade head` and exits successfully.
3. `api` starts and reaches `/health/ready`.
4. `worker` starts.
5. `scheduler` starts.
6. `web` starts and reaches `/api/health`.
7. Run production smoke checks.
8. Only then enable/resume automatic reply execution.

## 6. Security and operational checks

Before production traffic:

- production settings reject placeholder secrets;
- `AUTH_COOKIE_SECURE=true`;
- `ALLOWED_HOSTS` and CORS origins are explicit, with no wildcard;
- Groq and marketplace credentials remain backend-only and are scrubbed from logs;
- no real `.env`, secret or internal package-registry URL is committed or baked into images;
- application containers run non-root with `no-new-privileges`;
- production database and Redis have tested backups;
- Dokploy domain routing and effective Compose are reviewed after every networking change;
- rollback and incident runbooks have an assigned owner.

## 7. Release gate

Do not call a deployment production-ready until all repository checks pass, Dokploy environment variables are populated, domains/TLS are verified, backup/restore is tested, alerting exists, and a production smoke test has completed successfully.
