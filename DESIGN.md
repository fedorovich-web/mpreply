# MPReply — Design System Direction

Status: authoritative current design rules and implementation constraints.
Version: 0.1.31

## Design intent

**Operational clarity. Quiet intelligence. Marketplace confidence.**

## Current public Hero · Product Pipeline

The production Hero is Product Pipeline: buyer question + product context + seller rules -> AI processing -> verified ready answer. The ready answer is the visual endpoint. The orbital/WebGL Hero is rejected and is not a current production direction.

The scene is light-first and built from accessible DOM content plus a lightweight Canvas signal layer. Motion pauses offscreen and while the document is hidden, and reduced-motion mode renders a static state. Dark mode preserves the same hierarchy through semantic theme tokens.

## Approved public brand direction · Electric Pulse / Product Pipeline

The current public-site authority is **light-first**. The default MPReply experience is a premium light AI/B2B SaaS environment; dark mode is a first-class secondary theme exposed through the existing theme switcher, not the visual starting point for the product.

Approved master references for public art direction:
- **PitchBot AI** — overall visual maturity, softness, branded light AI environment and coherent system thinking.
- **ARIA** — light-first AI SaaS atmosphere, soft lavender environment and balance between technological credibility and visual warmth.
- **Relatra** — AI automation storytelling, workflow presentation and product-first section logic.

Explicitly excluded as master references:
- Qipeline.
- OEME / OEMA.
- AgentVoice.

These references are inputs, not templates. MPReply must retain its own product narrative, original code, Electric Pulse identity, AUTO-FIRST positioning and Product Pipeline signature visual.

Approved public palette:
- Primary violet: `#635BFF`.
- Accent cyan: `#00E5E5`.
- Main gradient family: `#5148E8` → `#00E5E5`, reserved for small/localized roles where a gradient has a specific compositional function; never use it as a default Hero/section background.
- Default page canvas: controlled near-white/light-neutral semantic backgrounds.
- Deep graphite/indigo surfaces are reserved for selected contrast sections and the secondary dark theme.
- Decorative cyan remains separate from semantic success; text/action colors use dedicated contrast-safe roles.

Approved hero behavior:
- Asymmetric two-column desktop composition: product copy first, signature Canvas second.
- Desktop H1 must wrap naturally in Russian, normally within 2–4 visual lines; the design must never force a five-to-seven-line heading through an artificially narrow copy column.
- Desktop hero CTAs remain side by side while they physically fit; stacking starts only at a justified mobile breakpoint.
- The hero background and Canvas ambient layer form one composition rather than two disconnected panels.
- The Canvas connects three explicit inputs — buyer question, product context and seller rules — through a compact processing node to one dominant ready answer.
- Motion is restrained signal flow rather than decoration; there is no 3D renderer, orbital metaphor or heavy client runtime.
- Reduced motion, off-screen pausing, page-visibility pausing, bounded DPR/FPS and mobile complexity reduction are mandatory.

Public component contract:
- One public eyebrow system; hero eyebrow is the visual master.
- Global typography roles and limits: H1 ≤ 64px, H2 ≤ 46px.
- Decorative borders are not a default styling tool. Prefer semantic background contrast, soft elevation and inset shadow; preserve real borders only for forms, tables, validation, functional separators and other justified structure.
- Buttons use stable geometry, tokenized hover/active/focus states and compact shadows that cannot overlap adjacent controls.
- Motion uses explicit property transitions; never `transition: all`.
- Custom cursor behavior is progressive enhancement for fine-pointer desktop devices only and must disappear for touch/coarse pointer or reduced motion.

Dark public theme:
- The same content architecture, typography, spacing, component geometry and Product Pipeline semantics are preserved.
- Do not create a separate cyberpunk site or simply invert colors.
- Narrow auxiliary references may inform specific dark-theme qualities only: Songo for signal/data motion, ZeroDrift for safety/trust language, and NeuraCore for restrained ambient depth.

Dashboard direction:
- Dashboard UI is operational and denser than the public site; it must not inherit Awwwards-style decorative motion, custom cursor or hero gradients.
- Primary references by function: Linear for hierarchy and information density, Vercel/Geist for semantic tokens/theme/control states, Resend for inbox/event-log simplicity, plus MPReply-specific marketplace/SafetyGate/AUTO-FIRST workflows.

