# Development verification results

Verification date: 2026-07-24

## Exact project-copy checks

- `python -m compileall -q app alembic`: PASS
- targeted backend integration/regression matrix: `64 passed`
- broad backend suite available in this container: `166 passed`
- changed TypeScript/TSX files parsed with TypeScript compiler API: PASS
- changed TypeScript/TSX files transpiled in strict isolated-module mode: PASS

## Environment limitation

The complete backend suite could not be collected in this container because `asyncpg`, `redis` and `pwdlib` are unavailable from the internal Python package mirror. Six existing test modules were therefore excluded from the broad run. The user's verified Windows environment contains those exact project dependencies.

The frontend dependency tree could not be installed because the internal npm mirror returned HTTP 503. Consequently Vitest, project TypeScript typecheck, ESLint and Next.js build were not executed in this container.

## Required before commit or release

Run on the Windows checkout with the project toolchain:

```powershell
cd C:\Work\respio\apps\api
& C:\Work\respio\.venv\Scripts\ruff.exe check app alembic
npx.cmd --yes pyright@1.1.411 --pythonpath C:\Work\respio\.venv\Scripts\python.exe app
& C:\Work\respio\.venv\Scripts\pytest.exe -q

cd C:\Work\respio\apps\web
npm.cmd ci
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build

cd C:\Work\respio
& .\scripts\release-gate.ps1
& .\scripts\container-gate.ps1
```
