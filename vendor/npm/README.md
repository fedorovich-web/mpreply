# Vendored frontend QA tooling tarballs

Official direct npm package tarballs used by Sprint 13:
- `playwright-test-1.61.1.tgz`
- `axe-core-playwright-4.12.1.tgz`
- `lhci-cli-0.15.1.tgz`

Purpose: exact-version traceability, offline inspection and forensic comparison. `package.json` intentionally uses exact registry versions instead of `file:` paths because the web Docker image builds with `apps/web` as its context.

Playwright browser binaries are platform-specific and not included. Install Chromium with `npx playwright install chromium` or the root bootstrap script. Do not update tarballs without synchronizing package versions, lockfile, integrity checks and this README.
