# Sprint 13 release report — brand/design/SEO/browser QA foundation

## Scope

Sprint 13 installs the quality system required before a final public-site redesign:

- authoritative `PRODUCT.md`, `DESIGN.md` and `AGENTS.md`;
- public-site marketing/conversion brief;
- brand foundation and final-logo brief;
- SEO architecture and research rules;
- UI/UX acceptance standard and asset policy;
- Impeccable CLI and deterministic design scan;
- Playwright E2E/visual test foundation;
- axe accessibility tests;
- Lighthouse CI configuration;
- Windows bootstrap/design-gate scripts;
- GitHub Actions browser/design checks;
- exact direct npm package tarballs under `vendor/npm/`.

## Actually verified in the assembly environment

The following commands completed successfully against the Sprint 13 work tree:

```text
npm audit --audit-level=high
→ 0 vulnerabilities

npm run design:detect
→ passed, 0 findings

npm run typecheck
→ passed

npm run lint
→ passed

npx impeccable --version
→ 3.2.1

npx playwright --version
→ Version 1.61.1

npx lhci --version
→ 0.15.1
```

The initial Impeccable run found one unnecessary layout-property transition:

```css
transition: height var(--transition-normal);
```

It was removed from the analytics bar and the detector then passed.

Backend source compilation can be checked without runtime dependencies using:

```text
python -m compileall -q apps/api/app apps/api/alembic
```

The final release copy must also pass `python scripts/check_integrity.py` before archive publication.

## Environment-limited checks — not claimed as passed

### Next.js production build

`next build` compiled successfully and completed TypeScript, but the sandbox repeatedly stalled during Next.js page-data collection. This environment limitation is not reported as a pass. The normal Windows release gate still runs the exact `npm run build` command.

### Playwright browser tests

The sandbox had a system Chromium executable, but organizational browser policy blocked `localhost`/`127.0.0.1` with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore E2E and axe browser tests are not claimed as passed here.

The packaged tests remain enabled in CI, where Playwright installs its own Chromium:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:a11y
```

### Playwright browser binaries

Platform-specific Playwright browser binaries are intentionally not stored in the release ZIP. On Windows they are installed by:

```powershell
.\scripts\bootstrap-design-tooling.ps1
```

### Impeccable provider skill pack

The exact Impeccable CLI package is pinned and its official npm tarball is vendored. The provider-specific Claude/Codex skill pack is installed by the bootstrap script through `npm run impeccable:install`, because that pack is distributed separately from the npm CLI package.

### Lighthouse browser run

Not claimed in the sandbox because the browser environment was not reliable. The dedicated Windows design gate and GitHub Actions run Lighthouse CI.

### Docker runtime

Not run for this documentation/tooling sprint in the assembly environment. No database schema changes were introduced; Alembic head remains `20260710_0009`.

## Release rule

Never convert an environment-limited item into “passed” without a real successful run. Missing browser/runtime capability is not success and must remain explicitly labeled.
