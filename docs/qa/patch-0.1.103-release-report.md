# MPReply 0.1.103 — complete product rebrand

## Scope

- replaces the previous public and product brand with `MPReply`;
- changes the canonical site origin to `https://mpreply.ru` and API examples to `https://api.mpreply.ru`;
- installs the user-approved favicon, AVIF and WebP logo assets;
- uses the horizontal logo in the public header, public footer and seller workspace;
- replaces the old `R`/engine tile with `logo-canvas.avif` and `logo-canvas.webp` without a duplicate text label;
- updates frontend copy, metadata, manifests, SEO, backend app identity, cookies, packages, Docker identities, deployment examples, tests and documentation;
- renames old-brand source files and public asset paths;
- removes stale generated `*.egg-info` metadata and the obsolete old canvas artwork.

## Compatibility notes

- authentication cookie names change to `mpreply_access` and `mpreply_refresh`; existing pre-rebrand browser sessions must authenticate again;
- production environment variables keep their generic names, but their domain values must be updated to `mpreply.ru` / `api.mpreply.ru` before deployment;
- pending payment reconciliation accepts the current metadata key and a single historical `*_payment_order_id` key so payments created immediately before the cutover are not lost;
- the Redis broker namespace changes with the application identity; deploy only after draining or intentionally discarding pending jobs from the previous namespace;
- database schema identifiers are unchanged because they are not customer-facing brand identifiers and renaming them would create avoidable migration risk;
- public layout and spacing remain unchanged except for the approved logo placements.

## Required gates

- backend Ruff, tests, compileall and Alembic single-head check;
- frontend unit/design-token tests, typecheck, lint, CSS validation, production build and W3C validation;
- root integrity and `git diff --check`;
- repository scan must find no previous-brand names, domains or file paths outside archived handoff evidence.
