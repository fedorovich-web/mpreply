# Respio — Sprint 7 Worker-backed Auto-reply Execution

Sprint 7 turns the previous SafetyGate and Automation Rules foundation into an executable, worker-backed auto-reply pipeline.

## Added in Sprint 7

- Dramatiq 2.x Redis broker integration.
- Worker actor for automatic marketplace reply execution.
- Durable reply lifecycle with attempts, retry metadata, worker message id and error state.
- Application-level idempotency with a unique database key.
- Wildberries preflight reconciliation before send.
- Real Wildberries review and question reply execution through the adapter.
- Runtime organization/rule quotas checked before enqueue and again before send.
- Explicit customer-message and reply state-machine guards.
- Retryable vs terminal marketplace error classification.
- Audit, integration and usage events for reply execution.
- Reply API for enqueue, list, detail and explicit retry.
- Docker Compose worker service.
- Alembic migration `20260710_0007`.

## New API

```text
POST /api/replies/auto/enqueue
GET  /api/replies
GET  /api/replies/{reply_id}
POST /api/replies/{reply_id}/retry
```

## Local verification

Backend:

```powershell
cd C:\Work\respio\apps\api
..\..\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
ruff check app
pyright app
pytest -q
python -m compileall app alembic
alembic heads
```

Frontend:

```powershell
cd C:\Work\respio\apps\web
npm install
npm run typecheck
npm run lint
npm run build
```

Docker:

```powershell
cd C:\Work\respio
docker compose -f infra/docker/docker-compose.local.yml up --build
```

The worker service starts with:

```text
dramatiq app.workers.auto_reply --processes 1 --threads 4
```

## Boundary

Sprint 7 provides the execution foundation for Wildberries. Production rollout still requires staging validation with a real seller token, real marketplace sandbox/test data where available, monitoring, alerting, backup checks and production secrets.

## Verification performed

- `ruff check app` — passed.
- `pyright app` — 0 errors, 0 warnings.
- `pytest -q` — 32 passed.
- `python -m compileall app alembic` — passed.
- `alembic heads` — `20260710_0007 (head)`.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed on Next.js 16.2.9.
- Dramatiq worker module import — passed with `RedisBroker` and `auto_reply_actor`.
- Docker daemon was not available in the build environment, so `docker compose up --build` was not executed here.
