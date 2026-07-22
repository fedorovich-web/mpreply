# MPReply 0.1.32 — accepted-reference WebGL Hero rebuild

## Status

`0.1.32` is the first candidate after the rejected `0.1.27–0.1.31` sequence that has been rendered inside the real production application and is no longer VISUAL RED. Historical confirmed baseline remains `0.1.26` until the user explicitly accepts the new visual result.

No commit or push was performed.

## Implemented scope

- restored the accepted Hero headline, lead, calls to action and three trust benefits;
- rebuilt the right-side scene as a lazy Three.js/WebGL enhancement;
- added five independent spatial Catmull-Rom/`TubeGeometry` orbits with real depth-buffer occlusion;
- added five semantic physical planet meshes and one layered central MPReply AI planet;
- added stable DOM labels projected from the actual WebGL world positions;
- removed the rejected dynamic left/right label switching that caused visible jumps;
- used five distinct full-orbit periods from 101 to 127 seconds;
- capped DPR at 1.5 on standard desktop, 1.2 on low-memory devices and 1.15 on mobile;
- paused animation outside the viewport and while the document is hidden;
- supported `prefers-reduced-motion`, WebGL detection and context-loss fallback;
- disposed geometries, materials, textures, renderer lists, renderer and WebGL context;
- synchronized `three@0.185.1`, `@types/three@0.185.1`, `package.json` version `0.1.32` and lockfile;
- added focused model, lifecycle and accepted-copy regression tests;
- moved the new public Hero visual values onto CSS custom properties;
- marked only the approved logo and Hero accent gradients as intentional Impeccable exceptions.

## Real browser visual QA

The production build was opened in system Chromium through Xvfb with SwiftShader WebGL. The actual application reached `data-webgl-state="ready"`, rendered a real canvas and produced no console or page errors at:

| Viewport | Result |
|---|---|
| 1648 × 874 | GREEN/YELLOW — accepted composition, real 3D depth, no label collisions |
| 768 × 1024 | GREEN — responsive centered Hero and full orbital scene |
| 430 × 932 | GREEN — mobile copy/CTA order retained and orbital scene visible below actions |

The visual result is materially aligned with the accepted reference in composition, depth, object hierarchy and semantic placement. It is not described as pixel-perfect and still requires the user's explicit visual acceptance.

## Gates actually run

| Gate | Result |
|---|---|
| `npm ci` | GREEN |
| Unit tests | GREEN — 27/27 |
| Design-token tests | GREEN — 65/65 |
| Impeccable design detect | GREEN — no unwaived findings |
| TypeScript | GREEN |
| ESLint | GREEN |
| CSS syntax | GREEN |
| Production build | GREEN — 31/31 routes |
| W3C/Nu CSS | GREEN — 6 stylesheet sources |
| W3C/Nu HTML | GREEN — 16 rendered routes |
| npm production audit | GREEN — 0 vulnerabilities |
| Desktop/tablet/mobile production browser render | GREEN/YELLOW, WebGL ready, no console errors |
| Repository integrity script | BLOCKED by the supplied archive omitting root `.env.example` |
| Remote CI | NOT RUN |
| User visual acceptance | PENDING |

The combined `qa:web` shell command was also attempted, but the assistant execution wrapper timed out while entering its build phase. Every constituent gate was then run directly and completed GREEN as listed above.

## Source-archive limitation

The supplied context ZIP was not a complete Git checkout and contained no `.git` directory. It also omitted several current untracked files and the root `.env.example`. Therefore branch/HEAD/staged-diff verification and the repository integrity script cannot be completed from this extracted snapshot. This limitation is inherited from the supplied archive, not from the Hero implementation.

## Acceptance rule

Do not commit or push this candidate until the user reviews the real browser screenshot. If accepted, run the same gates in the user's complete repository and then package/commit only the reviewed files.
