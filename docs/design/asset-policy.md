# MPReply visual asset policy

## Production logo assets

| Surface | Primary | Fallback | Intrinsic size |
|---|---|---|---:|
| Public header and footer | `/logo/logo.avif` | `/logo/logo.webp` | 249×60 |
| Hero product-flow Canvas | `/logo/logo-canvas.avif` | `/logo/logo-canvas.webp` | 300×261 |

Both AVIF files must preserve transparency. The WebP files are mandatory fallbacks. Do not inline the files as base64, recreate the mark with CSS, add a background plate or place a second brand label beneath the Canvas logo.

## Favicon contract

The following files live directly in `apps/web/public/`:

- `favicon.svg`;
- `favicon-96x96.png`;
- `favicon.ico`;
- `apple-touch-icon.png`;
- `web-app-manifest-192x192.png`;
- `web-app-manifest-512x512.png`;
- `site.webmanifest`.

The document head must link this exact set, and `site.webmanifest` must expose `MPReply` as both `name` and `short_name`.

## Rendering requirements

- Use `<picture>` with AVIF first and WebP fallback.
- Provide intrinsic `width` and `height` to prevent layout shift.
- Preserve aspect ratio with `height: auto` and `object-fit: contain`.
- Use eager/high-priority loading only for the above-the-fold header and Canvas placements.
- Keep the wordmark near-black on light surfaces. On the dark footer, render the approved horizontal logo on a restrained light logo surface rather than recoloring the supplied bitmap.
- Decorative images use empty alt text; linked brand marks rely on an explicit accessible label.

## General assets

One coherent icon family per surface; no emoji or fake marketplace endorsements. Product screenshots must contain no secrets or personal data. Generated imagery cannot be presented as customer evidence. Every shipped file must have a real runtime consumer or a documented release purpose.