MPReply should feel like a reliable operating system for marketplace communication: calm, precise, fast, accountable and visually mature. Marketing may be more expressive than the dashboard, but both belong to one family through Onest, semantic tokens, Electric Pulse accents, shared interaction timing and state logic.

## Secondary public routes · 0.1.15

The `features`, `marketplaces`, marketplace detail, `pricing`, `demo`, `resources` and `contacts` routes use the same approved public language as the homepage: Electric Pulse / Product Pipeline, customer-first Russian copy, unified typography, shared eyebrow and button contracts, primarily solid tonal surfaces and shadows instead of decorative border grids or generic gradient backgrounds.

The public site describes the target launch product. It must not display internal roadmap labels such as `MVP`, `planned`, `coming soon`, `readiness`, adapter/runtime state or other implementation-stage terminology. Current engineering truth remains documented in `PRODUCT.md` and repository code; public claims must match production reality by launch.

## Public shell polish · 0.1.16

The shared public shell adds active desktop/mobile navigation states, an accessible controlled mobile menu with Escape/backdrop close behavior, a theme toggle that announces the next action, a fuller conversion-oriented footer and disclosure-based FAQ interaction. Public copy avoids internal implementation jargon when a clear Russian term exists.

## Automated design verification · 0.1.17

The frontend test foundation now verifies critical brand/semantic design tokens, duplicate token declarations and WCAG AA contrast for the primary text/surface combinations used by the current system. These checks run alongside unit tests in both CI and the local release gate.

## Product dashboard · Live Automation Rules · 0.1.18

Automation Rules is an operational workspace, not a decorative gallery of fake rule cards. The screen loads tenant-scoped backend data, exposes explicit loading, empty, error and success states, makes the selected rule and current filter obvious, and preserves a calm dense hierarchy suitable for recurring operational work.

Authorization is visible but never treated as a frontend security boundary: owner/admin roles receive create, edit, enable and disable controls, while manager/viewer roles see a clear read-only state. SafetyGate stop/review behavior stays explicit in the editor and cannot be visually hidden to inflate automation rate. The UI uses existing semantic tokens, responsive composition and restrained motion; no page-specific color hacks or new design system are introduced.

## Public visual-system stabilization · 0.1.19

The public visual system is stabilized around shared tokens for typography, surfaces, spacing, motion, buttons, focus states and responsive behavior. Later patches may evolve art direction, but they must not create a second design system or component-local visual scales.

For the current Hero, the approved signature visual is Product Pipeline: `Вопрос покупателя`, `Контекст товара` and `Правила продавца` flow through a compact verification step to `Готовый ответ`. Reduced motion, viewport pausing and page-visibility pausing remain mandatory.

The public site is light-first. Dark mode is a semantic adaptation of the same component and token system, not a separate cyberpunk redesign.

## Two visual lanes

### Brand/marketing
Allowed: stronger typography, richer composition, editorial layouts, real product artifacts, restrained brand accents and purposeful motion.

Forbidden: generic purple-blue AI gradients, fake screenshots, meaningless blobs, endless card grids, excessive glow/glass, generic stock people as identity.

### Product/dashboard
Priorities: scanning speed, state visibility, stable controls, dense but breathable hierarchy, minimal decorative motion, obvious action semantics.

## Hierarchy

Every screen must answer: Where am I? What is happening? What needs attention? What is primary? What happens after action? Never give equal emphasis to everything.

## Typography

- Final fonts require high-quality Cyrillic and Latin.
- Do not default to Inter by reflex.
- Maximum two families without strong justification.
- Body copy: readable line-height and generally 65–75ch.
- Display letter spacing floor: `-0.04em`.
- No tiny all-caps eyebrow on every section.
- Final font approval requires Russian marketing copy, dashboard tables, forms and legal prose.

## Color

- Semantic CSS variables only.
- Verify contrast; body text generally ≥4.5:1, large text ≥3:1.
- Status colors remain semantic and distinct from brand accent.
- Color cannot be the only carrier of meaning.
- Do not use purple/cyan gradient as generic AI shorthand or cream/sand as automatic “premium” styling.

