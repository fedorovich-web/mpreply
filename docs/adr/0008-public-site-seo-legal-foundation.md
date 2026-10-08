# ADR-0008 — Public site, SEO and legal foundation

Status: accepted for Sprint 8 foundation.

## Decision

Use the existing Next.js App Router application for both the public site and SaaS dashboard, with public pages kept outside `/app` and dashboard/auth routes explicitly excluded from indexing.

## SEO implementation

- Next.js Metadata API with `metadataBase`.
- Page-level canonical URLs.
- Open Graph and Twitter metadata without referencing non-existent image assets.
- `app/robots.ts` disallowing `/app/` and `/auth/`.
- `app/sitemap.ts` containing only public routes.
- JSON-LD for `WebSite` and `SoftwareApplication` on the home page.

## Marketplace truthfulness

Wildberries, Ozon, Yandex Market and Avito are represented as supported product integrations. The backend has documentation-backed synchronization and reply contracts for the supported streams; Avito covers chats and answerable reviews. Public production claims still require matching deployment and live-account verification. The UI must not imply that a configured account has valid permissions before validation succeeds.

## Legal status

`/privacy` and `/terms` are structured drafts, not final legal documents. Production launch is blocked until operator details, infrastructure facts, retention, processors, localization, contact channels and applicable legal wording are reviewed by qualified counsel.

## Design system

New public-site styles use design tokens and CSS variables. No per-component inline color or spacing values are introduced.
