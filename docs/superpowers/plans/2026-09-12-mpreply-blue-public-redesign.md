# MPReply Product Redesign — Execution Plan

> **Execution model:** implement in reviewable batches on `codex/mpreply-blue-public-redesign`. Preserve current product/backend behavior unless a task explicitly requires a backend change. Re-fetch files before every write because parallel work may be happening on the branch.

**Goal:** bring the entire public MPReply experience and authenticated workspace to one production-grade design, content and UX system based on the approved 2026-09-12 blue homepage preview.

**Product truth:** MPReply is ready. Wildberries, Ozon, Яндекс Маркет and Авито integrations are ready. The product handles reviews, buyer questions and buyer messages in a unified workflow with AI-assisted response preparation, automation and human approval where required.

**Tech stack:** Next.js App Router, React, TypeScript, CSS custom properties, existing API/backend, Playwright, axe and Lighthouse CI.

**Specification:** `docs/superpowers/specs/2026-09-12-mpreply-blue-public-redesign-design.md`

## Global constraints

- Do not regress to the superseded visual direction.
- Do not describe Ozon, Яндекс Маркет or Авито as planned/coming soon.
- Do not market AI provider/model names unless separately verified and approved.
- No fake customer proof, savings percentages, ratings or testimonials.
- No SEO keyword stuffing.
- No duplicated palette/spacing systems, one-off visual hacks, dead components or orphan assets.
- Public pages and dashboard share semantic tokens, but dashboard uses denser task-oriented layouts.
- Security, RBAC, credential storage and backend authorization remain intact.
- Completion claims require fresh verification evidence.

---

## Phase 1 — Design system and tokens

### Objective
Create one semantic visual foundation for both marketing and app UI before expanding page-specific work.

### Work

- [ ] Audit `tokens.css`, `brand-theme.css`, `globals.css`, `marketing-visual-refresh.css`, `homepage-approved.css`, auth/onboarding styles and identify duplicate ownership.
- [ ] Make `tokens.css` the primitive/semantic foundation for brand, surfaces, text, borders, states, spacing, radii, shadows and typography.
- [ ] Keep theme-specific files as semantic overrides only; remove second independent palettes.
- [ ] Introduce explicit public rhythm aliases and app density aliases instead of scattered magic numbers.
- [ ] Align primary/secondary/ghost/destructive buttons, inputs, tabs, badges, cards, panels and focus states.
- [ ] Migrate touched components to semantic tokens; do not perform a blind global CSS rewrite.
- [ ] Add/adjust design contract tests for repeated hard-coded brand values and forbidden duplicate token sources where practical.

### Exit criteria

- public and app surfaces resolve through one brand system;
- touched components no longer introduce new hard-coded repeated visual values;
- no visual change is accepted only because a snapshot was regenerated.

---

## Phase 2 — Public pages redesign

### Objective
Bring every relevant public route to the approved homepage quality while varying composition by page purpose.

### Route set

- [ ] `/` homepage polish and approved-source lock.
- [ ] `/features` capability architecture and product scenes.
- [ ] `/marketplaces` integration overview.
- [ ] `/marketplaces/wildberries`.
- [ ] `/marketplaces/ozon`.
- [ ] `/marketplaces/yandex-market`.
- [ ] `/marketplaces/avito`.
- [ ] `/pricing` plan selection and FAQ/supporting content.
- [ ] `/demo` conversion-oriented product preview.
- [ ] `/resources` editorial/blog index.
- [ ] `/contacts` support/contact entry.
- [ ] `/auth/*` sign-in/register/recovery.
- [ ] onboarding entry points connected to registration and marketplace connection.
- [ ] legal pages readability pass.

### Rules

- Do not create a public cases page until verified publishable customer material exists.
- Add a dedicated FAQ route only if it avoids duplicating the same content across pricing/help pages.
- Hero/product scenes may be raster assets; real forms and interactive product controls stay semantic HTML.
- Alternate layouts intentionally so the site does not become repeated `text + four cards` sections.

---

## Phase 3 — Public copy rewrite

### Objective
Rewrite commercial and product copy as mature Russian B2B SaaS copy grounded in actual capabilities.

### Work

- [ ] Define page-level message hierarchy: problem → product mechanism → evidence/mechanics → next action.
- [ ] Normalize terminology for `обращения`, `отзывы`, `вопросы`, `сообщения`, `проверка`, `автоотправка`, `правила`, `контекст`.
- [ ] Treat all four marketplace integrations as ready.
- [ ] Replace generic AI slogans with product-specific mechanisms: context, brand tone, team rules, approval and automation.
- [ ] Remove technical/provider jargon from seller-facing UI and marketing copy.
- [ ] Ensure CTA labels describe the actual next state instead of repeating one phrase everywhere.
- [ ] Add useful loading/empty/error/permission copy for public auth/onboarding flows.

