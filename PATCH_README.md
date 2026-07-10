# Respio Sprint 8 patch — public site, SEO and legal foundation

Apply this archive over a clean `develop` branch that already contains Sprint 7 and the repair fixes completed during verification.

## Included

- Public site routes: `/`, `/features`, `/marketplaces`, four marketplace pages, `/pricing`, `/demo`, `/resources`, `/contacts`, `/privacy`, `/terms`.
- Next.js Metadata API, canonical URLs, Open Graph, Twitter metadata.
- `robots.ts`, `sitemap.ts`, JSON-LD.
- Dashboard noindex metadata.
- Structured legal drafts with explicit pre-production legal-review gate.
- Public design system styles using CSS variables/tokens.
- `scripts/check_integrity.py`.
- `scripts/release-gate.ps1`.
- GitHub Actions quality gate.
- Version `0.1.8` synchronized across backend, frontend and env example.
- Clean `package-lock.json` without internal CAAS/OpenAI registry URLs.

## Local verification

From repository root on Windows PowerShell:

```powershell
.\scripts\release-gate.ps1
```

Or run the checks manually as documented in `docs/qa/sprint-8-release-gate.md`.
