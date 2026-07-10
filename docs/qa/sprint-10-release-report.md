# Sprint 10 release report

## Scope

Sprint 10 adds the optional semi-automatic human-review workflow while preserving auto-first behavior as the default.

## Verified in the build environment

Backend:

- `ruff check app alembic` — passed;
- Pyright 1.1.411 strict — `0 errors, 0 warnings, 0 informations`;
- `pytest -q` — `53 passed`;
- `compileall` — passed;
- `alembic heads` — `20260710_0008 (head)`.

Frontend:

- `npm ci` — passed;
- `npm audit --audit-level=high` — `0 vulnerabilities`;
- `npm run typecheck` — passed;
- `npm run lint` — passed;
- `npm run build` — passed;
- Next.js production build generated 28 routes, including `/app/review-queue`.

Repository integrity:

- route/import/migration/version/dependency checks — passed on the clean release tree;
- generated artifacts are excluded from archives;
- package lock contains no internal OpenAI/CAAS registry URLs.

## Not claimed as re-verified here

A real Docker runtime and PostgreSQL migration execution were not re-run in this build environment. Sprint 9's container gate was successfully verified by the project owner on Windows 11 after the PostgreSQL 18 volume-path fix. Sprint 10 adds migration `20260710_0008`, so the local `container-gate.ps1` should be run after applying this patch to verify the new migration against the real PostgreSQL container.
