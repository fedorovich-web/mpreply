# Sprint 9 release verification report

Version: `0.1.9`

## Verified in the build environment

Backend:

- `python -m pip check` — no broken requirements.
- `ruff check app alembic` — passed.
- Pyright `1.1.411` strict mode bound to the project Python interpreter — `0 errors, 0 warnings, 0 informations`.
- `pytest -q` — `41 passed`.
- `python -m compileall -q app alembic` — passed.
- `alembic heads` — `20260710_0007 (head)`.

Frontend:

- clean `npm ci` from the lockfile — passed.
- `npm audit --audit-level=high` — `0 vulnerabilities`.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed on Next.js `16.2.10`; the build recognized 27 routes including `/api/health`.

Repository integrity:

- public routes resolve to real page files;
- local Python imports resolve;
- relative TypeScript imports resolve;
- Alembic chain has one expected head;
- frontend dependency security baseline is pinned;
- package lock contains no internal OpenAI/CAAS registry URLs;
- production deployment contract and release-gate contract pass the repository integrity script.

## Not claimed as verified here

Docker image builds and live Compose startup were not executed in this build environment because Docker CLI/daemon were unavailable. The repository includes:

- GitHub Actions image-build validation;
- `scripts/container-gate.ps1` for Docker Desktop;
- local and production Compose manifests;
- API and web readiness checks.

A Sprint 9 deployment must not be called staging-verified or production-ready until `scripts/container-gate.ps1` and the Dokploy deployment checklist pass in an environment with Docker and the target infrastructure.