### Content guardrails

- no invented customer counts or testimonials;
- no unsupported percentages;
- no unapproved AI model names;
- no keyword stuffing;
- no filler headings that could belong to any SaaS.

---

## Phase 4 — SEO structure

### Objective
Make public architecture indexable and commercially relevant without changing product copy into search-engine prose.

### Work

- [ ] Map one primary search intent and supporting intent cluster to each commercial route.
- [ ] Review title, description, H1/H2 structure and internal links.
- [ ] Keep marketplace detail pages differentiated by actual platform workflow/value rather than templated keyword substitution.
- [ ] Validate canonical URLs, Open Graph metadata, robots and sitemap.
- [ ] Add/verify WebSite/SoftwareApplication/Breadcrumb/FAQ structured data only when supported by visible page content.
- [ ] Prevent indexable thin/duplicate auth or internal utility pages where appropriate.

---

## Phase 5 — Dashboard UX/UI redesign

### Objective
Turn the authenticated app into a coherent high-frequency workspace using the public brand language at a denser operational scale.

### Workstreams

- [ ] **Navigation/IA:** overview, inbox, moderation, AI assistance, automation, integrations, analytics, billing/settings; reduce top-level noise.
- [ ] **Dashboard overview:** actionable queue/exception/status summary instead of marketing-style metric cards.
- [ ] **Inbox:** list/detail flow; persistent filters; marketplace/type/status/assignee filtering; clear unread/attention/approval states.
- [ ] **AI answer flow:** source context → draft → edit → approve/send; show why a draft needs review without provider jargon.
- [ ] **Moderation:** focused queue for exceptions, risk and approval-required answers.
- [ ] **Automation rules:** understandable conditions/actions/scope/status with safe enable/disable/edit flows.
- [ ] **Integrations:** four ready platforms, connection health, account/store scope, sync/error states and re-auth actions.
- [ ] **Analytics:** operational metrics that help the team decide what needs attention or automation.
- [ ] **Empty/error/loading/permission states:** designed explicitly for every core workspace.
- [ ] **Responsive + keyboard:** desktop queue efficiency first; narrow-screen fallbacks remain usable.

---

## Phase 6 — Dashboard copy rewrite

### Objective
Replace technical or speculative interface text with seller/support-team language.

### Work

- [ ] Normalize navigation labels and descriptions.
- [ ] Standardize status vocabulary and action verbs.
- [ ] Rewrite filters, tooltips, confirmation dialogs, errors and empty states.
- [ ] Distinguish `готовится`, `на проверке`, `готов к отправке`, `отправлено`, `ошибка`, `требует внимания` consistently.
- [ ] Remove implementation/provider terminology from user-facing surfaces unless it is required for diagnostics.
- [ ] Keep destructive actions explicit and reversible where the product allows it.

---

## Phase 7 — Asset generation and optimization

### Objective
Use a small set of high-quality approved-style scenes rather than many decorative fragments.

### Candidate assets

- [ ] homepage hero unified inbox scene;
- [ ] unified workspace scene;
- [ ] marketplace/source routing scene;
- [ ] AI draft + approval/send scene;
- [ ] integration/onboarding scene where needed.

### Rules

- optimized WebP; AVIF where it materially improves delivery;
- correct intrinsic dimensions and responsive `sizes`;
- meaningful alt text for informational scenes, empty alt for decorative scenes;
- no text baked into an image when that text is required for SEO/accessibility;
- remove obsolete/orphan assets after references are verified.

---

## Phase 8 — QA, regression and release readiness

### Static gates

- [ ] design/token checks.
- [ ] TypeScript typecheck.
- [ ] ESLint.
- [ ] unit/integration tests.
- [ ] production build.

### Browser gates

- [ ] public route smoke tests.
- [ ] dashboard critical-flow E2E.
- [ ] accessibility/axe.
- [ ] visual regression on approved breakpoints.
- [ ] keyboard/focus review.
- [ ] broken-link/navigation review.
- [ ] Lighthouse/performance review.

### Completion reporting

After each major implementation batch record:

1. what changed;
2. design changes;
3. copy changes;
4. UX changes;
5. remaining work;
6. exact verification executed and its result.

---

## Immediate implementation batch

- [x] Treat the approved 2026-09-12 preview as visual source of truth.
- [x] Correct the redesign specification: MPReply is ready and all four marketplace integrations are ready.
- [x] Remove the obsolete planning assumption that only Wildberries may be presented as ready.
- [ ] Add regression coverage for the four ready integrations and banned stale/unsupported public claims.
- [ ] Audit design-token ownership and start consolidation without changing the approved homepage style.
- [ ] Review the current public route set against the new copy/SEO hierarchy.
- [ ] Start dashboard IA/copy cleanup with the shell, overview and inbox before secondary settings surfaces.