# Respio 0.1.30 — native CSS 3D Hero orbital rebuild

## Status

`0.1.30` is a local visual candidate. It supersedes the visually rejected `0.1.29` Hero implementation after the user's real browser screenshot showed that the projected SVG paths still read as flat 2D geometry and did not reproduce the accepted reference.

Historical confirmed GREEN baseline remains `0.1.26`. Neither `0.1.28`, `0.1.29` nor this `0.1.30` candidate should be treated as visually accepted until the user approves the actual browser render.

## Scope

- removed SVG ellipse/path geometry from the Hero orbit system;
- rebuilt all five orbit lines as real DOM ellipses transformed in CSS 3D with `perspective`, `rotateX`, `rotateZ` and `transform-style: preserve-3d`;
- each orbit is rendered as deterministic back/front halves around the central Respio AI core;
- the same plane parameters drive the moving planet projection, so each semantic planet remains attached to its own orbit;
- five semantic planets remain: `Вопрос покупателя`, `Товары и каталог`, `Данные о товарах`, `Контекст и правила`, `Готовый ответ`;
- labels move smoothly outward from the scene center instead of switching sides abruptly;
- full rotations are deliberately slow and non-identical: 60–76 seconds;
- animation advances only while the scene is visible, the document is visible and reduced motion is not requested;
- central Respio AI core rebuilt as a layered matte sphere with upper hemisphere, lower hemisphere, integrated curved equatorial band, `Respio AI` and `AI-ответы для маркетплейсов`;
- no WebGL, Three.js, GSAP, Rive, Spline or other heavy runtime added.

## Relevant gates actually run

| Gate | Result |
|---|---|
| Frontend unit tests | GREEN — 44/44 |
| Hero CSS-3D geometry tests | GREEN — 5/5 |
| Public visual-recovery contract | GREEN — 18/18 |
| Design-token tests | GREEN — 65/65 |
| TypeScript | GREEN |
| ESLint | GREEN |
| CSS syntax validation | GREEN |
| Production build | GREEN — 31 routes |
| W3C CSS | GREEN — 6 stylesheet sources |
| W3C HTML | GREEN — 16 rendered routes |
| Real browser visual review in assistant environment | BLOCKED — system Chromium cannot complete headless rendering in the execution environment |
| User visual acceptance | PENDING |

## Browser limitation

The assistant environment contains `/usr/bin/chromium`, but headless screenshot attempts hang because the container cannot complete Chromium startup/rendering under its restricted DBus/network namespace. Therefore no claim of pixel-perfect or visual GREEN is made from this environment.

## Integrity limitation inherited from source context archive

The supplied V2 context archive omits four tracked vendored `.tgz` files under `vendor/npm/`, so repository integrity cannot be reproduced from that archive alone. This limitation predates `0.1.30` and is not caused by the Hero implementation.

## Acceptance rule

Do not commit/push this visual patch until the user checks the real browser render and explicitly accepts the Canvas. Technical GREEN gates do not replace visual acceptance.
