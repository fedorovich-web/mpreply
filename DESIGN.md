# Respio — Design System Direction

Status: authoritative design rules and pre-redesign constraints.
Version: 0.1.13

## Design intent

**Operational clarity. Quiet intelligence. Marketplace confidence.**

Respio should feel like a reliable operating system for marketplace communication: calm, precise, fast and accountable. Marketing may be more expressive than the dashboard, but both must belong to one family.

## Two visual lanes

### Brand/marketing
Allowed: stronger typography, richer composition, editorial layouts, real product artifacts, restrained brand accents and purposeful motion.

Forbidden: generic purple-blue AI gradients, fake screenshots, meaningless blobs, endless card grids, excessive glow/glass, generic stock people as identity.

### Product/dashboard
Priorities: scanning speed, state visibility, stable controls, dense but breathable hierarchy, minimal decorative motion, obvious action semantics.

## Hierarchy

Every screen must answer: Where am I? What is happening? What needs attention? What is primary? What happens after action? Never give equal emphasis to everything.

## Typography

- Final fonts require high-quality Cyrillic and Latin.
- Do not default to Inter by reflex.
- Maximum two families without strong justification.
- Body copy: readable line-height and generally 65–75ch.
- Display letter spacing floor: `-0.04em`.
- No tiny all-caps eyebrow on every section.
- Final font approval requires Russian marketing copy, dashboard tables, forms and legal prose.

## Color

- Semantic CSS variables only.
- Verify contrast; body text generally ≥4.5:1, large text ≥3:1.
- Status colors remain semantic and distinct from brand accent.
- Color cannot be the only carrier of meaning.
- Do not use purple/cyan gradient as generic AI shorthand or cream/sand as automatic “premium” styling.

## Layout

- Use existing tokens.
- Prefer fewer stronger layout decisions over box proliferation.
- No nested cards or card-everything UI.
- Mobile is intentionally composed, not desktop simply stacked.
- Test for overflow and long Russian headings.

## Radius, borders, shadows

Radius is a system, not decoration. Cards generally stay within restrained radii; pills are for tags/controls where semantically useful. Do not combine heavy border + broad soft shadow + large radius as default.

## Icons

One coherent family per surface. No emoji. No mixed outline/fill/duotone systems without an explicit system. Marketplace trademarks are not general-purpose UI icons.

## Logo and brand assets

The current `R` in a rounded square is a placeholder, not the final Respio logo. Final identity must include wordmark, symbol if justified, monochrome/light/dark versions, favicon/app exports, clearspace/minimum-size rules and editable SVG. Do not imitate marketplace identities or competitors.

## Motion

Use short opacity/transform transitions and purposeful state feedback. Avoid bounce/elastic easing, scroll hijacking, long intro sequences and layout-property animations when transform/opacity is sufficient. Always respect reduced motion.

## Forms and CTAs

Visible labels, recoverable errors, duplicate-submit protection, singular primary CTA where possible, specific action copy. Never promise free trial, instant integration or production support unless true.

## Homepage story

1. Category + outcome.
2. Product mechanism.
3. Trust/safety model.
4. Marketplace readiness truth.
5. Workflow demonstration.
6. Benefits by audience/JTBD.
7. Product evidence.
8. Automation controls.
9. Analytics/accountability.
10. Security/integration trust.
11. Useful FAQ.
12. Conversion CTA.

This is a framework, not permission to force every section onto the page.

## Accessibility and performance

WCAG AA-oriented implementation, keyboard navigation, visible focus, semantics, labels, contrast, reduced motion, no hover-only essential info. Automated axe is necessary but insufficient. Protect LCP, CLS and INP; avoid large client bundles and unnecessary third-party scripts.

## Impeccable contract

Before substantial UI work: read `PRODUCT.md`, `DESIGN.md`, relevant docs, inspect existing tokens/components, run `npm run design:detect`, and never suppress findings silently.

## Absolute anti-pattern bans

Reject gradient text, generic glassmorphism, fake hero metrics, identical card grids, side-stripe accent cards, excessive 32px+ card rounding, decorative CSS grid backgrounds, fake logos/testimonials, uncontrolled glow, and AI-template copy.
