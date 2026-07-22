# MPReply 0.1.37 — WebGL Hero polish

Date: 2026-07-16
Status: build/test GREEN, local browser screenshot blocked by Chromium policy in this environment.

## Source baseline

Built from the restored visual baseline `0.1.35` / `0.1.36` state shown by the user screenshot where the central planet is visible again.

## User-facing fixes

- Reduced the central MPReply AI planet visual size by CSS instead of replacing the visual baseline.
- Cleaned the central planet PNG alpha mask to reduce the unwanted left-side haze/ghost shadow and embedded background artifacts.
- Reduced the scene container from `51rem` to `48.5rem` and slightly reduced scene height.
- Reduced WebGL root scale from `0.9` to `0.84` on desktop.
- Replaced full orbital revolution with bounded idle drift around the approved semantic positions to avoid planets and labels crossing each other.
- Added subtle mouse parallax for the orbital system.
- Tightened label offsets and typography so labels remain closer to their corresponding planets.
- Improved small planet materials: stronger clearcoat, refined glow, clearer highlight, rim pass, and larger icon sprites.
- Improved icon stroke weight in canvas-generated icon textures.
- Refined orbit tubes: slightly thinner primary line, stronger but cleaner inner light, smoother segment count, and less heavy glow.

## Gates run

```powershell
cd apps/web
npm run lint
npm run typecheck
npm run test:unit
npm run test:design-tokens
NEXT_TELEMETRY_DISABLED=1 CI=1 npm run build
npm run validate:css-syntax
npm audit --omit=dev
```

## Results

- ESLint: GREEN
- TypeScript: GREEN
- Unit tests: 29/29 GREEN
- Design contracts: 65/65 GREEN
- Production build: GREEN, 31/31 routes generated
- CSS syntax validation: GREEN
- npm audit --omit=dev: 0 vulnerabilities

## Visual QA limitation

Attempted browser QA with system Chromium against `http://127.0.0.1:3000`, but this environment blocks loopback navigation:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Therefore this patch must be treated as a visual candidate, not as final visual acceptance. The next decision should be based on the user's local browser screenshot.
