# Respio 0.1.33 — WebGL Hero visual-recovery candidate

Date: 2026-07-16

## Scope

Cumulative patch for the Respio public Hero. It can be applied without installing patch 0.1.32 first.

The patch contains:

- the accepted Hero copy and CTA structure;
- a Three.js/WebGL orbital scene with five separate 3D orbits;
- a composite central Respio AI object;
- five semantic planets and DOM labels;
- responsive desktop/mobile scene configuration;
- reduced-motion and WebGL fallback handling;
- synchronized `three` dependency, package version and lockfile;
- visual-contract tests.

## Status

This is a **visual-review candidate**, not a user-accepted final design. The included source corresponds to the latest generated `0.1.33` browser-render candidate. User-side browser verification is still required.

## Verified gates

Run from `apps/web` on the packaged source:

- `npm run typecheck` — GREEN
- `npm run lint` — GREEN
- `npm run test:unit` — 27/27 GREEN
- `npm run test:design-tokens` — 65/65 GREEN
- `npm run build` — GREEN, 31 routes generated

Environment used:

- Node.js `v22.16.0`
- npm `10.9.2`

## Installation

From the repository root on Windows PowerShell:

```powershell
Expand-Archive .\respio-0.1.33-webgl-hero-patch.zip -DestinationPath C:\Work\respio -Force
cd C:\Work\respio\apps\web
npm ci
npm run dev
```

Open `http://localhost:3000`.

For a production check:

```powershell
npm run build
npm run start
```

## Notes

- No commit or push was performed.
- The archive excludes `node_modules`, `.next`, caches, environment files and Git metadata.
- The patch is cumulative because the previous 0.1.32 patch was not accepted or installed by the user.
