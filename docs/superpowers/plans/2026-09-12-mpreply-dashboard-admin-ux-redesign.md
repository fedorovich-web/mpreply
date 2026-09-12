# MPReply Dashboard and Admin UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the authenticated MPReply workspace and internal admin screens so they match the approved visual system and are materially easier to understand, scan and operate.

**Architecture:** Keep existing backend contracts/RBAC as the source of truth. Rework presentation around seller jobs and operational states: triage, context, reply, review, automation, integrations, analytics and limits. Shared dashboard primitives provide list/detail layouts, filters, state banners, empty/error/read-only patterns and confirmation/action hierarchy; technical diagnostics stay behind explicit admin/details surfaces.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, CSS custom properties, Vitest/Testing Library, Playwright, axe.

**Spec:** `docs/superpowers/specs/2026-09-12-mpreply-full-product-redesign-copy-seo-design.md`

**UX addendum:** `docs/superpowers/specs/2026-09-12-mpreply-dashboard-ux-addendum.md`

**Shared-system prerequisite:** `docs/superpowers/plans/2026-09-12-mpreply-shared-design-system-and-governance.md`

## Global Constraints

- Same MPReply brand as the approved homepage, but denser and calmer.
- Start from the user's task, not backend entities.
- One dominant next action per selected workflow state where applicable.
- Explain status meaning, consequence and next action.
- Keep context next to the action.
- Use progressive disclosure for diagnostics/telemetry.
- Never expose marketplace credentials/secrets.
- Reflect RBAC before action while backend remains authoritative.
- Every data-driven screen defines loading, empty, filter-empty, error and read-only states.
- Do not weaken API/security behavior while changing UX/copy.

---

### Task 1: Define dashboard UX/copy regression contracts

**Files:**
- Modify: `apps/web/tests/unit/dashboard-copy-contract.test.ts`
- Create: `apps/web/tests/unit/dashboard-ux-contract.test.ts`
- Modify relevant workspace tests under: `apps/web/tests/unit/*workspace*.test.tsx`

**Interfaces:**
- Produces: bans on developer jargon and required user-facing state/action labels.

- [ ] **Step 1: Add banned primary-UX terminology assertions**

Reject visible default-view strings such as:
`Review Queue`, `SafetyGate`, `worker`, `pipeline`, `revision`, `provider`, `prompt version`, `tokens`, `latency`, raw API routes and raw enum labels where no diagnostic context exists.

- [ ] **Step 2: Add required state coverage assertions**

For each workspace, test at least loading, empty, recoverable error and read-only/permission behavior where supported.

- [ ] **Step 3: Add primary-action expectations**

Examples:
- unconnected integration → `Подключить <marketplace>`;
- connected integration → `Управлять <marketplace>`;
- review item → clear approve/send action;
- automation read-only role → controls unavailable before mutation.

- [ ] **Step 4: Run unit suite and confirm RED**

Run: `cd apps/web && npm run test:unit`

- [ ] **Step 5: Commit RED contracts**

```bash
git add apps/web/tests/unit
 git commit -m "test(web): define dashboard UX contracts"
```

### Task 2: Rework AppShell information architecture and responsive navigation

**Files:**
- Modify: `apps/web/components/app-shell/AppShell.tsx`
- Modify: dashboard/app styles in `apps/web/styles/*`
- Test: relevant AppShell/unit/E2E tests.

**Interfaces:**
- Produces: navigation `Обзор`, `Обращения`, `На проверке`, `ИИ-ассистент`, `Автоматизация`, `Интеграции`, `Аналитика`, `Тариф и лимиты`, plus admin for superadmin.

- [ ] **Step 1: Verify labels/descriptions and remove nonfunctional upcoming clutter from primary scan path**
- [ ] **Step 2: Make active state, organization selector and account/logout hierarchy clear**
- [ ] **Step 3: Ensure mobile menu closes on navigation and keeps primary workspace identity visible**
- [ ] **Step 4: Verify keyboard/focus behavior**
- [ ] **Step 5: Commit**

