# Respio 0.1.36 — Hero Orbital Canvas refinement

Date: 2026-07-16
Baseline: restored 0.1.33 visual implementation carried by 0.1.35
Status: source gates GREEN; external visual acceptance required

## Scope

- Preserved the 0.1.33 central Respio AI artwork and small-planet art direction.
- Reduced the desktop Canvas footprint by removing the negative-width expansion and capping the scene at 51rem.
- Reduced the desktop WebGL root scale from 1.0 to 0.9 and recentered the scene.
- Replaced Catmull-Rom interpolation with an exact parametric 3D ellipse curve so orbit tubes follow the same mathematical path as the moving planets.
- Refined orbit tube radii and radial segments for cleaner, less heavy tracks.
- Tightened all five label offsets and assigned stable side anchors so labels remain close to their moving planets.
- Retained the restored `/public/brand/respio-ai-core-reference.png` asset.
- Added focused unit coverage for orbit closure, label anchoring, semantic orbit count and motion periods.

## Gates executed

- `npm ci --no-audit --no-fund` — GREEN
- `npm run test:unit` — GREEN, 28/28
- `npm run test:design-tokens` — GREEN, 65/65
- `npm run typecheck` — GREEN
- `npm run lint` — GREEN
- `npm run validate:css-syntax` — GREEN
- `npm run build` — GREEN, 31 routes
- `npm audit --omit=dev` — GREEN, 0 vulnerabilities

## Visual QA limitation

A production server was started successfully and responded with HTTP 200. Automated Chromium capture could not be completed because the container Chromium policy returned `ERR_BLOCKED_BY_ADMINISTRATOR` for loopback URLs. Therefore this patch is a visual-acceptance candidate, not a claimed pixel-perfect final.
