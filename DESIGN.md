# Respio — Design System Direction

Status: authoritative design rules and pre-redesign constraints.
Version: 0.1.18

## Design intent

**Operational clarity. Quiet intelligence. Marketplace confidence.**

## Approved public brand direction · Respio Signal Flow

The approved public-site direction combines a light-first editorial SaaS layout with a full-width animated ribbon canvas in the hero, visually close in motion language and composition to the Handhold reference while using original Respio code, content and brand colors. The public site must not feel empty or unfinished: keep a complete header/navigation, real product evidence, substantial page structure and a functional footer.

Approved public palette:
- Primary violet: `#6F33AB`.
- Signal mint: `#79D6B0`.
- Warm light canvas: `#F7F5F2`.
- Deep violet is secondary for selected contrast surfaces and optional dark theme, not the default page background.
- Status colors remain semantic and separate from the mint brand accent.

Approved hero behavior:
- Large centered headline and supporting copy.
- Full-width organic animated canvas/ribbon below the copy.
- Primary CTA: `Подключить маркетплейс`, not a single-marketplace CTA.
- Complete desktop navigation and accessible mobile menu.
- Light theme is the default; optional theme switch is allowed.
- Respect reduced motion and pause canvas animation when off-screen or the page is hidden.

Respio should feel like a reliable operating system for marketplace communication: calm, precise, fast and accountable. Marketing may be more expressive than the dashboard, but both must belong to one family.

## Secondary public routes · 0.1.15

The `features`, `marketplaces`, marketplace detail, `pricing`, `demo`, `resources` and `contacts` routes use the same Signal Flow language as the homepage: editorial hierarchy, restrained violet/mint accents, explicit operational states, fewer card grids and more structured rows/lists. Planned marketplace pages must visually separate roadmap status from an implemented integration and must not use a production-ready headline.

## Public shell polish · 0.1.16

The shared public shell adds active desktop/mobile navigation states, an accessible controlled mobile menu with Escape/backdrop close behavior, a theme toggle that announces the next action, a fuller conversion-oriented footer and disclosure-based FAQ interaction. Public copy avoids internal implementation jargon when a clear Russian term exists.

## Automated design verification · 0.1.17

The frontend test foundation now verifies critical brand/semantic design tokens, duplicate token declarations and WCAG AA contrast for the primary text/surface combinations used by the current system. These checks run alongside unit tests in both CI and the local release gate.

## Product dashboard · Live Automation Rules · 0.1.18

Automation Rules is an operational workspace, not a decorative gallery of fake rule cards. The screen loads tenant-scoped backend data, exposes explicit loading, empty, error and success states, makes the selected rule and current filter obvious, and preserves a calm dense hierarchy suitable for recurring operational work.

Authorization is visible but never treated as a frontend security boundary: owner/admin roles receive create, edit, enable and disable controls, while manager/viewer roles see a clear read-only state. SafetyGate stop/review behavior stays explicit in the editor and cannot be visually hidden to inflate automation rate. The UI uses existing semantic tokens, responsive composition and restrained motion; no page-specific color hacks or new design system are introduced.

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
