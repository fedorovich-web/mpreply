# Respio patch 0.1.19

## Scope

Public Site Visual System Stabilization: optimized Onest typography, centralized visual tokens, unified background/gradient/motion/focus contracts, revised Canvas ribbons, CTA hierarchy cleanup, equal process-step emphasis, semantic HTML corrections, and W3C/Nu validation integrated into CI/local gates.

## Why this patch is next

The public site already had the approved Signal Flow direction, but visual implementation had drifted: oversized headings, inconsistent section backgrounds, duplicated primary CTAs, abrupt hover/active feedback and an over-emphasized SafetyGate step. This patch stabilizes the existing design system instead of starting another redesign.

## Changed

- Added self-hosted Onest WOFF2 subsets for Russian and English in weights 400, 500, 600 and 700; the four-file family is about 43% smaller than the supplied source set.
- Centralized public colors, semantic states, backgrounds, gradients, typography roles, font weights, line heights, letter spacing, spacing, dimensions, radii, shadows, focus rings, transitions/easings and Canvas parameters in CSS custom properties.
- Replaced uncontrolled beige/white/light-violet section changes with one neutral near-white page foundation and explicit semantic surface tokens.
- Reworked the hero Canvas into a token-driven violet/mint ribbon system with layered paths, soft glow, edge fading, bounded DPR/FPS, off-screen pausing and reduced-motion behavior.
- Removed duplicated primary CTA labels from the shared header/footer flow and made conversion actions contextual.
- Removed the oversized third-step treatment from the process flow; SafetyGate remains differentiated by status content rather than disproportionate card styling.
- Standardized hover, active and focus behavior around shared motion/focus variables so interaction feedback does not change component geometry.
- Added strict design-system tests for Onest files/weights/size budgets, required tokens, hardcoded visual-value prevention, Canvas contracts, equal process steps, reduced motion and contrast.
- Added Nu HTML Checker validation for 13 rendered public routes and Nu/CSS syntax validation for public stylesheet sources.
- Fixed validator-detected semantic issues instead of filtering them: invalid `aria-label` usage on generic `div` elements, missing heading ownership and non-semantic `section`/`article` wrappers.
- Added CSS/W3C validation to GitHub Quality Gate, local release gate and web-design gate, with integrity checks protecting the scripts and contracts.
- Synchronized project version to `0.1.19` across real version sources.

## Not changed

- No backend business logic, database model, migration, marketplace adapter, AI provider, SafetyGate logic or worker behavior was redesigned.
- Marketplace readiness truth is unchanged: Wildberries remains the current MVP execution path; Ozon, Yandex Market and Avito remain planned until verified and implemented.
- The public site information architecture was not restarted, and previous research/redesign stages were not repeated.

## Validation

See `docs/qa/patch-0.1.19-release-report.md` for exact commands, final pass counts and any environment-blocked checks. A validation category is reported as passed only when its command actually completed successfully on the final `0.1.19` tree.
