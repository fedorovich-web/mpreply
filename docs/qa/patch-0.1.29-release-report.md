# MPReply 0.1.29 — Hero orbital depth and motion correction

## Status

Local visual candidate. Not user-approved yet. Historical confirmed GREEN baseline remains 0.1.26.

## Why this patch exists

The user's real browser screenshot of 0.1.28 exposed a major visual mismatch against the accepted generated reference:

- orbit geometry read as flat 2D ellipses rather than an interwoven 3D system;
- the central MPReply AI planet looked visually flat;
- planets could jump after pause/resume;
- labels changed side dynamically and could visibly jump;
- all orbit lines were painted on one depth layer, so front/back occlusion around the core was absent.

## Implementation changes

### 1. One 3D projection model for both paths and planets

`HeroFlowCanvas.tsx` now defines each orbit as a true 3D orbital plane with:

- horizontal radius;
- depth radius;
- pitch;
- roll;
- independent phase;
- independent duration;
- direction;
- stable label side.

The same `getHeroOrbitPoint3D()` function drives both SVG orbit generation and moving planet coordinates.

### 2. Front/back occlusion

Each orbit is sampled and split at `z = 0` into:

- back path — rendered behind the central core;
- front path — rendered in front of the central core.

This creates actual depth ordering without WebGL/Three.js.

### 3. Motion stability

The old artificial 30 FPS cap was removed.

Animation now:

- uses native `requestAnimationFrame`;
- advances only active elapsed time;
- pauses offscreen;
- pauses when the document is hidden;
- resumes without jumping ahead;
- keeps fixed label placement for each semantic planet.

Rotation periods are 52–68 seconds.

### 4. Central sphere depth

The MPReply AI core now has:

- layered radial and directional shading;
- separate top cap;
- curved equatorial band;
- lower body shading;
- stronger volume shadows;
- restrained violet/cyan light depth.

## Relevant tests and gates actually run

| Gate | Status | Result |
|---|---|---|
| Frontend unit tests | GREEN | 43/43 |
| Hero orbital geometry tests | GREEN | 4/4 |
| Public visual recovery contract | GREEN | 18/18 |
| Design-token tests | GREEN | 65/65 |
| TypeScript | GREEN | `tsc --noEmit` |
| ESLint | GREEN | no errors |
| CSS syntax | GREEN | `csstree-validator styles` |
| Production build | GREEN | 31/31 routes |
| W3C CSS | GREEN | 6 stylesheet sources |
| W3C HTML | GREEN | 16 rendered routes |
| Browser visual review in this environment | BLOCKED | system Chromium rejects localhost with `net::ERR_BLOCKED_BY_ADMINISTRATOR` |
| User visual acceptance | PENDING | requires local browser review |

## Honest limitations

This patch is not called pixel-perfect or visually GREEN until the user checks the real browser render. The local execution environment cannot navigate Chromium to localhost, so browser screenshot verification remains blocked here.

Repository integrity from the supplied context archive remains independently blocked by the four tracked vendored `.tgz` files omitted by the source archive script; this is not caused by 0.1.29 Hero code.
