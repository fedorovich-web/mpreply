# MPReply 0.1.28 — Hero MPReply AI Orbital System release report

Date: 2026-07-15
Status: local visual candidate; not user-accepted yet; not committed; not pushed; remote CI not verified.
Historical confirmed GREEN baseline remains 0.1.26.

## Scope

This candidate replaces the rejected 0.1.27 orbital-core Hero implementation with the user-selected MPReply AI planetary composition:

- one central matte soft-3D `MPReply AI` planet;
- equatorial descriptor `AI-ответы для маркетплейсов`;
- five semantic planets: `Вопрос покупателя`, `Товары и каталог`, `Данные о товарах`, `Контекст и правила`, `Готовый ответ`;
- five distinct mathematically exact ellipses with unique radius/eccentricity/rotation;
- one planet per orbit, positioned from the same ellipse equation used by the visible SVG path;
- slow independent full-orbit periods from 35 to 47 seconds;
- adaptive label placement around moving planets;
- 30 FPS cap;
- transform-only planet movement;
- offscreen pause through `IntersectionObserver`;
- hidden-document pause through `visibilitychange` / `document.hidden`;
- static initial resolved composition for `prefers-reduced-motion: reduce`.

The implementation uses React + semantic DOM + SVG + CSS. No Three.js, WebGL, OGL, Spline, Rive, GSAP or other heavy runtime was added.

## CSS architecture

The new Hero implementation uses `HeroFlowCanvas.module.css` as the component-local source of truth. Legacy Hero orbital rules were removed from `styles/public-site.css`; no new override block was appended to the end of that file.

Legacy cleanup removed 79 obsolete Hero/orbit/core rules and reduced `public-site.css` from 4629 lines in the supplied archive to approximately 4134 lines before later source edits.

Obsolete Canvas tokens from the rejected implementation were removed. The focused current token contract contains:

- `--canvas-orbit-count`;
- `--canvas-fps`;
- `--canvas-orbit-stroke-width`;
- `--canvas-orbit-duration-min`;
- `--canvas-orbit-duration-max`;
- desktop/mobile core and planet size tokens.

## Version

All supplied active version sources were synchronized to `0.1.28`:

- `apps/web/package.json`;
- `apps/web/package-lock.json`;
- `apps/api/pyproject.toml`;
- `apps/api/app/core/config.py`;
- `apps/web/app/api/health/route.ts`;
- `.env.example`;
- `infra/coolify/.env.production.example`;
- `infra/docker/docker-compose.local.yml`;
- `infra/docker/docker-compose.production.yml`;
- `PRODUCT.md`;
- `scripts/check_integrity.py`.

## Verification matrix

| Gate | Status | Result |
|---|---|---|
| Frontend unit tests | GREEN | 11 files, 42 tests passed |
| Dedicated Hero geometry tests | GREEN | 3/3 passed |
| Public visual-recovery contract | GREEN | 18/18 passed |
| Design-token tests | GREEN | 65/65 passed |
| TypeScript | GREEN | `tsc --noEmit` |
| ESLint | GREEN | `eslint .` |
| CSS syntax | GREEN | `csstree-validator styles` |
| Production build | GREEN | 31/31 routes generated |
| W3C CSS | GREEN | 6 stylesheet sources, no errors |
| W3C HTML | GREEN | 16 rendered routes, no errors |
| npm audit | GREEN | 0 vulnerabilities |
| Version synchronization | GREEN | no stale `0.1.27` in required version sources |
| Legacy Hero CSS cleanup | GREEN | no old `hero-flow` / `hero-orbit` / `hero-core` selectors remain in `public-site.css` |
| Playwright browser visual QA | BLOCKED | Playwright Chromium download failed with `EAI_AGAIN cdn.playwright.dev`; system Chromium navigation was blocked by `net::ERR_BLOCKED_BY_ADMINISTRATOR` |
| Seven-width rendered screenshot review | BLOCKED | browser runtime unavailable in the execution environment |
| User visual acceptance | PENDING | candidate must be checked locally by the user |
| Remote GitHub Actions | NOT RUN | candidate is not committed or pushed |

## Integrity limitation of supplied context archive

The supplied V2 context archive does not contain four tracked vendored QA tarballs:

- `vendor/npm/axe-core-playwright-4.12.1.tgz`;
- `vendor/npm/impeccable-3.2.1.tgz`;
- `vendor/npm/lhci-cli-0.15.1.tgz`;
- `vendor/npm/playwright-test-1.61.1.tgz`.

Therefore repository integrity cannot be called GREEN from the extracted context archive. This limitation is unrelated to the 0.1.28 Hero code and was already identified during pre-flight inspection.

## Visual acceptance status

`0.1.28` remains a local candidate. Tests do not replace rendered browser review, and rendered browser review does not replace explicit user acceptance.

No commit/push commands should be issued until the user has applied the patch, inspected the real browser render at required widths and explicitly accepted the visual result.
