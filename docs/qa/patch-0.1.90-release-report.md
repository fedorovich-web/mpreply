# Respio 0.1.90 — dependency warning audit and public pricing UI recovery

## Scope

0.1.90 is a controlled follow-up to 0.1.89. It addresses two verified areas:

1. npm install deprecation warnings caused by the Lighthouse CI dependency chain.
2. Public-site visual/copy regressions reported on pricing, navigation, hero spacing, card rhythm and calculator sections.

No marketplace backend integration, billing entitlement model, AI provider routing or visual snapshot baseline was approved in this patch.

## Dependency audit

The deprecated packages were not direct Respio dependencies.

Resolved chain before the patch:

- `@lhci/cli@0.15.1`
- `chrome-launcher@0.13.4`
- `rimraf@3.0.2`
- `glob@7.2.3`
- `inflight@1.0.6`

Patch action:

- Kept `@lhci/cli` stable.
- Added a scoped override so LHCI uses `chrome-launcher@1.2.0`.
- Confirmed `inflight`, `rimraf` and `glob` are no longer present in the installed dependency tree.
- Confirmed `npm ci` finishes without the previous deprecation warnings.

## Public UI/copy fixes

- Kept navigation without a visible background capsule or border around the menu rail.
- Fixed active/hover underline so it is bound to the link label and reaches the text width.
- Preserved direct menu links to `/features`, `/marketplaces`, `/pricing`, `/blog`, `/about`.
- Rebalanced hero spacing to reduce H1-to-canvas collision risk on desktop and compact desktop widths.
- Enforced the public typography scale through shared CSS variables:
  - H1: 58px desktop cap.
  - H2: 48px desktop cap.
  - H3: 28px desktop cap.
  - lead/subtitle: 18px.
- Removed padding from `.pricing-pack-card__volume` in the v90 pricing card contract.
- Left-aligned pricing package volume with price content.
- Reduced oversized `400 ответов` typography in the pricing trial card.
- Reworked pricing trial/feature pills to avoid crooked heavy green elements.
- Reworked pricing calculator copy and layout for answer-pack/autopublication positioning.
- Removed the blue progress bar treatment from pricing range controls.
- Rebalanced calculator result card height and CTA contrast.
- Reworked the included-package section spacing so cards are less wireframe-like and less vertically inflated.
- Replaced weak copy such as "нормальные ответы" with SEO/product copy around automatic answers, reviews, questions, chats, seller rules and optional approval.

## Build stability

Next build was using 34 workers in this container and repeatedly stalled during static page generation. The patch sets `experimental.cpus: 4` in `next.config.ts`, which keeps Turbopack rooted at `apps/web` and makes static generation deterministic in constrained CI/container environments.

## Verified gates

- `npm ci`
- `npm run test:unit`
- `npm run test:design-tokens`
- `npm run typecheck`
- `npm run lint`
- `npm run validate:css-syntax`
- `npm run build`
- `npm run validate:w3c`
- `npm run design:detect`
- API `pip check`
- API `ruff`
- API `pytest`
- `python scripts/check_integrity.py`

## Not done

- Visual snapshots were not updated.
- Browser visual acceptance remains manual because the user needs to approve the actual Windows/Chromium screenshots.
- E2E/a11y/visual/Lighthouse should be run after manual visual acceptance.
