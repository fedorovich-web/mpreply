# Frontend dependency security correction — 2026-08-10

## Baseline

- feature baseline: `ffdf1faecd98fa29240fed40c9425e2b14aea5d9`;
- version contracts remain `0.1.103`;
- Next.js remains `16.2.11`;
- ESLint remains `9.39.2`;
- no `npm audit fix --force`;
- no application-runtime or marketplace write change.

## Root cause

The July security candidate became stale before release. Current registry audit data
added patched floors for brace-expansion, PostCSS, ip-address, js-yaml, nanoid
and undici. The correction updates only those transitive lines and the explicit
PostCSS override while preserving all direct framework/tooling versions.

## Resolved versions

- `brace-expansion`: `1.1.18`, `5.0.9`;
- `postcss`: `8.5.23`;
- `ip-address`: `10.5.0`;
- `js-yaml`: `3.15.1`, `4.3.1`;
- `nanoid`: `3.3.18`;
- `undici`: `7.29.0`;

## Verification before commit

- `npm ci`: PASS;
- `npm ls --all`: PASS;
- `npm audit --audit-level=high`: PASS;
- transitive-security regression test: PASS;
- repository tooling tests: PASS;
- repository integrity: PASS;
- frontend unit/design-token tests: PASS;
- typecheck, lint, design scan, CSS syntax, build and W3C validation: PASS;
- validation workflow run: `31385692550`.

The repository Quality Gate and container jobs remain authoritative on the
materialized commit. This evidence contains no credentials or customer data.
