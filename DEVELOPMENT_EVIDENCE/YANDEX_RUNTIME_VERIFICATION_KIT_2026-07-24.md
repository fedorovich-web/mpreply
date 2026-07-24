# Yandex Market runtime verification kit — 2026-07-24

## Baseline

- repository: current protected project repository;
- branch: `work/0.1.104-yandex-foundation`;
- remote baseline commit: `922e1788d99863e2e631addd52d68e07dec3c932`;
- version contracts remain `0.1.103`;
- development target remains `0.1.104`.

## Scope

- safe Python runtime probe using the production Yandex Market adapter;
- read-only credential, Business ID, reviews, questions and pagination checks;
- bounded page count and cursor-cycle fail-closed behavior;
- optional explicitly confirmed review/question write probes;
- preflight duplicate-reply check and post-write visibility check;
- sanitized JSON evidence under ignored `.handoff/` storage;
- PowerShell wrapper with secure key prompt and temporary environment variables;
- unit tests for secret redaction, pagination, cursor cycles, write confirmation, duplicate suppression and moderation-pending behavior;
- no migration;
- no version bump;
- no Ozon adapter inferred from third-party documentation.

## Artifact-environment checks

- Python compileall: PASS;
- new runtime-probe tests: `6 passed`;
- Yandex adapter plus runtime-probe tests: `18 passed`;
- available backend suite: `180 passed` with six existing dependency-bound modules explicitly excluded.

Exact Windows Ruff 0.14.9, strict Pyright 1.1.411, full pytest, release gate and container gate remain authoritative before commit.

## Runtime evidence boundary

The artifact environment has no real Yandex Market seller credentials. Therefore no claim is made that external runtime verification has passed. The kit makes that verification reproducible without exposing the credential.

## Exact Windows Pyright correction

The first runtime-kit artifact was rejected before staging by strict Pyright 1.1.411.
Two diagnostics reported partially unknown `AdapterResult.data` access in the safe scope
extractor and write-postflight helper. Both helpers now first narrow a local `payload`
variable and only then cast it to `dict[str, object]`. No diagnostic suppression was added.

The corrected files still require the exact Windows Ruff, Pyright, full pytest, release
gate and container gate before commit and push.

## Repository integrity correction

The authoritative Windows release gate rejected the first runtime-kit candidate because
the operator script and supporting documentation contained a legacy brand token inside
a hard-coded checkout path and repository identifier.

Corrections:

- the runtime PowerShell probe now derives the repository root from its own `scripts/` location;
- tracked documentation uses repository-neutral checkout variables and placeholders;
- no legacy brand token remains in the runtime-kit exact scope.

The release and container gates remain authoritative after this correction.

## Frontend dependency security correction

The authoritative Windows release gate passed Ruff, strict Pyright, backend tests and
repository integrity, then rejected the candidate at the frontend security audit.

Reported advisory:

- `GHSA-r28c-9q8g-f849`;
- affected package: `postcss`;
- vulnerable versions: `<= 8.5.17`;
- first patched version: `8.5.18`;
- project cause: the explicit `overrides.postcss = 8.5.12` pin.

Correction:

- pin PostCSS to exact `8.5.18`;
- regenerate `apps/web/package-lock.json` with the existing npm toolchain;
- do not run `npm audit fix --force`;
- do not downgrade or otherwise change Next `16.2.11` or Vite `8.1.4`;
- require `npm audit --audit-level=high`, release gate and container gate to pass before commit.

The effective runtime-kit scope is 14 files after adding `apps/web/package.json` and
`apps/web/package-lock.json`.

## PostCSS integrity contract correction

The Windows release gate confirmed that the dependency update and npm audit passed,
then rejected the candidate because the repository integrity checker still pinned
the vulnerable historical value `8.5.12`.

The security baseline is corrected coherently:

- `scripts/check_integrity.py` requires `overrides.postcss = 8.5.18`;
- the regression test requires every PostCSS package-lock entry to resolve to exact `8.5.18`;
- `scripts/tests/test_postcss_security_baseline.py` prevents regression;
- the effective exact scope is 16 files.

## Playwright server isolation correction

The authoritative Windows release gate passed dependency security, backend checks,
repository tooling, integrity, frontend installation, production build and W3C
validation. Critical E2E then reported 21 simultaneous failures while targeting
the default `localhost:3000`.

A controlled rerun forced a new Next server on a free loopback port. The current
application returned all expected routes and the exact critical E2E suite passed:

- `26 passed`;
- no missing routes;
- no historical homepage DOM;
- no workspace API/mock failures.

Permanent correction:

- dedicated Playwright base URL with an explicit port;
- Next dev server port derived from `PLAYWRIGHT_BASE_URL`;
- `reuseExistingServer: false`;
- regression test preventing stale-server reuse;
- effective exact scope: 18 files.
