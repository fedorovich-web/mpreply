# Respio Agent Instructions

These rules apply to AI coding agents and automated contributors.

## Mandatory context before UI/copy changes

Read in order:
1. `PRODUCT.md`
2. `DESIGN.md`
3. `docs/product/public-site-master-brief.md` for public work
4. `docs/seo/public-site-seo-spec.md` for SEO pages
5. `docs/design/ui-ux-quality-standard.md`
6. Existing tokens/components before adding visual values

## Product truth

Respio is auto-first; manual review is optional. Wildberries is current MVP execution path. Never claim Ozon, Yandex Market or Avito production sending until verified and implemented. Never fabricate customers, logos, testimonials, metrics, prices or capabilities.

## UI rules

Use CSS variables/tokens. Do not mix icon systems. No emoji as production icons. Avoid generic purple/cyan AI gradients, glassmorphism, nested cards, excessive pills, broad glows and decorative motion. Performance/accessibility outrank decoration. Respect reduced motion.

## Required checks

From `apps/web`:
```bash
npm run typecheck
npm run lint
npm run build
```

Browser QA:
```bash
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

Visual snapshots are not a substitute for review. Never regenerate them only to silence a failure.

## Change discipline

Never claim a pass unless actually run. Distinguish static checks from browser/runtime checks. Do not weaken tests silently. Do not add dependencies without purpose/maintenance impact. Never use `npm audit fix --force` as default remediation. Bump versions synchronously for every release/patch.
