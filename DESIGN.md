# Respio — Design System Direction

Status: authoritative design rules and pre-redesign constraints.
Version: 0.1.26

## Design intent

**Operational clarity. Quiet intelligence. Marketplace confidence.**

## Approved public brand direction · Respio Signal Flow

The approved public-site direction combines a light-first editorial SaaS layout with a full-width animated ribbon canvas in the hero, visually close in motion language and composition to the Handhold reference while using original Respio code, content and brand colors. The public site must not feel empty or unfinished: keep a complete header/navigation, real product evidence, substantial page structure and a functional footer.

Approved public palette:
- Primary violet: `#6F33AB`.
- Signal mint: `#79D6B0`.
- Neutral near-white public page background: `#FBFAFC`; subtle/elevated surfaces use centralized semantic background tokens.
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

## Public visual-system stabilization · 0.1.19

The public site uses self-hosted Onest for Cyrillic and Latin with four production weights: 400, 500, 600 and 700. The optimized WOFF2 family totals 64,972 bytes, down from 114,084 bytes in the supplied source set (about 43% smaller), while retaining required Russian/English letters and product punctuation.

Reusable visual decisions are centralized in `styles/tokens.css`: brand/semantic colors, backgrounds, gradients, typography roles, font weights, line heights, letter spacing, spacing, layout dimensions, radii, borders, shadows, focus, motion durations/easings and Canvas configuration. Public component CSS must reference these variables instead of introducing local HEX/RGB/HSL colors or one-off transition timing values.

The public background system is neutral and continuous: a near-white page foundation, white surfaces and a restrained subtle violet surface token. Alternating section tones are permitted only through semantic background variables and must not create arbitrary beige/white/violet banding.

Hero motion uses a token-driven Canvas ribbon system in Respio violet/mint, with multiple restrained layers, edge fading, reduced-motion support, intersection/visibility pausing, bounded device-pixel ratio and frame-rate control. Visual parameters belong to CSS custom properties so the motion system can be tuned without hardcoded component constants.

Interactive controls share one motion/focus contract. Hover and active feedback must avoid geometry changes such as border-width/padding shifts; use tokenized transform, color and shadow transitions. Process steps remain equal in layout weight, and CTA labels are contextual rather than mechanically repeating the same primary action.

Rendered public HTML is validated route-by-route through Nu HTML Checker, while stylesheet sources are validated through Nu and CSS syntax tooling. Validator findings are fixed in source rather than silenced; current semantic corrections include valid ARIA roles, heading ownership for sections/process steps and removal of wrappers that falsely claimed independent `section`/`article` semantics.

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

## Product dashboard · Live AI Assistant · 0.1.20

AI Assistant is an operational three-part workspace rather than an AI marketing panel: source message context, generation controls, and the resulting draft/SafetyGate telemetry are visible together. The screen uses the existing dashboard language, semantic tokens, restrained motion and responsive composition.

Permission state is explicit without being treated as a security boundary. Owner/admin/manager roles can generate; viewer remains read-only while retaining permitted draft-history visibility. New styles must continue to use the centralized token system for colors, typography, spacing, surfaces, shadows, focus and transitions.

## Product dashboard · Live Integrations · 0.1.21

The integrations experience is an operational workspace rather than a marketplace roadmap gallery. Real account health, credential state, masked fingerprint, sync history and error count are visible together, while unsupported marketplace adapters remain visually and textually marked as unavailable.

The Wildberries management flow uses the existing dashboard design language and centralized CSS custom properties for colors, typography, spacing, radii, shadows, focus and transitions. Interactive account rows use stable transform-based hover/active motion, destructive credential revocation is explicit and confirmable, and write controls are absent for read-only memberships without treating frontend hiding as authorization.

## Test foundation recovery · 0.1.22

The visual-system contract remains unchanged. The patch restores the Vitest jsdom/setup files and baseline UI unit tests required for deterministic React Testing Library execution in CI.

## E2E locator and mock-contract recovery · 0.1.23

No visual-system change is introduced. The patch only hardens E2E semantics: Automation Rules assertions target the intended heading role, and AI Assistant test routing distinguishes draft history from draft generation.


## E2E mock-state recovery · 0.1.24

Automation Rules E2E mocks now preserve newly created rules in the subsequent list response, matching the workspace flow after React Query invalidation. The change is covered by a unit regression test and does not alter production UI or backend behavior.


## Accessibility contrast recovery · 0.1.25

- Error/danger text now uses a dedicated accessible semantic token instead of the decorative danger base color.
- Info badges use a dedicated accessible info-text token.
- Soft danger/info surfaces are opaque semantic tokens so contrast does not drift with the parent background.
- The selected Wildberries account keeps secondary metadata above WCAG AA contrast on the violet-soft active surface.
- Accessibility diagnostics for the Wildberries workspace now print selector-level failure details.


## Semantic contrast hardening · 0.1.26

A project-wide semantic-color audit found that the final `0.1.25` GitHub axe failure was caused by alpha compositing, not by the badge selector itself: `--color-success-soft` used an 8% transparent green over the selected integration account's translucent violet active surface, producing the computed `#DFE6EA` background and only `4.28:1` contrast against `#027A48`.

The audit was then expanded across all public/dashboard stylesheet status surfaces, brand-soft active states, light/dark theme overrides and representative axe flows. It exposed several latent dark-theme failures that the light-only CI path had never exercised: low-contrast kicker text, brand-primary text over translucent violet active surfaces, the dark primary-button text contract leaking into danger buttons, and a special marketplace readiness override that became invalid once success surfaces were made opaque.

The corrected contract is systemic rather than selector-specific:
- success/warning/danger/info soft status surfaces are opaque in both themes;
- brand-soft text-bearing surfaces are opaque and use a dedicated `--color-brand-text-on-soft` token;
- small kicker/caption copy has an explicit dark-theme token;
- primary-brand and danger buttons have separate text tokens;
- public success badges keep their own success text/surface pair even inside dark panels;
- active navigation/filter/process markers use the soft-surface brand text token;
- Automation Rules error copy uses the dedicated higher-contrast danger text token.

Design-token tests now verify light/dark text/surface pairs, semantic status pairs, brand-soft pairs, on-brand/on-danger button contrast, opacity invariants and CSS usage contracts. A permanent dark-theme axe suite covers representative public and authenticated product surfaces so the same class of regression cannot remain invisible until a later push.

