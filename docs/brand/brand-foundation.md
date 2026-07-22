# MPReply brand foundation and identity contract

## Brand idea

MPReply is a calm operating system for marketplace communication: fast enough for automation, controlled enough for customer-facing work and transparent enough to trust.

Brand attributes: precise, calm, competent, operational and accountable. The product must not look like a playful AI toy, a marketplace clone or an unsupported “magic automation” service.

## Approved name and domain

- Product name: `MPReply`.
- Canonical domain: `https://mpreply.ru`.
- Public spelling is case-sensitive: `MPReply`, never `Mpreply`, `MP Reply` or an abbreviated monogram in body copy.

## Approved logo system

The final symbol combines a communication card/list with a right-facing reply arrow. Its gradient runs from saturated cobalt blue to cyan. The wordmark remains near-black on light surfaces; it must not be shifted toward blue.

Production assets:

- `/logo/logo.avif` — primary horizontal logo for header/footer;
- `/logo/logo.webp` — horizontal fallback;
- `/logo/logo-canvas.avif` — primary vertical Canvas logo;
- `/logo/logo-canvas.webp` — vertical Canvas fallback.

The vertical Canvas asset already includes `MPReply`. Do not add `MPReply Engine`, `Engine`, `MPReply AI`, an `R` tile or another wordmark around it.

## Placement rules

- Keep the intrinsic aspect ratio and transparent background.
- Do not crop, stretch, rotate, recolor or rebuild the supplied artwork with CSS.
- Horizontal logo: recommended rendered width `160–200px`; minimum practical width `132px`.
- Canvas logo: recommended rendered width `124–156px`; reduce only after checking wordmark legibility.
- Use empty `alt` inside a link that already has an accessible `aria-label`; otherwise use `alt="MPReply"`.
- AVIF is primary only when alpha is preserved; WebP is the mandatory fallback.

## Favicon and installable-app identity

The root public directory contains the approved favicon set: SVG, ICO, 96×96 PNG, Apple touch icon, 192×192 and 512×512 web-app icons, and `site.webmanifest`. The manifest name and short name are both `MPReply`.

## Voice

Use concrete verbs, clear outcomes, explicit limitations and native Russian. Avoid unsupported guarantees, excessive superlatives and generated filler. Product claims must remain consistent with implemented adapters, entitlement rules and safety gates.

## Governance

The approved assets are release-controlled product inputs. Any future geometry, gradient, wordmark or clear-space change requires explicit visual approval and regenerated AVIF/WebP/favicon exports together with unit, accessibility and browser regression checks.