## Layout

- Use existing tokens.
- Prefer fewer stronger layout decisions over box proliferation.
- No nested cards or card-everything UI.
- Mobile is intentionally composed, not desktop simply stacked.
- Test for overflow and long Russian headings.

## Radius, borders, shadows

Radius is a system, not decoration. Cards generally stay within restrained radii; pills are for tags/controls where semantically useful. Do not combine heavy border + broad soft shadow + large radius as default.

## Icons

One coherent family per surface. No emoji. No mixed outline/fill/duotone systems without an explicit system. Marketplace trademarks are not general-purpose UI icons.

## Logo and brand assets

The approved MPReply identity uses a cobalt-to-cyan communication/reply symbol and a near-black `MPReply` wordmark. Production placement is fixed:

- header and footer use `/logo/logo.avif` with `/logo/logo.webp` fallback;
- the Hero product-flow Canvas uses `/logo/logo-canvas.avif` with `/logo/logo-canvas.webp` fallback;
- the Canvas asset already contains the `MPReply` wordmark, so no `Engine`, monogram or repeated brand label may be rendered below it;
- favicon and installable-app icons come from the root public favicon/manifest set;
- preserve intrinsic aspect ratios, transparent backgrounds and the supplied gradient; never recolor the wordmark toward blue.

The old rounded `R` tile is retired and must not return through fallback markup, CSS pseudo-elements, Canvas drawing code, screenshots or documentation.

## Motion

Use short opacity/transform transitions and purposeful state feedback. Avoid bounce/elastic easing, scroll hijacking, long intro sequences and layout-property animations when transform/opacity is sufficient. Always respect reduced motion.

## Forms and CTAs

Visible labels, recoverable errors, duplicate-submit protection, singular primary CTA where possible, specific action copy. Never promise free trial, instant integration or production support unless true.

## Homepage story

The homepage must tell a customer story, not expose internal architecture:

1. Hero: automatic replies to reviews and questions on marketplaces across simple, complex, negative and ambiguous scenarios when sufficient product/company context is available.
2. Marketplace proof: Wildberries, Ozon, Яндекс Маркет and Авито without roadmap/readiness badges.
3. Customer outcomes: less repetitive manual work, answers based on concrete context, and one operational workspace across marketplaces.
4. A concrete question-to-answer example using believable product context and no fabricated metrics.
5. One workspace for marketplace reviews and questions.
6. Complex-scenario proof: show that automation is not limited to trivial cases; optional manual approval is secondary configuration, not the primary product story.
7. Workspace capabilities with meaningful illustrations, not `01/02/03/04` placeholders.
8. Multi-model LLM section: multiple current models with clear customer-facing roles; exact versions and claims must match the selected and connected launch stack.
9. Useful FAQ based on real objections and search intent, with one-open-at-a-time stable interaction.
10. Practical resources/blog entry points.
11. Light final CTA built on a solid tonal surface, not a generic full-section gradient.

No hero proof strip with unexplained internal terms. No public `MVP`, `planned`, `readiness`, adapter/runtime status, idempotency, retry, queue or similar engineering jargon. No fabricated metrics, testimonials, customer logos, model benchmarks or superiority claims.

## Accessibility and performance

WCAG AA-oriented implementation, keyboard navigation, visible focus, semantics, labels, contrast, reduced motion, no hover-only essential info. Automated axe is necessary but insufficient. Protect LCP, CLS and INP; avoid large client bundles and unnecessary third-party scripts.

## Impeccable contract

Before substantial UI work: read `PRODUCT.md`, `DESIGN.md`, relevant docs, inspect existing tokens/components, run `npm run design:detect`, and never suppress findings silently.

## Absolute anti-pattern bans

Reject gradient text, generic glassmorphism, fake hero metrics, identical card grids, side-stripe accent cards, excessive 32px+ card rounding, decorative CSS grid backgrounds, fake logos/testimonials, uncontrolled glow, and AI-template copy.

## Product dashboard · Live AI Assistant · 0.1.20

AI Assistant is an operational three-part workspace rather than an AI marketing panel: source message context, generation controls, and the resulting draft/SafetyGate telemetry are visible together. The screen uses the existing dashboard language, semantic tokens, restrained motion and responsive composition.

