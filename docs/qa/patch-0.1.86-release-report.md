# MPReply 0.1.86 Pricing/Menu Visual Rebalance Report

Patch `0.1.86` is a focused visual-quality patch after the user rejected the pricing calculator CTA/background treatment and the weak public navigation hover/background system. It does not change pricing economics, marketplace support claims, AI routing, billing behavior, visual snapshots, or backend business logic.

## Root cause

- The `/pricing` calculator summary used a saturated blue-purple card with a primary blue CTA on a similar surface, so the button visually merged into the card instead of reading as a separated conversion action.
- The pricing Hero left column carried more visual mass than the trial card, making the two-column composition feel unbalanced on large desktop screens.
- The public navigation had old flat hover blocks and generic mobile menu rows that did not match the newer product UI direction.

## Scope

- Rebalanced `/pricing` Hero typography, column mass and trial-card hierarchy.
- Redesigned the answer-pack calculator as a calmer product UI: richer controls, clearer summary hierarchy, light decision card and separated CTA shell.
- Rebuilt the public header/menu visual system with a restrained glass rail, active dot, non-blocky hover/focus interaction and redesigned mobile menu panel.
- Added 0.1.86-specific design tokens and unit contracts for pricing/menu visual recovery.
- Synchronized version contracts to `0.1.86`.

## Out of scope

- No full public CSS consolidation.
- No visual snapshot approval.
- No marketplace adapter, billing or AI routing changes.
- No new dependency.

## Required checks

Run from `apps/web`:

```bash
node -p "require('./package.json').version"
npm ci
npm run test:unit
npm run test:design-tokens
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
npm run design:detect
npm run test:visual
```

Run from the repository root:

```bash
python scripts/check_integrity.py
```

Visual snapshots must only be updated after manually approving the new pricing and navigation screenshots.
