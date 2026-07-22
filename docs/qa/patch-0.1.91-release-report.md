# Respio 0.1.91 — public UI recovery and dependency warning verification

## Scope

0.1.91 is a controlled follow-up to 0.1.90. It keeps the dependency-warning fix and repairs public-site visual regressions reported during manual review.

## Changes

- Kept the `@lhci/cli -> chrome-launcher@1.2.0` override that removes deprecated `inflight`, `rimraf@3` and `glob@7` from the installed dependency tree.
- Made the public header opaque white with a small shadow.
- Restored a shorter Hero H1 and added desktop spacing so the copy does not crowd the Hero canvas.
- Re-applied public typography through shared variables: H1 58px, H2 48px, H3 28px and 18px lead copy.
- Reduced section heading vertical gaps between label, heading and supporting text.
- Improved pricing trial copy: no duplicated “400 ответов”, service-check wording instead of “проверка автопубликации”.
- Reworked calculator copy, reduced result-card height and kept the calculator CTA blue on a light card.
- Kept CTA buttons on dark/gradient sections white for contrast.
- Removed padding from pricing package volume labels and aligned them with price content.
- Compacted marketplace/card spacing so icons, headings and descriptions no longer create oversized empty cards.
- Redesigned the “В каждом пакете” section with a stronger left surface and denser feature rows.

## Verified gates

- npm ci
- npm ls inflight rimraf glob --all (empty tree)
- npm run test:unit
- npm run test:design-tokens
- npm run typecheck
- npm run lint
- npm run validate:css-syntax
- npm run build
- npm run validate:w3c
- npm run design:detect
- python scripts/check_integrity.py

## Not verified in this container

- Playwright visual screenshots. Chromium navigation to localhost is blocked by environment policy.