Permission state is explicit without being treated as a security boundary. Owner/admin/manager roles can generate; viewer remains read-only while retaining permitted draft-history visibility. New styles must continue to use the centralized token system for colors, typography, spacing, surfaces, shadows, focus and transitions.

## Product dashboard · Live Integrations · 0.1.21

The integrations experience is an operational workspace rather than a marketplace roadmap gallery. Real account health, credential state, masked fingerprint, sync history and error count are visible together, while unsupported marketplace adapters remain visually and textually marked as unavailable.

The Wildberries management flow uses the existing dashboard design language and centralized CSS custom properties for colors, typography, spacing, radii, shadows, focus and transitions. Interactive account rows use stable transform-based hover/active motion, destructive credential revocation is explicit and confirmable, and write controls are absent for read-only memberships without treating frontend hiding as authorization.

## Test foundation recovery · 0.1.22

The visual-system contract remains unchanged. The patch restores the Vitest jsdom/setup files and baseline UI unit tests required for deterministic React Testing Library execution in CI.

## E2E locator and mock-contract recovery · 0.1.23

No visual-system change is introduced. The patch only hardens E2E semantics: Automation Rules assertions target the intended heading role, and AI Assistant test routing distinguishes draft history from draft generation.


## E2E mock-state recovery · 0.1.24

Automation Rules E2E mocks now preserve newly created rules in the subsequent list response, matching the workspace flow after React Query invalidation. The change is covered by a unit regression test and does not alter production UI or backend behavior.


## Accessibility contrast recovery · 0.1.25

- Error/danger text now uses a dedicated accessible semantic token instead of the decorative danger base color.
- Info badges use a dedicated accessible info-text token.
- Soft danger/info surfaces are opaque semantic tokens so contrast does not drift with the parent background.
- The selected Wildberries account keeps secondary metadata above WCAG AA contrast on the violet-soft active surface.
- Accessibility diagnostics for the Wildberries workspace now print selector-level failure details.


## Semantic contrast hardening · 0.1.26

A project-wide semantic-color audit found that the final `0.1.25` GitHub axe failure was caused by alpha compositing, not by the badge selector itself: `--color-success-soft` used an 8% transparent green over the selected integration account's translucent violet active surface, producing the computed `#DFE6EA` background and only `4.28:1` contrast against `#027A48`.

The audit was then expanded across all public/dashboard stylesheet status surfaces, brand-soft active states, light/dark theme overrides and representative axe flows. It exposed several latent dark-theme failures that the light-only CI path had never exercised: low-contrast kicker text, brand-primary text over translucent violet active surfaces, the dark primary-button text contract leaking into danger buttons, and a special marketplace readiness override that became invalid once success surfaces were made opaque.

The corrected contract is systemic rather than selector-specific:
- success/warning/danger/info soft status surfaces are opaque in both themes;
- brand-soft text-bearing surfaces are opaque and use a dedicated `--color-brand-text-on-soft` token;
- small kicker/caption copy has an explicit dark-theme token;
- primary-brand and danger buttons have separate text tokens;
- public success badges keep their own success text/surface pair even inside dark panels;
- active navigation/filter/process markers use the soft-surface brand text token;
- Automation Rules error copy uses the dedicated higher-contrast danger text token.

Design-token tests now verify light/dark text/surface pairs, semantic status pairs, brand-soft pairs, on-brand/on-danger button contrast, opacity invariants and CSS usage contracts. A permanent dark-theme axe suite covers representative public and authenticated product surfaces so the same class of regression cannot remain invisible until a later push.


## Historical rejected Hero directions · 0.1.28–0.1.32

Patch 0.1.28 remains a local visual-recovery candidate until the user approves rendered screenshots and required gates are verified. Historical confirmed GREEN baseline remains 0.1.26.

### Historical art direction

- Light-first public environment.
- Electric Pulse brand roles: `#635BFF` primary, `#00E5E5` accent and a controlled `#5148E8 → #00E5E5` gradient family.
- Master references: PitchBot AI, ARIA and Relatra.
- Qipeline, OEME/OEMA and AgentVoice are not master references.
- Narrow references may be used only for specific mechanisms: ZeroDrift AI (trust/safety), C-SCORE (risk visualization), Songo (signal motion), NeuraCore (ambient motion), Lernium (B2B storytelling) and Guardbase (security communication).