### Task 3: Redesign `/app/dashboard` around attention and workload

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/components/dashboard/DashboardMetrics.tsx`
- Modify styles/tests.

**Interfaces:**
- Produces: attention-first overview instead of decorative metric grid.

- [ ] **Step 1: Write tests for priority ordering**

Require attention/review/problems before secondary usage metrics.

- [ ] **Step 2: Implement sections**

Order:
1. `Требуют внимания`;
2. current incoming workload;
3. connection/processing problems;
4. automation outcome summary;
5. plan/usage only when useful.

- [ ] **Step 3: Give each problem card a clear next action**
- [ ] **Step 4: Verify empty/error/loading states**
- [ ] **Step 5: Commit**

### Task 4: Redesign `/app/inbox` as the primary triage workspace

**Files:**
- Modify: `apps/web/app/app/inbox/page.tsx`
- Modify: `apps/web/components/inbox/InboxWorkspace.tsx`
- Split into focused child components only if current file becomes unmanageable.
- Modify unit/E2E/a11y tests.

**Interfaces:**
- Produces: desktop triage list + selected context/reply workflow; intentional mobile drill-down.

- [ ] **Step 1: Define filter model in seller language**

Marketplace, type, status, rating where relevant, product/account where supported, search.

- [ ] **Step 2: Keep selected message context beside reply action**

Show marketplace, type/rating, product/account, customer text, current state and relevant context.

- [ ] **Step 3: Implement explicit list states**

Loading, no accounts, empty inbox, filter-empty, recoverable error.

- [ ] **Step 4: Make primary action state-aware**

Prepare/edit/send/retry according to real message state; avoid multiple equal CTA buttons.

- [ ] **Step 5: Compose mobile flow intentionally**

List → item detail → reply action, with clear back navigation rather than squeezed multi-column layout.

- [ ] **Step 6: Verify E2E/a11y and commit**

### Task 5: Redesign `/app/review-queue` around reason → edit → decision

**Files:**
- Modify: `apps/web/app/app/review-queue/page.tsx`
- Modify: `apps/web/components/review-queue/ReviewQueueWorkspace.tsx`
- Modify tests.

**Interfaces:**
- Produces: human-readable reason for review, current draft/context, edit and clear decision actions.

- [ ] **Step 1: Test that every review item exposes a human-readable reason**
- [ ] **Step 2: Replace raw internal state names with user outcomes**
- [ ] **Step 3: Distinguish `Одобрить и отправить` from `Вернуть на доработку` visually and semantically**
- [ ] **Step 4: Preserve revision/history internally but surface only useful history**
- [ ] **Step 5: Verify role restrictions before mutation**
- [ ] **Step 6: Commit**

### Task 6: Redesign `/app/ai-assistant` as reply preparation, not telemetry console

**Files:**
- Modify: `apps/web/app/app/ai-assistant/page.tsx`
- Modify: `apps/web/components/ai-assistant/AIAssistantWorkspace.tsx`
- Modify: `apps/web/tests/unit/ai-assistant-workspace.test.tsx`
- Modify: `apps/web/e2e/ai-assistant.spec.ts`

**Interfaces:**
- Produces: source/context, supported answer settings, generated draft, caution reason and edit/regenerate/approve actions.

- [ ] **Step 1: Keep provider/model/token/latency out of default view**
- [ ] **Step 2: Place source message and useful product/context facts above generation controls**
- [ ] **Step 3: Use clear state labels: preparing, ready, needs review, failed**
- [ ] **Step 4: Make regenerate/edit/approve hierarchy unambiguous**
- [ ] **Step 5: Preserve diagnostics only in explicit internal/admin details if needed**
- [ ] **Step 6: Verify behavior payloads remain unchanged**
- [ ] **Step 7: Commit**

### Task 7: Redesign `/app/automation-rules` into readable seller logic

**Files:**
- Modify: `apps/web/app/app/automation-rules/page.tsx`
- Modify: `apps/web/components/automation-rules/AutomationRulesWorkspace.tsx`
- Modify E2E/a11y/unit tests.

**Interfaces:**
- Produces: rule builder/list that reads as conditions → outcome, with priority and enabled state clear.

- [ ] **Step 1: Map backend conditions/enums to seller-language labels**
- [ ] **Step 2: Render compact natural-language rule summary**

Example shape: `Если оценка 4–5 и нет стоп-слов → ответить автоматически` using only actually supported conditions.

- [ ] **Step 3: Make enabled/disabled and priority/order obvious**
- [ ] **Step 4: Show read-only state before mutation for manager/viewer roles as applicable**
- [ ] **Step 5: Add clear create/edit/save/cancel feedback**
- [ ] **Step 6: Verify E2E and commit**

### Task 8: Redesign `/app/integrations` and provider detail flows

**Files:**
- Modify: `apps/web/app/app/integrations/page.tsx`
- Modify: `apps/web/components/integrations/IntegrationsWorkspace.tsx`
- Modify marketplace detail screens supplied by the backend branch during integration.
- Modify: `apps/web/tests/unit/integration-action-state.test.tsx`
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify integration E2E/a11y tests.

**Interfaces:**
- Produces: all-four marketplace overview with account-aware CTA and actionable health/error states.

- [ ] **Step 1: Preserve generic account-aware CTA logic**

No account → `Подключить <marketplace>`; existing account → `Управлять <marketplace>`.

- [ ] **Step 2: Make card state understandable**

Show connected account count/identity safely, current health/sync state and whether user action is needed.

- [ ] **Step 3: Redesign detail pages around connect/manage/reconnect/revoke tasks**

Secrets are write-only and never rendered back.

- [ ] **Step 4: Normalize provider errors to actionable Russian copy**
- [ ] **Step 5: Keep technical event/raw provider details behind explicit diagnostics/admin surfaces**
- [ ] **Step 6: Verify RBAC and no credential leakage**
- [ ] **Step 7: Commit**

### Task 9: Redesign `/app/analytics` around seller questions

**Files:**
- Modify: `apps/web/app/app/analytics/page.tsx`
- Modify: `apps/web/components/analytics/AnalyticsWorkspace.tsx`
- Modify tests.

**Interfaces:**
- Produces: workload, response state, manual-attention and marketplace/product load insights rather than raw AI telemetry.

- [ ] **Step 1: Group measures by operational question**
- [ ] **Step 2: Prioritize trends that lead to an action**
- [ ] **Step 3: Move raw provider usage/latency out of primary view**
- [ ] **Step 4: Define empty/error/loading ranges and date/filter behavior**
- [ ] **Step 5: Verify accessible chart/table alternatives if charts exist**
- [ ] **Step 6: Commit**

### Task 10: Redesign `/app/billing` as `Тариф и лимиты`

**Files:**
- Modify: `apps/web/app/app/billing/page.tsx`
- Modify: `apps/web/components/billing/BillingWorkspace.tsx`
- Modify tests.

**Interfaces:**
- Produces: current plan, period, used/available limit semantics and real next step without fake prices.

- [ ] **Step 1: Remove `billing-ready`, `hard limit`, raw usage jargon from default UX**
- [ ] **Step 2: Show used vs available with plain-language consequence**
- [ ] **Step 3: Add plan-change/contact CTA only if real path exists**
- [ ] **Step 4: Define no-plan/error/loading states**
- [ ] **Step 5: Commit**

### Task 11: Audit and redesign superadmin/internal screens

**Files:**
- Inspect/modify: `apps/web/app/app/admin/**`
- Inspect/modify corresponding components/styles/tests.

**Interfaces:**
- Produces: consistent internal UI while preserving necessary diagnostics terminology.

- [ ] **Step 1: Inventory admin routes and primary operator jobs**
- [ ] **Step 2: Apply MPReply visual primitives and action hierarchy**
- [ ] **Step 3: Keep technical language only where it aids diagnostics/security/operations**
- [ ] **Step 4: Add confirmations for destructive/revocation actions**
- [ ] **Step 5: Add clear success/error feedback**
- [ ] **Step 6: Verify superadmin-only access remains backend/auth enforced**
- [ ] **Step 7: Commit**

### Task 12: Standardize shared dashboard states and interaction patterns

**Files:**
- Modify/create focused shared components under `apps/web/components/` as justified by actual repetition.
- Modify dashboard styles.
- Modify tests.

**Interfaces:**
- Produces reusable patterns for page status, empty state, inline error, read-only notice, destructive confirmation and primary/secondary actions.

- [ ] **Step 1: Identify patterns repeated in at least three workspaces**
- [ ] **Step 2: Extract only genuinely repeated components; avoid abstracting one-off layouts**
- [ ] **Step 3: Ensure status semantics and accessible names are consistent**
- [ ] **Step 4: Verify reduced-motion/focus/contrast behavior**
- [ ] **Step 5: Commit**

### Task 13: Authenticated responsive, accessibility and visual regression pass

**Files:**
- Modify/add authenticated Playwright specs and snapshots.

**Interfaces:**
- Produces: desktop/mobile behavioral and visual coverage for main workspace routes.

- [ ] **Step 1: Add/extend responsive E2E at desktop and 390px for primary routes**
- [ ] **Step 2: Test keyboard navigation and focus order for filters, lists, dialogs and primary actions**
- [ ] **Step 3: Run axe coverage on all main workspace routes**
- [ ] **Step 4: Run visual snapshots and review intentionally**
- [ ] **Step 5: Fix real UX regressions rather than updating baselines blindly**
- [ ] **Step 6: Commit approved snapshots/tests**

### Task 14: Dashboard/admin final verification checkpoint

**Files:** no product changes unless verification finds a real defect.

- [ ] **Step 1: Run frontend unit/design/static gates**

```bash
cd apps/web
npm run test:frontend
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
```

- [ ] **Step 2: Run behavioral/browser gates**

```bash
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

- [ ] **Step 3: Verify API/security contracts on affected flows**

Confirm payloads/RBAC/credential handling were not weakened by UX refactors.

- [ ] **Step 4: Review representative desktop/mobile screens manually against the approved MPReply design and UX addendum**
- [ ] **Step 5: Commit only real fixes**
