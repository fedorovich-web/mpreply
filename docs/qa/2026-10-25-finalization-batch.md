# Consolidated engineering cleanup — 25 October 2026

## Corrected behavior

- Webhook processing retains a fixed batch eligibility cutoff but gives each event a fresh lease. Success and failure paths reload the event under its row lock and validate its token, processing state and expiry against current UTC time. Settlement timestamps and retry delays no longer reuse the start of a potentially long batch. Existing invoice checks, organization/order locks and idempotent credit settlement remain.
- Automation PATCH rejects explicit `null` for required scalar/list values before persistence. Its generated request schema also distinguishes omission from nullable values. Omitting fields, clearing nullable filters, empty lists, `false` flags and valid zero values retain their existing meanings. Names are trimmed before the existing length checks for both create and update.
- Workspace create/update requests also validate names after trimming, preventing blank or effectively one-character names from being stored.
- Five existing PostgreSQL throttle-recovery cases were absent from the CI job's explicit selection. The workflow now includes that test function without weakening any assertions or gates.

## Removal evidence

Removed `OrganizationService.add_user`, its role constant and unused constructor-level plan-limit service, and `OrganizationUserResponse`. Python AST/reference searches, organization route registration, worker entry points, dynamic lookups and repository documentation found no consumers. The application exposes no member-add route backed by this method. Membership models, role checks, trial activation and the still-used static billing period helper remain.

Billing, OAuth and webhook consumers now import the existing UTC helper from `app.core.time` directly instead of relying on its accidental export through `reply_credit_service`. No datetime conversion behavior is changed.

## Verification

- Meaningful regressions were observed failing before the corresponding fixes: 22 rule-validation cases, seven webhook cases and five workspace-name cases. These use controlled clocks, real local persistence and mocked provider HTTP.
- Complete default API suite before the final schema-only alignment: **797 passed, 54 environment-dependent skips**, with two deprecation warnings from installed FastAPI/Starlette test tooling. No warning filter or dependency override was added.
- A subsequent generated-schema regression failed before the final `SkipJsonSchema` annotation alignment; the final schema-focused run passed **30 tests** with targeted strict Pyright and Ruff. The full suite was not repeated for that schema-only delta.
- Native PostgreSQL 18.6: the existing eight-file integration selection passed **51 tests, zero skipped**. The omitted throttle-recovery function then passed its **five cases, zero skipped** on a second isolated database. Together these execute all PostgreSQL-dependent cases skipped by the default suite; the 51-test selection also includes two worker runtime tests already executable without PostgreSQL.
- Alembic upgrades and ORM metadata checks passed on the isolated databases. Both runs stopped the owned loopback-only cluster and verified port 55473 closed. No local Docker or production database was used.
- Whole-API Ruff, strict Pyright, Python compilation and Alembic-head checks passed. Frontend Knip and the repository integrity gate passed. Frontend source and visuals were not changed or retested.
- Independent source review found no blocking P1/P2 issues in the Python implementation/tests and no unjustified deletion. GitHub Actions and production deployment are separate evidence.

## Operational boundaries

Worker/scheduler remain paused. Any rollout must explicitly select API with `--no-deps`; the whole Compose stack must not be started. No paid AI generation, real marketplace reply, payment or outbound email was used for this batch. Actions paid usage remains blocked at the owner's zero-dollar budget.

Protected `.handoff/` and `apps/cms/` are preserved. Historical branches with unique work or open PR dependencies are outside automatic deletion; the batch's own branch can be removed after delivery and a verified backup.