### Historical Hero · MPReply AI Orbital System

The rejected 0.1.28 Canvas contract was:

- one central matte soft-3D planet with the `MPReply AI` title and `AI-ответы для маркетплейсов` descriptor integrated into its equatorial band;
- exactly five clearly distinguishable semantic planets: `Вопрос покупателя`, `Товары и каталог`, `Данные о товарах`, `Контекст и правила`, `Готовый ответ`;
- exactly five distinct mathematical ellipses with different radii, eccentricities and rotations, visually interwoven around the common MPReply AI center;
- every small planet belongs to exactly one orbit and is positioned by the same ellipse equation that defines its SVG path;
- full rotations are deliberately slow and non-identical: 35–47 seconds;
- labels adapt their side around each moving planet to reduce collisions;
- no bouncing, random drift, detached planets, duplicated orbit geometry or animation of layout properties;
- `ResizeObserver`, `IntersectionObserver`, page visibility, `prefers-reduced-motion` and FPS capping are required;
- offscreen or hidden-document animation pauses completely.

### Copy and information architecture

Public copy follows this order of priorities:

1. customer usefulness and clarity;
2. SEO/search intent;
3. marketing presentation.

Do not force uniqueness. Do not copy competitors. Do not invent claims, metrics or AI filler. Use concrete, natural Russian grounded in real customer tasks and real product behavior.

The rejected Hero phrases `Автоответы по умолчанию`, `SafetyGate до отправки`, `Исключения — менеджеру`, `Повторы без дублей` must not return.

`SafetyGate` must not be the primary public automation story. Public copy should first show that MPReply automates diverse review/question scenarios. Optional manual approval may be explained later as a configurable control for selected categories, and the internal/product term may be introduced only when it adds customer value.

### LLM section

The target-launch public site includes a multi-model LLM section. The product is expected to connect the strongest models selected for Russian marketplace review/question scenarios before public launch. The site may show exact model names and versions only when they are current, intentionally selected and match the connected launch stack. No fabricated benchmark result or unsupported “best in the world” claim is allowed.

### System rules

- One non-uppercase public eyebrow contract with tokenized dot gap and eyebrow-to-heading spacing.
- H1 desktop maximum 64px; H2 desktop maximum 46px; auth titles use a smaller dedicated token.
- Desktop Hero CTAs remain in one row while they physically fit.
- Decorative borders are removed by default in favor of tonal separation, shadows and inset shadows.
- All visual roles must come from global tokens: colors, backgrounds, solid/tonal surfaces, localized gradients where justified, typography, spacing, containers, radii, shadows, controls, interaction states, motion, Canvas and theme-specific values.
- Custom cursor remains progressive enhancement for fine pointers only.
- Required visual-review widths: 1440, 1280, 1024, 768, 430, 390 and 375.
- No visual candidate is complete without relevant unit/design tests, responsive rendered review and user acceptance.


## Hero orbital depth correction · 0.1.29

Patch 0.1.29 supersedes the rejected 0.1.28 Hero implementation after the user's real browser screenshot showed three concrete defects: flat 2D-looking orbit geometry, a visually flat central sphere, and jerky planet motion/label jumps.

The corrected contract is:

- five independent 3D orbital planes around one MPReply AI core;
- the same 3D projection function drives both each SVG orbit and its moving planet, so the planet cannot drift away from its own path;
- every orbit is split into back and front depth segments around the central sphere, giving real occlusion instead of five flat ellipses painted on one layer;
- the central sphere is rendered as a layered matte 3D object with cap, curved equatorial band, lower body shading and restrained violet/cyan depth light;
- motion uses uncapped browser `requestAnimationFrame` instead of an artificial 30 FPS step;
- only active elapsed time advances the orbital state, so hiding the tab or pausing offscreen cannot produce a jump on resume;
- label placement is stable per semantic planet instead of changing sides during motion;
- full rotation periods are deliberately slow and non-identical: 52–68 seconds;
- reduced motion resolves to a static composed state;
- no Three.js, WebGL, GSAP, Rive, Spline or other heavy runtime is introduced.

