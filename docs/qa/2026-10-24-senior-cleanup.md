# Senior cleanup verification — 24 October 2026

## Scope

Follow-up to the homepage/README delivery in PR #23, merged as `292e71ddecaf6c4ea8ad6cff8ee39af8213908ab`. The audit covered API routes, services, adapters, worker entry points, models/migrations, frontend workspaces, scripts, dependency gates and deployment configuration. Protected `.handoff/` and `apps/cms/` remain outside the change.

## Confirmed defects repaired

- Serialize marketplace-account capacity evaluation and insertion under an organization row lock, including trial organizations without a paid billing period. Concurrent requests cannot both consume the last connection slot.
- Apply `assigned_to` to both message rows and pagination totals. Invalid UUIDs return 422 and organization isolation remains enforced.
- Keep integration forms scoped to the organization and marketplace. Keep AI generation operation keys scoped to the full request signature and review results/errors scoped to the draft. Delayed responses cannot unlock or label a different draft or discard another request's retry key.
- Preserve retryable session-refresh failures instead of redirecting them as expired sessions. Edit automation rules by the editor's explicit identity; removal of that rule cannot redirect a save to the next displayed rule.
- Preserve long valid `Retry-After` values in provider results. A delay exceeding the bounded inline retry budget returns control to scheduling rather than retrying early. Failed Yandex question reconciliation uses the existing retry/pause policy and cannot update last-success time.
- Ignore duplicate reply deliveries before `next_retry_at`. After preflight, refresh and validate the persisted execution owner, message, account, credential version, scopes and lease. Renew a valid lease before the write and bound external I/O by its remaining duration; uncertain timeouts retain manual-review ambiguity and cannot automatically resend.
- Use an account `FOR NO KEY UPDATE` lock for the write fence so ingestion's foreign-key key-share lock can coexist. A real PostgreSQL regression fails with the previous strict lock and succeeds with the new lock while the importing transaction remains open.
- Collect logs and tear down a partially started container test stack. The regression replaces Docker with an explicitly verified local stub; no Docker daemon is started.

## Removal and simplification

Removed two unreferenced tenant dependency/context modules, their obsolete context-only tests, the unused `OrganizationService.list_for_user` wrapper and `AIDraftErrorResponse`. Real SQL-backed role/tenant access tests replace the removed context tests. Import, route, dynamic registration, migration and integrity checks were included in the removal review.

Auth/session services now share the existing UTC normalization helper. The HTTP retry helper no longer retains the obsolete duplicate delay function.

Removed 271 ordinary comments and 36 internal docstrings across Python, TypeScript, CSS and configuration. Cleanup helpers compared normalized executable syntax before writing. Licenses, machine directives, migration metadata and public API/schema documentation remain. Style declarations, approved composition, assets and prices are unchanged. Two tests now identify the real selector/editor identity rather than depending on a removed comment or obsolete variable name. PostgreSQL test data selection is bound to the seeded actor's organization instead of an arbitrary earlier test's message.

## Local evidence

- Backend: 755 passed, 54 environment-dependent skips in the default suite; strict Pyright: zero errors; Ruff, dependency consistency, compile and Alembic-head checks passed.
- PostgreSQL 18.6: 51 passed, zero skipped across all eight workflow files; migration upgrade and ORM metadata check passed. Native cluster bound only to loopback and stopped afterward. No production database or local Docker was used.
- Frontend: 611 unit tests and 59 design-token tests passed; TypeScript, ESLint, Knip, CSS syntax and production build passed. W3C/Nu validation: 49 stylesheet sources and 64 rendered routes.
- Repository scripts: five tests passed, including partial-start teardown; integrity gate passed.
- Dependency audits: no known vulnerabilities in strict pip-audit and npm audit including development dependencies.
- Production browser checks in Brave: 120 E2E, 27 accessibility, three security and 19 Windows visual scenarios passed. Lighthouse completed all four configured routes with the existing assertions. No visual baseline was regenerated for this cleanup.

CI and deployment receipts are separate from these local results. Default-suite skips do not stand in for PostgreSQL execution. Mocked browser/provider tests do not establish a real AI generation, marketplace publication, payment or email.

## Review and delivery boundaries

An independent reviewer inspected the final changed execution fence/timeout, cooldown propagation, Yandex failure handling, capacity lock, frontend state changes and container cleanup ordering; no blocking P1/P2 finding was reported in that scope. The reviewer did not run tests or certify production outcomes.

Before Git delivery, Dokploy showed autodeploy off, healthy API `18b5df924e48`, healthy web `6cf408effa15`, and no running worker/scheduler. A read-only query inside the existing API confirmed production Alembic revision `20261001_0020`; the new branch head is `20261010_0021`. Revision 21 removes two redundant indexes and retains the unique constraints. Any migration/API rollout must use explicit service selection with `--no-deps`, never the whole stack or the Start action.

GitHub Actions paid budget remains $0. The previous run was rejected before execution by account billing/spending restrictions. Local checks are separate evidence; CI configuration and assertions are retained. Linux visual baselines for the previously restored homepage still need an actual Linux render review; Windows baselines must not be copied to certify Linux.

Worker/scheduler and paid/provider writes remain paused. No reply, paid AI generation, payment or outbound email is authorized by this verification.
