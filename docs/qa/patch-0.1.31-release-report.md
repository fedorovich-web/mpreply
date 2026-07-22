# MPReply 0.1.31 — real WebGL Hero orbital scene

> Final disposition: **REJECTED / BUILD RED + VISUAL RED**. This report is retained only as attempt history. It is not a baseline and is superseded by the `0.1.32` accepted-reference rebuild.

## Status

`0.1.31` is a local visual candidate that supersedes the visually rejected `0.1.30` CSS-3D Hero implementation. Historical confirmed GREEN baseline remains `0.1.26`.

The user rejected `0.1.28`, `0.1.29` and `0.1.30` because the real browser output still read as flat/pseudo-3D and did not reproduce the accepted orbital reference. `0.1.31` therefore changes the rendering foundation instead of adding another CSS override layer.

This report does **not** claim user visual acceptance, pixel-perfect GREEN or remote CI GREEN.

## Implementation scope

- added exact dependency `three@0.185.1` and matching `@types/three@0.185.1`;
- replaced the rejected CSS/SVG pseudo-3D runtime with a real transparent `WebGLRenderer` and `PerspectiveCamera`;
- split the scene into a lazy local runtime module so the WebGL implementation is dynamically loaded only when the Hero approaches the viewport;
- defined five independent mathematical 3D ellipses for:
  - `Вопрос покупателя`;
  - `Товары и каталог`;
  - `Данные о товарах`;
  - `Контекст и правила`;
  - `Готовый ответ`;
- the same 3D equation generates both every orbit `LineLoop` and its moving planet position, preventing path drift;
- real WebGL depth testing provides front/back occlusion among orbit lines, semantic planets and the central MPReply AI object;
- central MPReply AI object uses separate upper/lower sphere geometry, matte physical materials, a conforming equatorial band, restrained violet/cyan lighting, contact shadow and a subtle halo;
- five semantic planets use real 3D sphere geometry, physical materials and generated local icon textures;
- orbit lines use depth-aware per-vertex color so front sections read more strongly while rear sections recede without a postprocessing pipeline;
- DOM overlay keeps Russian labels crisp and accessible while positions are projected from the actual WebGL scene;
- animation uses `requestAnimationFrame` with slow non-identical periods of 98–121 seconds per full revolution;
- only active visible time advances animation, preventing resume jumps after hidden/offscreen pauses;
- added a 60 Hz continuity unit contract to reject one-frame orbital jumps;
- adaptive DPR cap: up to 1.5 on normal desktop, 1.15 on mobile or low-memory devices;
- no GLTF, HDRI, postprocessing, particle system, physics engine, React Three Fiber or Drei runtime;
- all geometries, materials, textures, renderer resources and the WebGL context are disposed on unmount.

## Performance and bundle result

Production output contains the Three.js/WebGL scene as a separate dynamic chunk, referenced by the Hero client chunk through a runtime chunk loader.

Measured final production WebGL chunk:

- raw: `548,935 bytes` (`536.1 KiB`);
- gzip -9: `134,661 bytes` (`131.5 KiB`).

The WebGL chunk is not part of the initial synchronous Hero runtime path. The component first renders semantic HTML/CSS and only imports `./HeroFlowWebGL` after `IntersectionObserver` reports proximity to the viewport.

## Browser visual QA

A standalone Chromium/Playwright QA harness rendered the **same current Three.js geometry/material runtime** at the target Hero scene size. It confirmed:

- actual WebGL context initialization;
- real 3D sphere shading;
- five real 3D planet meshes;
- five intertwined mathematical 3D orbit lines;
- depth-buffer occlusion;
- central matte MPReply AI sphere and equatorial band;
- crisp DOM label overlay projected from WebGL world positions.

This is not equivalent to a full real-application screenshot. The assistant environment's Chromium policy blocks navigation to localhost with `net::ERR_BLOCKED_BY_ADMINISTRATOR`, so real-app browser visual acceptance remains `PENDING` and must be decided from the user's local browser render.

## Relevant gates actually run

| Gate | Result |
|---|---|
| TypeScript | GREEN |
| ESLint | GREEN |
| Frontend unit tests | GREEN — 45/45 |
| Hero WebGL geometry/motion tests | GREEN — 6/6 |
| Public visual-recovery contract | GREEN — 18/18 |
| Design-token tests | GREEN — 65/65 |
| CSS syntax validation | GREEN |
| Impeccable design detect | GREEN — command completed without findings/output |
| Production build | GREEN — 31/31 generated routes |
| W3C/Nu CSS | GREEN — 6 stylesheet sources |
| W3C/Nu HTML | GREEN — 16 rendered routes |
| npm production audit | GREEN — 0 vulnerabilities |
| Repository integrity | BLOCKED by four tracked vendored `.tgz` files omitted from the supplied V2 context archive; no additional integrity failures remain after generated artifacts are excluded |
| Standalone real WebGL browser render | GREEN as implementation QA only |
| Full real-app browser render in assistant environment | BLOCKED — Chromium policy rejects localhost navigation |
| User visual acceptance | PENDING |
| Remote GitHub Actions | NOT RUN — no commit/push performed |

## Integrity limitation inherited from the source context archive

The supplied V2 context archive omits four tracked vendored files:

- `vendor/npm/axe-core-playwright-4.12.1.tgz`;
- `vendor/npm/impeccable-3.2.1.tgz`;
- `vendor/npm/lhci-cli-0.15.1.tgz`;
- `vendor/npm/playwright-test-1.61.1.tgz`.

Therefore repository integrity cannot be reproduced as GREEN from this archive alone. This limitation predates `0.1.31` and is not caused by the WebGL implementation.

## Acceptance rule

Do not treat this candidate as visually accepted, commit-ready or push-ready until the user checks the real browser render. Technical GREEN gates and standalone WebGL QA do not replace explicit user visual acceptance.
