# Dokploy service map

## Deployment model

MPReply is deployed as one Dokploy Docker Compose application per environment from this repository.

Production source:

- repository: `fedorovich-web/mpreply`;
- branch: `main`;
- Compose path: `./infra/docker/docker-compose.production.yml`;
- production deploys follow verified merges to `main`.

Use Dokploy's native Docker Compose domain management rather than hardcoding Traefik labels in the repository. Keep the application deployment isolated unless there is a documented reason to join the shared `dokploy-network` manually.

## Application services

The production Compose application contains:

- `migrate` — one-shot Alembic migration gate;
- `api` — FastAPI backend, internal port `8000`;
- `worker` — Dramatiq auto-reply execution;
- `web` — Next.js public site and SaaS frontend, internal port `3000`.

The scheduler placeholder remains excluded until a real scheduler responsibility and implementation exist.

## Stateful resources

Provision PostgreSQL and Redis as separate Dokploy-managed database/services (or equivalent external managed services). They are not part of the production application Compose file and must not be exposed publicly.

Use separate state, credentials and backups for staging and production.

## Domains

Configure these mappings in the Dokploy **Domains** tab for the Docker Compose application:

- `mpreply.ru` -> service `web`, port `3000`;
- `www.mpreply.ru` -> redirect/canonical handling to `mpreply.ru`;
- `app.mpreply.ru` -> service `web`, port `3000`;
- `api.mpreply.ru` -> service `api`, port `8000`.

## Environment and secrets

Dokploy Compose environment values are used for `${VAR_NAME}` interpolation by `docker-compose.production.yml`; the Compose file explicitly injects the required values into containers.

Keep real values only in Dokploy environment/service variables or a configured external secret provider. Never commit production `.env` files. `GROQ_API_KEY`, database credentials, auth secrets and the Fernet key are backend-only.

## Rules

- No floating `latest` tags for application/runtime images.
- No public PostgreSQL or Redis ports.
- API routing depends on `/health/ready`, not liveness alone.
- `migrate` must complete successfully before API and worker startup.
- Production rollback does not automatically downgrade the database schema.
- Review Dokploy **Preview Compose** before the first production deploy and after domain/network changes.
