# MPReply 0.1.93 — public hero spacing and panel recovery

## Scope

- Unifies `public-eyebrow` visual contract across public pages.
- Restores spacing between labels, H1/H2 headings and lead/subtitle copy.
- Keeps H2 at the accepted 48px public scale and H3 at 28px.
- Tightens the homepage hero grid so the text column does not collide with the product-flow canvas on compact desktop viewports.
- Reduces and standardizes right-side public hero panels, including 32px panel headings and compact list rows.
- Updates the pricing trial-card heading to a single `400 ответов ...` line without a separate oversized number.
- Repairs public trial modal sizing, removes inner dialog scroll, and rebuilds the close control.

## Non-goals

- No new backend capability.
- No visual snapshot approval.
- No global CSS consolidation beyond the targeted recovery overrides.

## Verification

- `npm run test:unit` — passed.
- `npm run test:design-tokens` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run validate:css-syntax` — passed.

`npm run build` compiled successfully but did not complete the Next.js TypeScript phase before the container timeout in this environment. Local verification remains required before visual snapshot approval.