This remains a local visual candidate until the user checks the real browser render. Unit/build/W3C GREEN does not replace visual acceptance.

## Native CSS 3D orbital rebuild · 0.1.30

Patch 0.1.30 superseded the visually rejected 0.1.29 Hero candidate after the user's real browser screenshot showed that projected SVG paths still read as flat 2D lines and the central object did not reproduce the accepted reference.

The 0.1.30 implementation contract was:

- orbit lines were DOM ellipses transformed as independent CSS 3D planes with `perspective`, `rotateX`, `rotateZ` and `transform-style: preserve-3d`;
- SVG orbit paths were removed from the Hero scene;
- every orbit used separate back/front halves around the MPReply AI core;
- five distinct periods were deliberately slow: 60–76 seconds per full revolution;
- no WebGL or Three.js runtime was introduced.

The user rejected the real 0.1.30 browser render because the result still read as pseudo-3D: flat orbit lines, insufficient depth, weak central volume and a composition materially different from the accepted reference.

## Historical real WebGL orbital scene · 0.1.31

Patch 0.1.31 replaces the rejected CSS-3D foundation with a real Three.js/WebGL scene. The accepted composition target remains one central matte MPReply AI planet, five semantic planets and five intertwined 3D orbits, rendered with actual camera perspective, lighting and depth-buffer occlusion.

The 0.1.31 implementation contract is:

- `three` is dynamically imported only when the Hero approaches the viewport;
- one `PerspectiveCamera` and one transparent `WebGLRenderer` render the scene;
- five independent mathematical 3D ellipses are generated from explicit radii and XYZ rotations;
- the same 3D equation drives both the `LineLoop` orbit geometry and its moving planet, preventing drift from the assigned path;
- real WebGL depth testing provides front/back occlusion among orbits, planets and the central sphere;
- the MPReply AI core uses separate upper/lower sphere geometry, a restrained equatorial light band, matte physical materials, contact shadow and limited violet/cyan depth lighting;
- five semantic planets remain `Вопрос покупателя`, `Товары и каталог`, `Данные о товарах`, `Контекст и правила`, `Готовый ответ`;
- full rotations are deliberately slow and non-identical, and only active visible time advances motion;
- animation pauses outside the viewport and while the document is hidden; reduced motion resolves to a static composition;
- adaptive DPR is capped, with a lower cap for mobile and low-memory devices;
- no GLTF, HDRI, postprocessing pipeline, particle system, physics engine, React Three Fiber or Drei runtime is added;
- all geometries, materials, textures, renderer resources and the WebGL context are disposed on unmount.

This remains a visual candidate until explicit browser review by the user. Technical GREEN gates and a standalone WebGL QA harness do not replace acceptance of the real application render.

## Historical Visual Recovery · 0.1.32 WebGL rebuild

Version `0.1.32` once superseded the rejected `0.1.27–0.1.31` Hero candidates. This section is historical and is superseded by the current Product Pipeline contract above.

The historical 0.1.32 Hero contract was:

- exact customer-facing copy: `От вопроса покупателя к готовому ответу — автоматически.`;
- one real Three.js/WebGL scene with a perspective camera and depth-buffer occlusion;
- one layered matte MPReply AI planet with a separate equatorial band, restrained violet light and contact shadow;
- exactly five independent spatial `TubeGeometry` orbits and five real semantic planet meshes;
- fixed semantic labels: `Вопрос покупателя`, `Товары и каталог`, `Данные о товарах`, `Контекст и правила`, `Готовый ответ`;
- stable label orientation and bounded projection without side-flipping jumps;
- distinct full-orbit periods within `90–130 seconds`;
- adaptive DPR cap, lazy dynamic import, offscreen/page-hidden pause, reduced-motion static mode and complete WebGL disposal;
- DOM copy and calls to action render independently of WebGL and remain usable with the static fallback;
- no SVG ellipse, `LineLoop`, CSS-3D substitute, GLTF/HDRI, postprocessing, physics, React Three Fiber or particle runtime.

The gradient brand mark and the single gradient Hero accent are intentional matches to the approved reference and carry explicit Impeccable waivers. Other visual declarations remain controlled through CSS custom properties.
