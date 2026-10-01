# MPReply UI/UX quality standard

## Hierarchy

Every viewport answers: Where am I? What matters? What action is primary? What changes next? One dominant focus, informative headings, readable secondary copy, no decorative layering of cards/borders/shadows.

## Tokens

Colors, spacing, typography, radii, shadows, z-index and motion use tokens. Hardcoded values are only for intrinsic one-off geometry where a token would reduce clarity. Repeated values become tokens.

## Typography/layout

Russian body text remains readable, long prose 65–75ch, balanced headings, display tracking not below `-0.04em`. Mobile is not desktop stacked. Test 320/390/768/1024/1280/1440 where relevant. No page overflow, nested cards or monotonous identical card grids.

## States/forms

Applicable states: default, hover, focus-visible, active, disabled, loading, success, error. Visible labels, proper autocomplete/input types, recoverable errors, preserved input after recoverable failure and duplicate-submit protection.

## Loading/empty/error

Handle initial loading, refresh, empty, filtered-empty, recoverable error, auth failure, stale conflict and partial data where relevant. Avoid generic error copy when category is known.

## Accessibility

Semantic landmarks, one meaningful h1 on public pages, keyboard operation, visible focus, 4.5:1 body contrast and 3:1 large text, accessible icon names, associated labels/errors, reduced motion, focus-managed dialogs, useful touch targets and no hover-only essentials. Axe is a floor, not proof of complete WCAG conformance.

## Motion

Motion explains state/continuity. Prefer transform/opacity; avoid bounce/elastic, width/height/top/left by reflex, scroll hijacking, universal reveals and invisible initial content that can remain hidden.

## Icons and anti-patterns

One coherent family; icons support labels. Reject generic purple/cyan gradients, gradient text, default glassmorphism, fake hero metrics, fake proof, excessive rounding, border+wide shadow everywhere, decorative grid backgrounds, numbered section markers without real sequence and three equal primary CTAs.

## Performance

Protect Core Web Vitals. Prefer server-rendered public content. Avoid large client bundles for static presentation, right-size images/fonts, avoid unnecessary motion libraries and third-party scripts.

## QA

Run unit and design-token tests, typecheck, lint, CSS syntax, build, and W3C validation. Browser work runs E2E, axe, visual regression and Lighthouse. Visual baselines are intentionally approved; never update them solely to make CI green. Subjective design heuristics do not block user-approved work.
