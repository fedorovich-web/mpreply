# Yandex Market dashboard observability — 2026-07-24

## Baseline

- remote branch: `work/0.1.104-yandex-foundation`
- remote commit: `ecf0b170060681dd6747d6871a8b44e72c39c6c1`

## Scope

- generic account overview API and schema;
- safe scope extraction and metadata sanitization;
- health derivation from account, scheduler streams and latest manual sync;
- recent sync jobs and integration events;
- Yandex Market dashboard panels for health, permissions, streams and history;
- failed-sync retry through the existing manual sync endpoint;
- no migration and no version bump.

## Checks in the artifact environment

- `python -m compileall -q app alembic`: PASS
- targeted backend tests: `60 passed`
- available backend suite: `174 passed`
- TypeScript 5.8 parser/transpile for changed TS/TSX: PASS
- CSS parse with `tinycss2`: PASS
- synthetic normalized Git diff check: PASS

## Required external gates

The Windows checkout remains authoritative for:

- Ruff 0.14.9;
- Pyright 1.1.411 strict;
- complete pytest with exact dependencies;
- Vitest and frontend design tests;
- project TypeScript typecheck;
- ESLint;
- Next.js production build;
- release gate;
- container gate.

## Exact Windows Ruff correction

The first dashboard archive was rejected by the authoritative Windows Ruff 0.14.9 gate before staging or commit. Reported findings:

- `I001` in `app/schemas/marketplace_overview.py`;
- two `F821` findings for `MarketplaceAccountResponse` in `marketplace_account_service.py`;
- `I001` in `test_marketplace_account_overview_contract.py`.

Corrections applied:

- normalized the schema import-block boundary;
- restored the proven local runtime import used by `MarketplaceAccountService.to_response`;
- placed `pathlib` with the standard-library imports in the contract test.

Post-correction artifact checks:

- Python compileall: PASS;
- dashboard/marketplace targeted matrix: `60 passed`;
- available backend suite: `174 passed`;
- `git diff --check`: PASS.

The corrected files still require the exact Windows Ruff 0.14.9 and strict Pyright 1.1.411 gates before commit.

## Effective scope correction

The Ruff hotfix restored `MarketplaceAccountService.to_response` to the exact implementation
already present in baseline commit `ecf0b170060681dd6747d6871a8b44e72c39c6c1`.
Its corrected Git blob SHA is `7a3f9ebdd669d37f801a17dc68beb70f7d8e06ee`, matching the baseline blob.
Therefore `apps/api/app/services/marketplace_account_service.py` correctly disappears from
`git diff`, and the dashboard commit has an effective exact scope of 18 files rather than 19.
