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
- Billing/payment-provider wiring is deferred until the site is running on its production domain. Preserve the existing `/app/billing` behavior and price fallback in this redesign branch; do not invent checkout/payment actions.
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

- [x] `/` homepage polish and approved-source lock.
- [x] `/features` capability architecture and product scenes.
- [x] `/marketplaces` integration overview.
- [x] `/marketplaces/wildberries`.
- [x] `/marketplaces/ozon`.
- [x] `/marketplaces/yandex-market`.
- [x] `/marketplaces/avito`.
- [x] `/pricing` product-usage/commercial explanation without invented prices.
- [x] `/demo` conversion-oriented product preview.
- [x] `/resources` editorial/blog index.
- [x] `/contacts` support/contact entry.
- [x] `/auth/*` sign-in/register visual alignment on this branch; recovery remains governed by its dedicated auth work where applicable.
- [x] onboarding entry points connected to registration and marketplace connection.
- [x] legal pages readability pass.

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

- [x] Define page-level message hierarchy: problem → product mechanism → evidence/mechanics → next action.
- [x] Normalize terminology for `обращения`, `отзывы`, `вопросы`, `сообщения`, `проверка`, `автоотправка`, `правила`, `контекст`.
- [x] Treat all four marketplace integrations as ready.
- [x] Replace generic AI slogans with product-specific mechanisms: context, brand tone, team rules, approval and automation.
- [x] Remove technical/provider jargon from seller-facing UI and marketing copy in redesigned primary surfaces.
- [x] Ensure CTA labels describe the actual next state instead of repeating one phrase everywhere.
- [x] Add useful loading/empty/error/permission copy for public auth/onboarding flows touched by this branch.

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

- [x] Map one primary search intent and supporting intent cluster to each commercial route.
- [x] Review title, description, H1/H2 structure and internal links in redesigned public routes.
- [x] Keep marketplace detail pages differentiated by actual platform workflow/value rather than templated keyword substitution.
- [x] Validate canonical/robots/sitemap contracts in the existing public SEO layer.
- [x] Keep structured data limited to supported visible facts.
- [x] Keep auth/app/admin routes outside the public index surface.

---

## Phase 5 — Dashboard UX/UI redesign

### Objective
Turn the authenticated app into a coherent high-frequency workspace using the public brand language at a denser operational scale.

### Workstreams

- [x] **Navigation/IA:** Обзор, Обращения, На проверке, ИИ-ассистент, Автоматизация, Интеграции, Аналитика, Тариф и лимиты; grouped by task without changing routes.
- [x] **Dashboard overview:** actionable queue/exception/status summary instead of marketing-style metric cards.
- [x] **Inbox:** list/detail flow; persistent filters; marketplace/type/status/assignee filtering; clear attention/approval states.
- [x] **AI answer flow:** source context → editable draft → review handoff; provider telemetry removed from default seller flow.
- [x] **Moderation:** reason → context/edit → approve/return/send workflow.
- [x] **Automation rules:** readable conditions/actions/scope/status with safe edit flows and role-aware UI.
- [x] **Integrations:** four ready platforms, account-aware CTA, connection health, sync/error states and credential actions according to RBAC.
- [x] **Analytics:** operational metrics for workload, replies, marketplaces and products without raw provider telemetry dominating the page.
- [x] **Onboarding:** first workspace creation flows directly to four ready marketplace integrations.
- [x] **Superadmin:** internal summary aligned visually with MPReply while keeping diagnostics appropriately technical.
- [x] **Bare `/app`:** redirect legacy placeholder entry to `/app/dashboard`.
- [ ] **Billing/payment provider:** intentionally deferred until the production domain is connected; no redesign in this branch.
- [x] **Empty/error/loading/permission states:** explicit across the main redesigned workspaces.
- [x] **Responsive + keyboard contracts:** scoped mobile layouts and navigation interaction coverage added; full browser verification remains pending.

---

## Phase 6 — Dashboard copy rewrite

### Objective
Replace technical or speculative interface text with seller/support-team language.

### Work

- [x] Normalize primary navigation labels to the approved product IA.
- [x] Standardize core status vocabulary and action verbs in redesigned workspaces.
- [x] Rewrite primary filters, errors, empty/read-only states and workflow guidance.
- [x] Distinguish draft/review/approved/sent/error states in user-facing workflows.
- [x] Remove implementation/provider terminology from default seller surfaces while retaining diagnostics where appropriate.
- [x] Keep destructive credential actions explicit and backend-authorized.

---

## Phase 7 — Asset generation and optimization

### Objective
Use a small set of high-quality approved-style scenes rather than many decorative fragments.

### Candidate assets

- [x] homepage hero unified inbox scene.
- [x] unified workspace scene.
- [x] marketplace/source routing scene.
- [x] AI draft + approval/send scene.
- [x] integration/onboarding composition where needed.

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

### Current blocker

GitHub Actions currently creates `frontend` and `backend` jobs but terminates them before any step is created (`steps=null`); `containers` is skipped. This is an infrastructure/runner blocker, so no code-level pass/fail claim may be made from those runs. Do not mark the gates above complete until they execute successfully on the current tree.

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
- [x] Add regression coverage for the four ready integrations and banned stale/unsupported public claims.
- [x] Align repository/product/agent source-of-truth documents with MPReply and the billing rollout boundary.
- [x] Complete the primary dashboard IA/copy cleanup across shell, overview, inbox, review queue, AI assistant, automation, integrations and analytics.
- [x] Add onboarding and superadmin alignment plus `/app` legacy redirect cleanup.
- [x] Add authenticated responsive shell coverage and browser coverage for all four integration routes.
- [ ] Execute the full static/browser/release gates once GitHub Actions runners execute steps again.
