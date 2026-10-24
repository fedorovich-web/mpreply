# Engineering finalization — 24 October 2026

## Scope and changes

The owner's explicit homepage instruction restores GPT-6 Luna, Claude Sonnet 5.5, Gemini 3.8 and DeepSeek V4.1 with the existing SVG assets and concise descriptions. RU and EN use one server component. The original card layout, section order, images outside this block and prices are preserved. This restoration does not certify production routing between four AI providers; the implemented backend configuration remains documented separately in the README.

The reviewed PR #22 quota change counts unresolved provider writes for their complete quota window, including expired `sending` leases and active write ambiguity awaiting manual review. New parameterized PostgreSQL coverage checks those cases plus inactive ambiguity, other reply modes and foreign organizations.

Knip identified an unreachable `ReviewEvidence` component, an unused legacy analytics schema and redundant exports. Those were removed without deleting internally used implementations. Knip is now an explicit dependency and a required local/CI check. Two source-contract exports retain precise `@public` documentation; no blanket exclusions were introduced.

Dependencies were patched without `audit fix --force`: Next/ESLint 16.4.3, Vitest 5.0.5, Zod 4.6.7, direct Sharp 0.35.5 for image tests and compatible transitive fixes. Lighthouse 13.5.0 and basic-ftp 6.2.3 overrides remove vulnerable tooling chains; the actual LHCI runner and assertions were exercised. Node's declared minimum is 22.19. Tooling security audit joins the existing production dependency audit. The web design gate reuses its preceding build for visual tests.

## Verification evidence

Local backend checks: 698 tests passed, 52 environment-dependent tests skipped in the default suite; Ruff, strict Pyright, pip consistency and strict pip-audit passed. These skips are not treated as PostgreSQL verification.

A separate disposable native PostgreSQL 18.6 instance ran all seven PostgreSQL workflow files: **49 passed, 0 skipped, 0 failed**. `alembic upgrade head` and `alembic check` passed. The cluster was stopped and its port verified closed. No Docker or production database was used.

Frontend checks: **599 unit tests and 59 design-token tests passed**; TypeScript, ESLint, Knip, CSS syntax and production build passed. Nu validation covered **49 CSS sources and 64 HTML routes**. Production browser checks use Brave with a synthetic API address and mocked account data: **120 E2E, 27 accessibility, 3 security and 19 visual scenarios passed**, including the final compatible security patch refresh. The PR checks are separate GitHub evidence, not this dated local snapshot.

LHCI exercised all four routes with unchanged thresholds. Lighthouse 13's compatibility is established by the completed run rather than assumed from package metadata. Two intermediate Windows runs failed in chrome-launcher's temporary-profile cleanup. The runner now owns a single isolated Puppeteer browser, passes its debugging port to real LHCI, awaits browser closure and removes only its own profile. The final four-route run passed. A negative configuration check returned exit 1 with zero new profile leftovers, confirming that errors propagate and cleanup occurs. Runtime dependencies and UI behavior did not change in this tooling adjustment.

Independent source reviews found no P1/P2 in the checked quota/dependency and homepage changes. A separate reviewer inspected actual desktop/mobile and 320/390/1280 captures, compared the old expected/diff and approved exactly two Windows homepage baseline replacements. The section grows by 77 px desktop and 69 px mobile; downstream composition is preserved. No other baseline or tolerance was broadly accepted. Linux baselines require their own actual render review before a green Linux visual gate.

## Git and operational boundaries

Eight obsolete origin branches and the merged local `feat/auth-email-resend` were removed after current-tip, merged-PR, tree-equivalence, open-PR and worktree checks. A verified Git bundle was saved outside the repository first. Open PR dependencies and unique historical branches remain; local `codex/0.1.104-backend` retains 12 unpushed commits. `.handoff/` and `apps/cms/` are preserved untracked.

Dokploy autodeploy is off. Worker and scheduler were stopped on 23 October after their unexpected running state was found; on 24 October only API/web were listed as running. The selected deployment command may update only `web` with `--no-deps`, never the whole stack or the Start action. Exact Dokploy v0.30.10 source and effective patched `web` were checked: no pre-deployment full `up`, no backend lifecycle hook, and no `web` dependency that starts processing. An actual deploy and its receipts must be reported separately when performed.

Actions paid usage is blocked at a zero-dollar budget. No real replies, paid AI generations, payments or outbound emails were executed for these checks. Mock success, health checks, source review and a green build do not prove external provider publication.

## References

- [Execution plan](../superpowers/plans/2026-10-24-engineering-finalization.md)
- [Quota PR #22](https://github.com/fedorovich-web/mpreply/pull/22)
- [Dokploy custom Compose command semantics](https://docs.dokploy.com/docs/core/docker-compose)
- [Docker Compose service selection and `--no-deps`](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Next.js security advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
- [Zod security advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
