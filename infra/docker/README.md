# Respio container deployment

## Local stack

The local Compose stack includes:

- PostgreSQL;
- Redis;
- one-shot Alembic migration job;
- FastAPI API;
- Dramatiq worker;
- production-built Next.js web container.

From the repository root on Windows PowerShell:

```powershell
.\scripts\container-gate.ps1
```

Keep the verified stack running:

```powershell
.\scripts\container-gate.ps1 -KeepRunning
```

Manual equivalent:

```powershell
docker compose -f infra\docker\docker-compose.local.yml up --build -d --wait
```

Stop:

```powershell
docker compose -f infra\docker\docker-compose.local.yml down
```

Remove local PostgreSQL and Redis volumes only when intentional:

```powershell
docker compose -f infra\docker\docker-compose.local.yml down -v
```

## Production/Dokploy

`docker-compose.production.yml` contains only application services and expects PostgreSQL and Redis to be provisioned separately. Required secrets and environment values are validated explicitly.

Use:

- `infra/dokploy/.env.production.example` as a variable inventory, not as a real secret file;
- `infra/dokploy/deployment-checklist.md` for deployment order and blockers;
- `docs/operations/backup-restore.md` before launch;
- `docs/operations/rollback.md` before the first production migration;
- `docs/operations/incident-runbook.md` before enabling automatic outbound replies.

Do not expose PostgreSQL or Redis publicly. Do not use the production Compose file with placeholder secrets.
