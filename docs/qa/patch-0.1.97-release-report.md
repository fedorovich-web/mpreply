# MPReply 0.1.97 — Hero canvas recovery

## Scope

- Restores the desktop home Hero product-flow canvas position after 0.1.96.
- Adds a separate `hero-canvas-recovery.css` file imported after `public-site.css`.
- Intentionally does not change public heading spacing, typography rhythm, eyebrow styling, or popup copy/layout.

## Verification focus

- Home Hero at 1500/1440/1366/1280 widths.
- Canvas must remain visible inside the right column and not drift outside the viewport.
- Existing manual heading-spacing adjustments are preserved because `public-site.css` is not replaced by this patch payload.
