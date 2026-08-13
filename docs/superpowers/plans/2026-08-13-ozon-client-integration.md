# Ozon Client Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the implemented Ozon review/question adapter as a secure, observable and role-aware customer integration screen.

**Architecture:** Extract the existing Yandex review/question account workspace into a typed provider-configured component, retain Yandex as a thin wrapper, and add an Ozon wrapper plus route. Reuse the current account API, overview schema, query invalidation, CSS tokens and browser fixtures.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, TanStack Query 5, Zod 4, Vitest, Testing Library, Playwright, axe.

## Global Constraints

- No live marketplace API call, credential, provider write or production-ready claim.
- No backend, migration, dependency, version, theme or design-token change.
- Raw Client ID and API key never render after submission or enter logs, snapshots or errors.
- Owner/admin may mutate; manager/viewer remain read-only.
- Use one RED and one GREEN command per logical task; do not repeat unchanged suites.
- Preserve the existing Yandex Market behavior and visual baseline.

---

### Task 1: Ozon availability and creation contract

**Files:**
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify: `apps/web/components/integrations/IntegrationsWorkspace.tsx`
- Create: `apps/web/components/integrations/ReviewQuestionIntegrationWorkspace.tsx`
- Modify: `apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx`
- Create: `apps/web/components/integrations/OzonIntegrationWorkspace.tsx`
- Create: `apps/web/app/app/integrations/ozon/page.tsx`

**Interfaces:**
- Produces: `ReviewQuestionIntegrationConfig` and `ReviewQuestionIntegrationWorkspace({ config })`.
- Produces: `/app/integrations/ozon` and exact create payload `{ organization_id, marketplace: "ozon", display_name, seller_id, credentials, default_response_mode }`.

- [ ] Add unit assertions that Ozon is available at `/app/integrations/ozon`, creation requires Client ID and API key, submitted secrets match the exact request once, and viewer roles see no mutation controls.
- [ ] Run `npx vitest run tests/unit/integrations-workspace.test.tsx --maxWorkers=1` once and confirm failures are caused by the absent Ozon route/component and unavailable catalog state.
- [ ] Extract the Yandex implementation into a provider-configured component without changing its public wrapper or customer behavior.
- [ ] Add the Ozon configuration, route and catalog entry; clear credential state after success.
- [ ] Run the same unit module once and obtain GREEN.
- [ ] Run touched ESLint/typecheck only after the grouped GREEN.

### Task 2: Ozon health, permissions and safe lifecycle

**Files:**
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify: `apps/web/components/integrations/ReviewQuestionIntegrationWorkspace.tsx`
- Modify: `apps/web/components/integrations/OzonIntegrationWorkspace.tsx`

**Interfaces:**
- Consumes: `MarketplaceAccountOverview` and `scopes_json`.
- Produces: deduplicated customer scope labels, expiry display, Client ID replacement, validation, sync, API-key rotation and revocation.

- [ ] Add a RED unit case with Ozon review-only scopes, `expires_at`, failed sync history and synthetic secret markers; assert correct labels, expiry, retry action and zero secret rendering.
- [ ] Add a RED mutation case proving a Client ID replacement sends `seller_id`, while API-key rotation sends only `{ credentials }`.
- [ ] Run the focused Ozon test selection once and confirm the missing labels/actions cause the failure.
- [ ] Implement provider-specific scope grouping, metadata fields and safe error copy through configuration callbacks.
- [ ] Run the integration unit module once and obtain GREEN for Ozon and unchanged Yandex behavior.

### Task 3: Browser, accessibility and visual contracts

**Files:**
- Modify: `apps/web/e2e/helpers/client-workspace-api.ts`
- Modify: `apps/web/e2e/client-workspace.spec.ts`
- Modify: `apps/web/e2e/client-workspace-accessibility.spec.ts`
- Modify: `apps/web/e2e/client-workspace-visual.spec.ts`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/ozon-integration-desktop-chromium-win32.png`

**Interfaces:**
- Produces: mocked Ozon account/overview responses with no provider traffic.

- [ ] Extend the local browser fixture with schema-valid Ozon account and overview endpoints.
- [ ] Add a Chromium test that opens Ozon, verifies permissions/health, and confirms the page does not overflow at desktop and mobile widths.
- [ ] Add Ozon to the workspace axe route set and add a desktop visual baseline.
- [ ] Run only the new Ozon E2E, accessibility and visual cases once; update only the new missing snapshot.
- [ ] Inspect the rendered PNG manually for hierarchy, clipping, secret exposure and consistency with the client workspace.

### Task 4: Final frontend verification and delivery

**Files:**
- Verify only the intended Ozon/shared frontend files and docs.

**Interfaces:**
- Produces: one current-SHA frontend gate and PR update.

- [ ] Run `npm run qa:web` once from `apps/web`.
- [ ] Run `npm run test:e2e`, `npm run test:a11y`, `npm run test:visual` and `npm run lighthouse` once each.
- [ ] Run `git diff --check`, inspect the exact diff, scan added source for visible/internal comments and confirm no credential strings or unrelated files.
- [ ] Commit only intended files with `feat(ozon): add client integration workspace`.
- [ ] Push `codex/0.1.104-backend` and observe one current-SHA GitHub Quality Gate without merging or deploying.
