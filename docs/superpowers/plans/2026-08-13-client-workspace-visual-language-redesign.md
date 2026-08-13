# Client Workspace Visual Language Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a visually mature authenticated MPReply workspace whose navigation, headings and product copy are immediately understandable to marketplace sellers and operators.

**Architecture:** Preserve all routes, API contracts, React Query behavior and RBAC boundaries. Reshape the existing `AppShell`, dashboard and workspace components with semantic Russian copy, task-led composition and centralized CSS token roles; verify each slice through focused Vitest contracts before one final Playwright/accessibility/visual gate.

**Tech Stack:** Next.js 16.2.11, React 19.2.3, TanStack Query 5.90.12, Zod 4.2.0, Onest, centralized CSS custom properties, Vitest 4.1.10, Testing Library, Playwright 1.61.1 and axe-core 4.12.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-13-client-workspace-visual-language-redesign-design.md`.
- The three first navigation destinations are ungrouped and named exactly `Сводка`, `Отзывы, вопросы и чаты`, `Ответы на проверке`.
- Remaining groups are named exactly `Настройка ответов`, `Маркетплейсы`, `Отчёты`, `Компания`.
- Existing `/app/**` routes and backend/API contracts remain unchanged.
- Authenticated routes retain `robots: { index: false, follow: false, nocache: true }` and remain absent from the sitemap.
- Customer copy is native Russian and contains no `workspace`, `SafetyGate`, `Review Queue`, `Billing-ready`, `usage`, `Accounts`, `Selected account`, API path or provider-runtime terminology.
- Reuse existing palette values, Onest, radii, shadows, spacing and motion. New semantic aliases may only reference existing tokens and must be documented in `DESIGN.md`.
- Do not add an icon library, UI dependency, marketplace provider call, backend mutation, migration, secret, release, deployment or version bump.
- Do not add gradient text, glassmorphism, broad glow, side-stripe cards, identical-card grids, nested cards, decorative motion or emoji icons.
- Keep loading, empty, error, read-only, disabled and destructive states explicit.
- Work in one RED and one GREEN run per task. Do not repeat unchanged suites. Run the complete affected-package gate once at the end.
- Project version remains exactly `0.1.103`; this work belongs to the `0.1.104` development target.

---

## File responsibility map

- `apps/web/components/app-shell/AppShell.tsx`: navigation IA, organization/user chrome and mobile drawer behavior.
- `apps/web/app/app/**/page.tsx`: customer-facing H1 and one-sentence page purpose.
- `apps/web/components/dashboard/*`: decision-first dashboard composition.
- `apps/web/components/{automation-rules,instruction-sets,knowledge,review-queue,inbox,integrations,analytics,billing,team,settings,audit}/*`: screen-local customer copy and semantic structure.
- `apps/web/styles/tokens.css`: light-theme semantic app aliases that reuse existing palette values.
- `apps/web/styles/theme.css`: dark-theme overrides for the same aliases.
- `apps/web/styles/globals.css`: authenticated layout and component composition; no public-page redesign.
- `apps/web/tests/unit/*`: focused behavioral and customer-language contracts.
- `apps/web/tests/design/design-tokens.test.ts`: token existence, reuse and contrast invariants.
- `apps/web/e2e/helpers/client-workspace-api.ts`: one reusable, schema-valid authenticated mock API.
- `apps/web/e2e/client-workspace*.spec.ts`: journeys, responsive overflow, axe and approved visual baselines.
- `PRODUCT.md`, `DESIGN.md`, `DEVELOPMENT_STATUS_0.1.104.md`: truthful implemented state and visual-language contract.

---

### Task 1: Task-led navigation and page names

**Files:**
- Modify: `apps/web/components/app-shell/AppShell.tsx:9-48`
- Modify: `apps/web/app/app/dashboard/page.tsx:6-14`
- Modify: `apps/web/app/app/inbox/page.tsx:5-13`
- Modify: `apps/web/app/app/review-queue/page.tsx:5-13`
- Modify: `apps/web/app/app/automation-rules/page.tsx:5-13`
- Modify: `apps/web/app/app/instruction-sets/page.tsx:1-6`
- Modify: `apps/web/app/app/knowledge-base/page.tsx:1-6`
- Modify: `apps/web/app/app/integrations/page.tsx:5-13`
- Modify: `apps/web/app/app/analytics/page.tsx:1-6`
- Modify: `apps/web/app/app/billing/page.tsx:1-6`
- Modify: `apps/web/app/app/team/page.tsx:1-4`
- Modify: `apps/web/app/app/audit-log/page.tsx:1-4`
- Test: `apps/web/tests/unit/app-shell-product.test.tsx`
- Test: `apps/web/tests/unit/workspace-customer-copy.test.tsx`

**Interfaces:**
- Produces: `primaryNavItems` for the three ungrouped routes and `navGroups` for four task groups.
- Preserves: `aria-current="page"`, drawer close behavior, exact route hrefs and superadmin gating.

- [ ] **Step 1: Write the failing navigation contract**

Replace the old labels in `app-shell-product.test.tsx` with the approved vocabulary and assert the removed abstract group is absent:

```tsx
for (const label of [
  "Сводка",
  "Отзывы, вопросы и чаты",
  "Ответы на проверке",
  "Правила автоответов",
  "Стиль ответов",
  "Данные для ответов",
  "Подключённые кабинеты",
  "Статистика ответов",
  "Сотрудники",
  "Настройки",
  "Тариф",
  "История изменений",
]) {
  expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
}
expect(screen.queryByRole("navigation", { name: "Работа" })).not.toBeInTheDocument();
expect(screen.queryByRole("navigation", { name: "Ежедневная работа" })).not.toBeInTheDocument();
for (const group of ["Настройка ответов", "Маркетплейсы", "Отчёты", "Компания"]) {
  expect(screen.getByRole("navigation", { name: group })).toBeInTheDocument();
}
```

Add a source/render contract in `workspace-customer-copy.test.tsx` that expects the approved H1 strings and rejects `Операционный центр`, `Наборы AI`, `База знаний`, `Операционная аналитика`, `Review Queue`, `Billing-ready`, and `usage`.

- [ ] **Step 2: Run RED once**

Run:

```powershell
npx vitest run tests/unit/app-shell-product.test.tsx tests/unit/workspace-customer-copy.test.tsx --maxWorkers=1
```

Expected: failures show the old navigation labels and page titles.

- [ ] **Step 3: Implement the exact navigation structure**

Split `AppShell.tsx` navigation data without changing route paths:

```tsx
const primaryNavItems = [
  { href: "/app/dashboard", label: "Сводка" },
  { href: "/app/inbox", label: "Отзывы, вопросы и чаты" },
  { href: "/app/review-queue", label: "Ответы на проверке" },
];

const navGroups = [
  { label: "Настройка ответов", items: [
    { href: "/app/automation-rules", label: "Правила автоответов" },
    { href: "/app/instruction-sets", label: "Стиль ответов" },
    { href: "/app/knowledge-base", label: "Данные для ответов" },
  ] },
  { label: "Маркетплейсы", items: [{ href: "/app/integrations", label: "Подключённые кабинеты" }] },
  { label: "Отчёты", items: [{ href: "/app/analytics", label: "Статистика ответов" }] },
  { label: "Компания", items: [
    { href: "/app/team", label: "Сотрудники" },
    { href: "/app/settings", label: "Настройки" },
    { href: "/app/billing", label: "Тариф" },
    { href: "/app/audit-log", label: "История изменений" },
  ] },
];
```

Render `primaryNavItems` in an unlabeled `.app-nav-primary` container before the named groups. Keep the existing active-route calculation and mobile close handler.

- [ ] **Step 4: Replace page headers with customer tasks**

Use the exact title map from the approved spec. Remove decorative page eyebrows. Each page keeps one short explanatory paragraph; for example:

```tsx
<header className="app-header">
  <h1>Сводка по отзывам и вопросам</h1>
  <p>Сначала — ответы и подключения, которые требуют вашего решения.</p>
</header>
```

Do not change data fetching or component props in this task.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: both files pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/components/app-shell/AppShell.tsx apps/web/app/app apps/web/tests/unit/app-shell-product.test.tsx apps/web/tests/unit/workspace-customer-copy.test.tsx
git commit -m "feat(workspace): clarify customer navigation"
```

---

### Task 2: Finished application shell and semantic token roles

**Files:**
- Modify: `apps/web/styles/tokens.css:720-760`
- Modify: `apps/web/styles/theme.css:90-105`
- Modify: `apps/web/styles/globals.css:803-1015`
- Modify: `apps/web/components/app-shell/AppShell.tsx:82-178`
- Modify: `apps/web/tests/design/design-tokens.test.ts`
- Test: `apps/web/tests/unit/app-shell-product.test.tsx`
- Modify: `DESIGN.md:376-386`

**Interfaces:**
- Produces semantic aliases: `--app-sidebar-bg`, `--app-sidebar-text`, `--app-sidebar-muted`, `--app-sidebar-border`, `--app-nav-hover-bg`, `--app-nav-active-bg`, `--app-nav-active-text`, `--app-topbar-bg`.
- All aliases consume existing color tokens; no literal color is added.

- [ ] **Step 1: Write the failing token and shell contract**

Extend `design-tokens.test.ts`:

```ts
for (const name of [
  "--app-sidebar-bg",
  "--app-sidebar-text",
  "--app-sidebar-muted",
  "--app-sidebar-border",
  "--app-nav-active-text",
]) {
  expect(token(name)).toBeTruthy();
}
expect(token("--app-sidebar-bg")).toBe("var(--color-surface-dark)");
expect(token("--app-sidebar-text")).toBe("var(--color-text-on-dark)");
```

In `app-shell-product.test.tsx`, assert that the top bar does not duplicate the current page title and that the organization/user controls retain accessible labels.

- [ ] **Step 2: Run RED once**

```powershell
npx vitest run tests/design/design-tokens.test.ts tests/unit/app-shell-product.test.tsx --maxWorkers=1
```

Expected: missing semantic app-token aliases.

- [ ] **Step 3: Add semantic aliases and document them**

In the light tokens, map the sidebar to existing contrast roles:

```css
--app-sidebar-bg: var(--color-surface-dark);
--app-sidebar-text: var(--color-text-on-dark);
--app-sidebar-muted: var(--color-text-on-dark-muted);
--app-sidebar-border: var(--color-border-on-dark-soft);
--app-nav-hover-bg: var(--color-surface-on-dark-soft);
--app-nav-active-bg: var(--color-brand-action);
--app-nav-active-text: var(--color-text-on-brand);
--app-topbar-bg: var(--color-bg-surface);
```

Define dark-theme overrides using the same semantic roles. Add a short `DESIGN.md` section stating that these are aliases, not a new palette.

- [ ] **Step 4: Implement the shell composition**

Update `.app-sidebar`, `.app-logo`, `.app-nav-primary`, `.app-nav-group-label`, `.app-nav-link`, `.app-topbar`, `.app-topbar-user` and mobile drawer selectors so that:

- sidebar text uses the new on-dark roles;
- current selection has both fill and font-weight contrast;
- the logo remains undistorted;
- no card shadow is applied to navigation items;
- the top bar is opaque and stable rather than decorative glass;
- desktop, tablet and mobile keep the existing focus restoration and scroll locking.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: both suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/styles/tokens.css apps/web/styles/theme.css apps/web/styles/globals.css apps/web/components/app-shell/AppShell.tsx apps/web/tests/design/design-tokens.test.ts apps/web/tests/unit/app-shell-product.test.tsx DESIGN.md
git commit -m "feat(workspace): finish application shell"
```

---

### Task 3: Decision-first dashboard composition

**Files:**
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/components/dashboard/AttentionQueue.tsx`
- Modify: `apps/web/components/dashboard/DashboardMetrics.tsx`
- Modify: `apps/web/components/onboarding/OnboardingChecklist.tsx`
- Modify: `apps/web/styles/globals.css:187-278`
- Modify: `apps/web/styles/globals.css:1030-1080`
- Modify: `apps/web/tests/unit/workspace-customer-copy.test.tsx`
- Create: `apps/web/tests/unit/dashboard-visual-hierarchy.test.tsx`

**Interfaces:**
- Produces regions named `Нужно сделать`, `Краткая сводка`, `За последние 30 дней`, `Тариф`.
- Consumes the existing attention, analytics and billing response schemas unchanged.

- [ ] **Step 1: Write the failing dashboard hierarchy test**

Use precise API mocks for `/api/dashboard/attention`, `/api/analytics/overview`, `/api/billing/overview`, `/api/marketplace-accounts` and `/instruction-sets`, then assert:

```tsx
expect(await screen.findByRole("heading", { name: "Нужно сделать" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "Краткая сводка" })).toBeInTheDocument();
expect(screen.getByRole("link", { name: /Отзывы и вопросы без ответа/ })).toHaveAttribute(
  "href",
  "/app/inbox?status=needs_reply",
);
expect(screen.queryByText("Операционный центр")).not.toBeInTheDocument();
expect(screen.queryByText("Текущая нагрузка")).not.toBeInTheDocument();
```

Add a second case for no urgent tasks and a third where the attention endpoint fails while analytics still renders.

- [ ] **Step 2: Run RED once**

```powershell
npx vitest run tests/unit/dashboard-visual-hierarchy.test.tsx tests/unit/workspace-customer-copy.test.tsx --maxWorkers=1
```

Expected: missing region names and old dashboard composition.

- [ ] **Step 3: Implement the decision-first markup**

Use one dominant task panel and one continuous metric band:

```tsx
<section className="dashboard-action-hub" aria-labelledby="dashboard-actions-title">
  <header>
    <h2 id="dashboard-actions-title">Нужно сделать</h2>
    <p>Ответы и подключения, которые требуют решения.</p>
  </header>
  <div className="dashboard-action-list">...</div>
</section>

<section className="dashboard-summary-band" aria-label="Краткая сводка">
  {metrics.map((metric) => <div className="dashboard-summary-item" key={metric.label}>...</div>)}
</section>
```

Do not render four independent `.metric-card` elements. Keep tariff secondary and use a plain tonal panel instead of `var(--gradient-hero)`.

- [ ] **Step 4: Implement partial and first-run states**

Attention failure remains recoverable without replacing the successful metrics. The clear state reads `Сейчас ничего не требует вашего решения`. Onboarding remains derived from persisted account and instruction data and changes `Проверить основной набор инструкций` to `Проверить основной стиль ответов`.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: both suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/app/app/dashboard/page.tsx apps/web/components/dashboard apps/web/components/onboarding/OnboardingChecklist.tsx apps/web/styles/globals.css apps/web/tests/unit/dashboard-visual-hierarchy.test.tsx apps/web/tests/unit/workspace-customer-copy.test.tsx
git commit -m "feat(workspace): prioritize customer decisions"
```

---

### Task 4: Reply settings and factual context workspaces

**Files:**
- Modify: `apps/web/components/automation-rules/AutomationRulesWorkspace.tsx`
- Modify: `apps/web/components/instruction-sets/InstructionSetsWorkspace.tsx`
- Modify: `apps/web/components/knowledge/KnowledgeBaseWorkspace.tsx`
- Modify: `apps/web/styles/globals.css:3429-3650`
- Modify: `apps/web/tests/unit/automation-rules-workspace.test.tsx`
- Modify: `apps/web/tests/unit/instruction-sets-workspace.test.tsx`
- Modify: `apps/web/tests/unit/knowledge-base-workspace.test.tsx`

**Interfaces:**
- Preserves all existing create/update/archive/default/assignment requests and RBAC behavior.
- Produces consistent list/detail semantics and the customer terms `Правила автоответов`, `Стиль ответов`, `Данные для ответов`.

- [ ] **Step 1: Write failing customer-language assertions**

Add these expectations to the existing suites:

```tsx
expect(screen.getByRole("heading", { name: "Сохранённые стили" })).toBeInTheDocument();
expect(screen.getByLabelText("Стиль ответов для кабинета Основной кабинет WB")).toBeVisible();
expect(screen.getByRole("searchbox", { name: "Поиск по данным для ответов" })).toBeVisible();
expect(screen.queryByText(/SafetyGate|Набор инструкций|База знаний/i)).not.toBeInTheDocument();
```

For rules, expect the explanatory heading `Когда ответ нужно проверить`. Preserve all mutation-count and read-only assertions.

- [ ] **Step 2: Run RED once**

```powershell
npx vitest run tests/unit/automation-rules-workspace.test.tsx tests/unit/instruction-sets-workspace.test.tsx tests/unit/knowledge-base-workspace.test.tsx --maxWorkers=1
```

Expected: old terminology appears and the new labels are absent.

- [ ] **Step 3: Rewrite copy without changing request behavior**

Apply one terminology glossary:

```ts
const customerTerms = {
  instructionCollection: "Сохранённые стили",
  defaultInstruction: "Основной стиль",
  accountAssignment: "Стиль ответов для кабинета",
  knowledgeCollection: "Проверенные данные",
  safetyReview: "Когда ответ нужно проверить",
} as const;
```

Use direct Russian labels in the components; do not expose the `customerTerms` object outside this task unless it removes real duplication.

- [ ] **Step 4: Finish list/detail visual structure**

Use one selected row, a borderless/tonal detail surface and a stable action row. Keep form controls bordered for affordance. Remove nested-card appearance from `.policy-toolbar`, `.policy-card`, `.policy-assignments`, `.knowledge-filters` and `.policy-state` while preserving focus, error and selected states.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: all three suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/components/automation-rules apps/web/components/instruction-sets apps/web/components/knowledge apps/web/styles/globals.css apps/web/tests/unit/automation-rules-workspace.test.tsx apps/web/tests/unit/instruction-sets-workspace.test.tsx apps/web/tests/unit/knowledge-base-workspace.test.tsx
git commit -m "feat(workspace): clarify reply configuration"
```

---

### Task 5: Inbox, review and marketplace-account language

**Files:**
- Modify: `apps/web/components/inbox/InboxWorkspace.tsx`
- Modify: `apps/web/components/review-queue/ReviewQueueWorkspace.tsx`
- Modify: `apps/web/components/integrations/IntegrationsWorkspace.tsx`
- Modify: `apps/web/components/integrations/WildberriesIntegrationWorkspace.tsx`
- Modify: `apps/web/components/integrations/YandexMarketIntegrationWorkspace.tsx`
- Modify: `apps/web/app/app/integrations/wildberries/page.tsx`
- Modify: `apps/web/app/app/integrations/yandex-market/page.tsx`
- Modify: `apps/web/styles/globals.css:1090-2330`
- Modify: `apps/web/styles/globals.css:2968-3428`
- Modify: `apps/web/tests/unit/inbox-product-workflow.test.tsx`
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify: `apps/web/tests/unit/integrations-contract.test.ts`

**Interfaces:**
- Preserves Inbox URL filters and all marketplace account actions.
- Produces customer-visible labels `Фильтры`, `Список обращений`, `Отзыв`, `Вопрос`, `Чат`, `Ответ`, `Состояние подключения`, `Доступ`, `Права`, `Синхронизация`.

- [ ] **Step 1: Write failing terminology contracts**

Extend the existing unit suites to reject:

```ts
const forbidden = [
  "Reply editor",
  "Inbox context",
  "Accounts",
  "New account",
  "Selected account",
  "Credentials",
  "Connection health",
  "Permissions",
  "Scheduler",
  "Manual sync",
  "Audit trail",
];
```

Assert the replacement headings are present and that Inbox filter changes still update `type`, `status`, `marketplace_account_id`, and `search` query parameters.

- [ ] **Step 2: Run RED once**

```powershell
npx vitest run tests/unit/inbox-product-workflow.test.tsx tests/unit/integrations-workspace.test.tsx tests/unit/integrations-contract.test.ts --maxWorkers=1
```

Expected: English/internal labels remain in the current components.

- [ ] **Step 3: Implement customer terminology and hierarchy**

Replace kickers with visible section headings only where they add wayfinding. Keep marketplace/API language only inside credential and synchronization controls. Do not alter endpoint paths, credential masking, retry safeguards or supported-provider truth.

- [ ] **Step 4: Refine operational composition**

Make filters a compact toolbar, the message list the dominant navigation surface and message detail the reading/action surface. Marketplace accounts use account health and last synchronization as evidence, without decorative provider cards or unsupported readiness promises.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: all three suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/components/inbox apps/web/components/review-queue apps/web/components/integrations apps/web/app/app/integrations apps/web/styles/globals.css apps/web/tests/unit/inbox-product-workflow.test.tsx apps/web/tests/unit/integrations-workspace.test.tsx apps/web/tests/unit/integrations-contract.test.ts
git commit -m "feat(workspace): clarify operational workspaces"
```

---

### Task 6: Reports, tariff and company administration

**Files:**
- Modify: `apps/web/components/analytics/AnalyticsWorkspace.tsx`
- Modify: `apps/web/components/billing/BillingWorkspace.tsx`
- Modify: `apps/web/components/team/TeamWorkspace.tsx`
- Modify: `apps/web/components/settings/SettingsWorkspace.tsx`
- Modify: `apps/web/components/audit/AuditLogWorkspace.tsx`
- Modify: `apps/web/styles/globals.css:327-525`
- Modify: `apps/web/styles/globals.css:2533-2967`
- Modify: `apps/web/tests/unit/team-workspace.test.tsx`
- Modify: `apps/web/tests/unit/settings-workspace.test.tsx`
- Modify: `apps/web/tests/unit/audit-log-workspace.test.tsx`
- Modify: `apps/web/tests/unit/workspace-customer-copy.test.tsx`

**Interfaces:**
- Preserves analytics/billing/team/settings/audit schemas, permissions and mutation behavior.
- Produces customer terms `Обращения и ответы`, `По маркетплейсам`, `По товарам`, `Использование AI`, `Тариф и использование`, `Сотрудники и доступ`, `История изменений`.

- [ ] **Step 1: Write failing copy and permission contracts**

Add assertions that render the relevant workspaces and reject `Live analytics`, `Volume`, `AI cost`, `OpenRouter usage`, `Channels`, `Products`, `Models`, `Current plan`, `Billing-ready` and `workspace`. Retain existing tests proving that restricted roles do not receive controls or protected reads.

- [ ] **Step 2: Run RED once**

```powershell
npx vitest run tests/unit/team-workspace.test.tsx tests/unit/settings-workspace.test.tsx tests/unit/audit-log-workspace.test.tsx tests/unit/workspace-customer-copy.test.tsx --maxWorkers=1
```

Expected: current English/internal copy violates the new language contract.

- [ ] **Step 3: Implement the approved language**

Use these exact section names where the corresponding data exists:

```ts
const reportSections = {
  daily: "Обращения и ответы по дням",
  ai: "Использование AI",
  marketplaces: "По маркетплейсам",
  products: "По товарам",
  models: "По AI-моделям",
} as const;
```

Billing explains the current plan and limits without publishing a price that is not finalized. Remove descriptions of future payment-provider architecture.

- [ ] **Step 4: Refine management surfaces**

Use compact rows and definition lists for team, settings and audit evidence. Keep dangerous actions explicit, audit metadata filtered, and read-only explanations visible. Remove the generic three-card settings link grid if the same destinations are already present in navigation.

- [ ] **Step 5: Run focused GREEN**

Run the Step 2 command once. Expected: all four suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/components/analytics apps/web/components/billing apps/web/components/team apps/web/components/settings apps/web/components/audit apps/web/styles/globals.css apps/web/tests/unit/team-workspace.test.tsx apps/web/tests/unit/settings-workspace.test.tsx apps/web/tests/unit/audit-log-workspace.test.tsx apps/web/tests/unit/workspace-customer-copy.test.tsx
git commit -m "feat(workspace): clarify reports and management"
```

---

### Task 7: Authenticated responsive, accessibility and visual coverage

**Files:**
- Create: `apps/web/e2e/helpers/client-workspace-api.ts`
- Modify: `apps/web/e2e/client-workspace.spec.ts`
- Create: `apps/web/e2e/client-workspace-accessibility.spec.ts`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/dashboard-desktop-chromium-win32.png`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/dashboard-mobile-chromium-win32.png`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/reply-style-desktop-chromium-win32.png`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/reply-data-desktop-chromium-win32.png`
- Modify: `apps/web/package.json`
- Modify: `apps/web/styles/globals.css`

**Interfaces:**
- `mockClientWorkspaceApi(page, role)` provides one schema-valid fixture for dashboard, navigation and management routes.
- Browser checks cover 1440, 1280, 1024, 768, 430, 390 and 375 pixels without real provider calls.

- [ ] **Step 1: Extract the reusable mock API**

Move the current `client-workspace.spec.ts` fixtures into:

```ts
export async function mockClientWorkspaceApi(
  page: Page,
  role: "owner" | "viewer" = "owner",
): Promise<void> {
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-origin": resolvePlaywrightBaseURL(),
    "content-type": "application/json",
  };
  const organization = { ...organizationFixture, current_user_role: role };
  const exactResponses = new Map<string, unknown>([
    ["/api/auth/me", userFixture],
    ["/api/organizations", [organization]],
    ["/api/marketplace-accounts", [accountFixture]],
    ["/api/dashboard/attention", attentionFixture],
    ["/api/analytics/overview", analyticsFixture],
    ["/api/billing/overview", billingFixture],
    ["/api/audit-logs", auditFixture],
  ]);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const body = exactResponses.get(path)
      ?? (path.endsWith("/instruction-sets") ? [instructionSetFixture] : undefined)
      ?? (path.endsWith("/knowledge-entries") ? knowledgeFixtures : undefined)
      ?? (path.endsWith("/members") ? memberFixtures : undefined)
      ?? (path.endsWith("/invitations") ? [] : undefined);
    if (body === undefined) {
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ detail: "Unexpected client-workspace test route" }) });
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  });
}
```

The unmatched-route response is `{ detail: "Unexpected client-workspace test route" }` with status `500`.

- [ ] **Step 2: Write responsive and axe contracts**

For each required width, navigate to dashboard, Inbox, reply style and reply data, then assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
```

The accessibility spec runs axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and fails on serious/critical violations with selector-level details. Add a dark-theme dashboard case.

- [ ] **Step 3: Run RED once**

```powershell
npx playwright test e2e/client-workspace.spec.ts e2e/client-workspace-accessibility.spec.ts --project=chromium --workers=1
```

Expected: current overflow/contrast/composition defects or missing helper/spec failures.

- [ ] **Step 4: Fix only evidenced responsive and accessibility defects**

Adjust existing selectors in `globals.css`; do not weaken axe rules or hide overflowing content. Preserve readable Russian wrapping, 44-pixel touch targets where controls require them, visible focus and mobile drawer behavior.

- [ ] **Step 5: Run focused GREEN**

Run the Step 3 command once. Expected: all authenticated journey and axe cases pass.

- [ ] **Step 6: Generate and inspect visual baselines once**

Add `client-workspace-visual.spec.ts` with `toHaveScreenshot` assertions at desktop and mobile. Run:

```powershell
npx playwright test e2e/client-workspace-visual.spec.ts --project=chromium --workers=1 --update-snapshots
```

Open every generated PNG with the image viewer. Reject snapshots with clipped Russian copy, crushed controls, excessive blank space, equal-card monotony, weak selected state or wireframe-like hierarchy. Update production CSS, then regenerate only the snapshot whose production rendering changed for a named defect.

- [ ] **Step 7: Register authenticated browser gates**

Update `package.json` so `test:e2e`, `test:a11y` and `test:visual` include the new client-workspace specs. Do not remove existing public or feature specs.

- [ ] **Step 8: Commit**

```powershell
git add -- apps/web/e2e apps/web/package.json apps/web/styles/globals.css
git commit -m "test(workspace): verify finished client experience"
```

---

### Task 8: Product truth, final gate and handoff PNGs

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `DEVELOPMENT_STATUS_0.1.104.md`
- Create: `.handoff/client-workspace-redesign/dashboard.png` (ignored handoff artifact)
- Create: `.handoff/client-workspace-redesign/reply-style.png` (ignored handoff artifact)
- Create: `.handoff/client-workspace-redesign/reply-data.png` (ignored handoff artifact)

**Interfaces:**
- Documents only behavior and verification actually completed.
- Keeps provider-live readiness and business metrics unclaimed.

- [ ] **Step 1: Update product and design truth**

Record the shipped navigation vocabulary, decision-first dashboard, contrast sidebar aliases, customer-language glossary, responsive matrix and authenticated visual coverage. Keep version `0.1.103` and state that marketplace provider runtime verification is outside this visual task.

- [ ] **Step 2: Run one complete frontend static gate**

From `apps/web`, run once:

```powershell
npm run test:frontend
npm run design:detect
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
```

Expected: every command exits `0`. If one fails, investigate that failure, make the minimal correction and rerun only the failed command plus any directly dependent command.

- [ ] **Step 3: Run one complete browser gate**

From `apps/web`, run once:

```powershell
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

Expected: every command exits `0`. Do not regenerate snapshots to silence a mismatch; inspect the rendered difference first.

- [ ] **Step 4: Produce handoff screenshots from safe fixtures**

Use the same schema-valid Playwright fixture to save full-page PNGs at 1440×1000. The organization must be named `Демо-магазин`; values are demonstrative and must not be described as real customer data. Inspect all three PNGs before handoff.

- [ ] **Step 5: Run repository scope checks**

From repository root:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, no secrets, no backend/provider changes, no package dependency changes and only intended frontend/docs/snapshot files.

- [ ] **Step 6: Commit documentation after verification**

```powershell
git add -- PRODUCT.md DESIGN.md DEVELOPMENT_STATUS_0.1.104.md
git commit -m "docs(workspace): record finished client redesign"
```

Do not commit `.handoff` images unless the user explicitly requests tracked design artifacts.

## Plan self-review

- Spec coverage: navigation, customer language, visual cockpit, dashboard priority, list/detail surfaces, responsive behavior, accessibility, noindex and final PNG review map to Tasks 1–8.
- Placeholder scan: no deferred decisions, vague error-handling steps or unnamed tests remain.
- Type consistency: no API schema or component interface is renamed; the new Playwright helper has one stable `mockClientWorkspaceApi(page, role)` signature.
- Scope: no backend, provider, dependency, migration, release, deployment or version change is included.
- Verification discipline: one focused RED/GREEN per task and one full affected-package gate; unchanged suites are not repeated.
