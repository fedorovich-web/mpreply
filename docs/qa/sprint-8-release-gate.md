# Sprint 8 full-project release gate

The Sprint 8 artifact is not considered ready until the whole repository passes the following checks.

## Structure and import integrity

- All imported TypeScript modules exist.
- All imported Python modules exist.
- All public routes in `publicRoutes` have a corresponding `page.tsx`.
- No duplicate Next.js App Router route sources.
- All Alembic `down_revision` references resolve to files in the chain.

## Backend

```bash
ruff check app alembic
npx --yes pyright@1.1.411 app
pytest -q
python -m compileall app alembic
alembic heads
```

Expected Alembic head: `20260710_0007`.

## Frontend

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

## Supply-chain hygiene

`package-lock.json` must not contain internal CAAS/OpenAI registry URLs.

## SEO

- `/robots.txt` generated.
- `/sitemap.xml` generated.
- Public pages have metadata and canonical URLs.
- `/app/` and `/auth/` are not indexed.
- No metadata references missing image assets.

## Legal

- Legal pages are explicitly marked as drafts.
- No fake legal entity or contact details are invented.
- Final production release remains blocked on legal review.


## Local environment binding and fail-fast semantics

The Windows release gate explicitly binds official Node-based Pyright to the repository virtual environment using `--pythonpath .venv\Scripts\python.exe`. This prevents thousands of cascading `reportMissingImports` diagnostics when FastAPI, SQLAlchemy, httpx, Dramatiq and other backend dependencies are installed in the project venv but invisible to Pyright.

Every native command is checked by exit code. The gate stops immediately on the first failed step and cannot continue to a green success message after Ruff, Pyright, pytest, Alembic or frontend failures.

Before static analysis, the gate also runs a backend import smoke test and `pip check` to verify that the configured Python environment is actually usable and dependency metadata is consistent.
