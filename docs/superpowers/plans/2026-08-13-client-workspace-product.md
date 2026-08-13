# Client Workspace Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a launch-ready authenticated MPReply workspace with actionable operations, responsive navigation, AI instruction sets, structured knowledge, team/settings/audit surfaces and complete security/UX verification.

**Architecture:** Preserve the existing FastAPI, SQLAlchemy, React Query and semantic-token foundations. Add two tenant-owned backend resources (`AIInstructionSet`, `KnowledgeEntry`), resolve reply policy by marketplace account with a fail-closed default, and expose customer-facing Next.js workspaces through typed Zod clients. Implement vertical TDD slices so each commit leaves a coherent backend/frontend behavior.

**Tech Stack:** Python 3.13, FastAPI 0.128.0, Pydantic 2.12.5, SQLAlchemy 2.0.45 asyncio, Alembic 1.17.2, PostgreSQL, Next.js 16.2.11, React 19.2.3, TanStack Query 5.90.12, Zod 4.2.0, Vitest 4.1.10 and Playwright 1.61.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-13-client-workspace-product-design.md`.
- No provider calls, secrets, production deployment, dependency changes or release version bump in this plan.
- Customer copy is native Russian and contains no API paths, backend/provider implementation names or roadmap labels.
- Owner/admin manage instruction sets, knowledge, team and settings; manager/viewer read those policy surfaces only.
- All writes and restricted reads enforce tenant membership on the backend.
- New queries use SQLAlchemy expressions and explicit filter/sort allowlists; no user-controlled SQL concatenation.
- New UI values use existing semantic tokens; no new visual system, gradient text, glassmorphism, nested cards or identical metric-card grid.
- Work in grouped RED/GREEN cycles and do not repeat unchanged suites.

---

### Task 1: Product shell, navigation and responsive foundation

**Files:**
- Modify: `apps/web/components/app-shell/AppShell.tsx`
- Modify: `apps/web/app/app/dashboard/page.tsx`
- Modify: `apps/web/components/dashboard/DashboardMetrics.tsx`
- Modify: `apps/web/components/inbox/InboxWorkspace.tsx`
- Modify: `apps/web/styles/globals.css`
- Modify: `apps/web/styles/tokens.css`
- Create: `apps/web/tests/unit/app-shell-product.test.tsx`
- Create: `apps/web/tests/unit/authenticated-responsive-contract.test.ts`

**Interfaces:**
- Produces grouped navigation for Work, Automation, Marketplaces, Insights and Management.
- Produces mobile drawer semantics: `aria-expanded`, backdrop close, Escape close, focus return and body scroll lock.
- Produces `.app-page-title` with 32–40 px desktop and 28–32 px mobile sizing.

- [ ] **Step 1: Write failing unit contracts**

  Render `AppShell` with a real `WorkspaceProvider` query fixture and assert customer labels `Главная`, `Обращения`, `Ручная проверка`, `Правила`, `Наборы AI`, `База знаний`, `Подключения`, `Аналитика`, `Команда`, `Настройки`, `Тариф и лимиты`, `Журнал действий`. Assert that `OpenRouter`, `MVP adapter`, `Следующие спринты`, `Billing schema`, `GET /api/messages` and `backend API` are absent. Exercise opening, Escape close and focus return on the mobile menu.

- [ ] **Step 2: Run RED once**

  Run: `npm run test:unit -- tests/unit/app-shell-product.test.tsx tests/unit/authenticated-responsive-contract.test.ts`

  Expected: failures for missing routes/customer labels, internal copy and missing authenticated heading/overflow rules.

- [ ] **Step 3: Implement the shell and copy foundation**

  Group navigation without rendering unavailable roadmap items. Use one existing icon family or text-only navigation until the project icon contract is present; do not introduce a dependency. Add inert backdrop semantics, Escape handling, focus return and scroll lock. Scope product headings to `.app-page-title`; do not change public H1 tokens.

- [ ] **Step 4: Run focused GREEN**

  Run the Step 2 command once and confirm both files pass.

- [ ] **Step 5: Commit**

  Commit exact Task 1 files as `feat(workspace): rebuild product navigation shell`.

---

### Task 2: AI instruction-set persistence, integrity and API

**Files:**
- Create: `apps/api/app/models/ai_instruction_set.py`
- Modify: `apps/api/app/models/__init__.py`
- Modify: `apps/api/app/models/marketplace_account.py`
- Create: `apps/api/app/schemas/ai_instruction_set.py`
- Create: `apps/api/app/services/ai_instruction_set_service.py`
- Create: `apps/api/app/api/ai_instruction_sets.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/alembic/versions/20260813_0016_ai_instruction_sets.py`
- Create: `apps/api/app/tests/test_ai_instruction_sets.py`
- Modify: `apps/api/app/tests/test_sql_injection_safety.py`

**Interfaces:**
- `GET /api/organizations/{organization_id}/instruction-sets`
- `POST /api/organizations/{organization_id}/instruction-sets`
- `PATCH /api/organizations/{organization_id}/instruction-sets/{instruction_set_id}`
- `POST /api/organizations/{organization_id}/instruction-sets/{instruction_set_id}/make-default`
- `PATCH /api/marketplace-accounts/{account_id}/instruction-set` with `{ "instruction_set_id": UUID | null }`
- `AIInstructionSetService.resolve_for_account(organization_id: UUID, marketplace_account_id: UUID | None) -> SellerPromptSettings`

- [ ] **Step 1: Write failing backend tests**

  Cover normalization, unknown-field rejection, owner/admin writes, manager/viewer read-only behavior, cross-tenant IDs, exactly one active default, transactional default switch, assigned-set resolution, default fallback, assigned/default archive rejection, audit metadata redaction and parameterized statements.

- [ ] **Step 2: Run RED once**

  Run: `pytest app/tests/test_ai_instruction_sets.py app/tests/test_sql_injection_safety.py -q`

  Expected: import/route/model failures because instruction sets do not exist.

- [ ] **Step 3: Implement model, migration and service**

  Use `Index(..., unique=True, postgresql_where=text("is_default AND status = 'active'"))` and `select(...).with_for_update()` during default changes. The migration creates a default instruction set from every `seller_settings` row and adds nullable `marketplace_accounts.ai_instruction_set_id` with `ON DELETE SET NULL`. Service validation checks organization ownership before mutation and writes changed field names only to audit metadata.

- [ ] **Step 4: Implement typed routes**

  Pydantic request models use `ConfigDict(extra="forbid")`, finite tone/status values, trimmed names/rules/signatures and normalized case-insensitive prohibited phrases. Archive/restore uses the PATCH status field; there is no destructive DELETE endpoint.

- [ ] **Step 5: Run focused GREEN**

  Run the Step 2 command once and confirm the instruction-set/security tests pass.

- [ ] **Step 6: Commit**

  Commit exact Task 2 files as `feat(automation): add tenant AI instruction sets`.

---

### Task 3: Structured Knowledge Base and prompt resolution

**Files:**
- Create: `apps/api/app/models/knowledge_entry.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/app/schemas/knowledge_entry.py`
- Create: `apps/api/app/services/knowledge_entry_service.py`
- Create: `apps/api/app/api/knowledge_entries.py`
- Modify: `apps/api/app/services/ai_service.py`
- Modify: `apps/api/app/ai/prompt_strategy.py`
- Modify: `apps/api/app/services/seller_settings_service.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/alembic/versions/20260813_0017_knowledge_entries.py`
- Create: `apps/api/app/tests/test_knowledge_entries.py`
- Modify: `apps/api/app/tests/test_seller_settings_audit_contract.py`
- Modify: `apps/api/app/tests/test_sql_injection_safety.py`

**Interfaces:**
- `GET /api/organizations/{organization_id}/knowledge-entries`
- `POST /api/organizations/{organization_id}/knowledge-entries`
- `PATCH /api/organizations/{organization_id}/knowledge-entries/{entry_id}`
- `KnowledgeEntryService.context_for_message(organization_id, marketplace_account_id, product_id, max_characters=8000) -> str | None`
- Prompt strategy accepts separate `seller_policy` and `seller_knowledge` sections.

- [ ] **Step 1: Write failing backend tests**

  Cover validated categories/statuses, title/content bounds, owner/admin writes, manager/viewer reads, cross-tenant account/product rejection, active global/account/product selection, deterministic ordering, 8,000-character bound, archived exclusion, SQL-injection search literals, migration of non-empty legacy knowledge and policy/knowledge prompt separation.

- [ ] **Step 2: Run RED once**

  Run: `pytest app/tests/test_knowledge_entries.py app/tests/test_seller_settings_audit_contract.py app/tests/test_sql_injection_safety.py -q`

  Expected: import/route/context failures because structured knowledge does not exist.

- [ ] **Step 3: Implement model, migration, service and routes**

  Categories are `company`, `delivery`, `returns`, `warranty`, `product`, `other`; statuses are `draft`, `active`, `archived`. Selection includes global entries plus matching account/product entries, orders product → account → global then newest update, and truncates only at entry boundaries within 8,000 characters.

- [ ] **Step 4: Integrate reply generation**

  Resolve instruction set by message account, fetch bounded knowledge by account/product, delimit factual context separately, preserve prohibited-phrase checks and fail closed when no valid default instruction set exists.

- [ ] **Step 5: Run focused GREEN**

  Run the Step 2 command once and confirm the knowledge/settings/security group passes.

- [ ] **Step 6: Commit**

  Commit exact Task 3 files as `feat(automation): add structured seller knowledge`.

---

### Task 4: Typed frontend clients and Automation workspaces

**Files:**
- Modify: `apps/web/lib/api/schemas.ts`
- Create: `apps/web/components/instruction-sets/InstructionSetsWorkspace.tsx`
- Create: `apps/web/components/knowledge/KnowledgeBaseWorkspace.tsx`
- Create: `apps/web/app/app/instruction-sets/page.tsx`
- Create: `apps/web/app/app/knowledge-base/page.tsx`
- Modify: `apps/web/styles/globals.css`
- Create: `apps/web/tests/unit/instruction-sets-workspace.test.tsx`
- Create: `apps/web/tests/unit/knowledge-base-workspace.test.tsx`
- Create: `apps/web/e2e/helpers/workspace-policy-api.ts`
- Create: `apps/web/e2e/workspace-policy.spec.ts`

**Interfaces:**
- Zod schemas exactly mirror Task 2/3 responses.
- Instruction set editor supports create, update, make default, assign account and archive/restore.
- Knowledge editor supports search/filter/create/update/activate/archive/restore.

- [ ] **Step 1: Write failing frontend tests**

  Assert real list/editor behavior, explicit read-only state, validation feedback, duplicate-submit protection, assignment/default guards, empty/error/retry states, safe customer copy and structured Knowledge Base without file upload controls.

- [ ] **Step 2: Run RED once**

  Run: `npm run test:unit -- tests/unit/instruction-sets-workspace.test.tsx tests/unit/knowledge-base-workspace.test.tsx`

  Expected: missing schema/component/module failures.

- [ ] **Step 3: Implement typed workspaces**

  Use React Query with organization-scoped keys and invalidate only affected collections. Reuse existing Button, Badge, EmptyState and form patterns. Do not expose raw provider/model/API terminology.

- [ ] **Step 4: Run focused GREEN**

  Run the Step 2 command once and confirm both workspace suites pass.

- [ ] **Step 5: Commit**

  Commit exact Task 4 files as `feat(workspace): manage AI policies and knowledge`.

---

### Task 5: Team, Settings and Audit customer surfaces

**Files:**
- Modify: `apps/web/lib/api/schemas.ts`
- Create: `apps/web/components/team/TeamWorkspace.tsx`
- Create: `apps/web/components/settings/SettingsWorkspace.tsx`
- Create: `apps/web/components/audit/AuditLogWorkspace.tsx`
- Create: `apps/web/app/app/team/page.tsx`
- Create: `apps/web/app/app/settings/page.tsx`
- Create: `apps/web/app/app/audit-log/page.tsx`
- Modify: `apps/web/styles/globals.css`
- Create: `apps/web/tests/unit/team-workspace.test.tsx`
- Create: `apps/web/tests/unit/settings-workspace.test.tsx`
- Create: `apps/web/tests/unit/audit-log-workspace.test.tsx`

**Interfaces:**
- Uses existing `/members`, `/invitations`, `/seller-settings` and `/audit-logs` contracts.
- Audit action labels are translated through a closed mapping with safe fallback `Другое действие`.

- [ ] **Step 1: Write failing frontend tests**

  Cover member/invitation lifecycle, owner/self guards, role visibility, read-only/forbidden behavior, settings save/retry, audit cursor pagination/filtering, secret metadata suppression, customer labels and all loading/empty/error states.

- [ ] **Step 2: Run RED once**

  Run: `npm run test:unit -- tests/unit/team-workspace.test.tsx tests/unit/settings-workspace.test.tsx tests/unit/audit-log-workspace.test.tsx`

  Expected: missing component/schema/module failures.

- [ ] **Step 3: Implement three workspaces**

  Team writes are absent for manager/viewer. Settings edits are absent outside owner/admin. Audit does not issue a request for manager/viewer and renders a permissions explanation. Sensitive metadata keys matching token, secret, credential, authorization, prompt or password are excluded before rendering.

- [ ] **Step 4: Run focused GREEN**

  Run the Step 2 command once and confirm all three suites pass.

- [ ] **Step 5: Commit**

  Commit exact Task 5 files as `feat(workspace): add team settings and audit surfaces`.

---

### Task 6: Actionable dashboard, onboarding and complete Inbox

**Files:**
- Create: `apps/api/app/schemas/dashboard.py`
- Create: `apps/api/app/services/dashboard_service.py`
- Create: `apps/api/app/api/dashboard.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/app/tests/test_dashboard_service.py`
- Modify: `apps/web/lib/api/schemas.ts`
- Create: `apps/web/components/dashboard/AttentionQueue.tsx`
- Create: `apps/web/components/onboarding/OnboardingChecklist.tsx`
- Modify: `apps/web/components/dashboard/DashboardMetrics.tsx`
- Modify: `apps/web/components/workspace/WorkspaceProvider.tsx`
- Modify: `apps/web/components/inbox/InboxWorkspace.tsx`
- Modify: `apps/web/styles/globals.css`
- Create: `apps/web/tests/unit/actionable-dashboard.test.tsx`
- Create: `apps/web/tests/unit/onboarding-checklist.test.tsx`
- Create: `apps/web/tests/unit/inbox-product-workflow.test.tsx`

**Interfaces:**
- `GET /api/dashboard/attention?organization_id=...` returns tenant-scoped attention items and integration health from persisted state.
- Inbox accepts `type=chat` and synchronizes supported filters with URL search parameters.

- [ ] **Step 1: Write failing backend/frontend tests**

  Backend tests cover tenant isolation, priority ordering and absence of invented health. Frontend tests cover actionable links, persisted onboarding derivation, chat filter, URL filter restoration, customer-safe loading/empty/error text and mobile list/detail flow.

- [ ] **Step 2: Run RED once**

  Run backend dashboard tests and the three named Vitest files once. Expected failures are missing endpoint/components and absent chat/URL behavior.

- [ ] **Step 3: Implement dashboard/onboarding/Inbox**

  Attention items use only persisted message, reply, sync and account states. Onboarding derives completion from real organization/account/validation/sync/instruction data. Dashboard metrics become secondary compact rows. Inbox handles reviews, questions and chats without API-copy placeholders.

- [ ] **Step 4: Run focused GREEN**

  Repeat the Step 2 grouped commands once and confirm the new suites pass.

- [ ] **Step 5: Commit**

  Commit exact Task 6 files as `feat(workspace): prioritize operational attention`.

---

### Task 7: Authenticated E2E, accessibility and visual coverage

**Files:**
- Create: `apps/web/e2e/helpers/client-workspace-api.ts`
- Create: `apps/web/e2e/client-workspace.spec.ts`
- Create: `apps/web/e2e/client-workspace-accessibility.spec.ts`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/playwright.config.ts`

**Interfaces:**
- Complete API fixtures mirror backend response schemas and cover owner plus viewer roles.
- Visual matrix covers 1440×1000 and 390×844 for primary authenticated routes.

- [ ] **Step 1: Write failing browser contracts**

  Cover navigation, actionable dashboard, instruction sets, knowledge, team, settings, audit, Inbox chat/filtering, mobile drawer focus/scroll behavior and `documentElement.scrollWidth <= innerWidth` at 320/390/768/1024/1440.

- [ ] **Step 2: Run RED once**

  Run only `client-workspace.spec.ts` and `client-workspace-accessibility.spec.ts`; expect route/behavior/overflow failures.

- [ ] **Step 3: Finish responsive and accessibility implementation**

  Fix production behavior exposed by RED. Do not weaken axe rules or regenerate visual snapshots merely to pass.

- [ ] **Step 4: Run focused GREEN and review visuals**

  Run the two Step 2 files, then generate the new authenticated baselines once and manually inspect every desktop/mobile image before accepting them.

- [ ] **Step 5: Commit**

  Commit exact Task 7 files and reviewed snapshots as `test(workspace): cover authenticated product journeys`.

---

### Task 8: Documentation and final verification

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `DEVELOPMENT_STATUS_0.1.104.md`
- Modify: repository integrity/version contract files only if the existing checker requires documentation registration without a version bump.

**Interfaces:**
- Documents current implemented truth and explicit exclusions; they do not claim live provider verification.

- [ ] **Step 1: Update product truth**

  Record the implemented authenticated IA, instruction-set assignment, structured text Knowledge Base, team/settings/audit surfaces and verified responsive/accessibility coverage. Retain PDF/vector/provider-live exclusions.

- [ ] **Step 2: Run one final backend gate**

  From `apps/api`, run Ruff, strict Pyright, full pytest, compileall and Alembic head/history exactly once.

- [ ] **Step 3: Run one final frontend gate**

  From `apps/web`, run `npm run qa:web`, the complete E2E suite, complete a11y suite, authenticated/public visual suite and Lighthouse exactly once.

- [ ] **Step 4: Run repository gates**

  Run `git diff --check` and the repository integrity scripts once. Inspect `git status`, staged scope and commit history.

- [ ] **Step 5: Commit documentation**

  Commit Task 8 documentation as `docs(workspace): record completed client product` only after all final checks pass.

## Plan self-review

- Spec coverage: every delivery slice and acceptance criterion maps to Tasks 1–8.
- Type consistency: backend resource names, routes and frontend schema consumers use the same `instruction-set` and `knowledge-entry` terminology.
- Security coverage: tenant isolation, RBAC, SQL injection, audit redaction, prompt-policy separation and fail-closed resolution have named tests.
- Verification discipline: one RED/GREEN per vertical and one final backend/frontend gate; visual snapshots require manual review.
- Scope: file upload, vector retrieval, provider calls, deployment, dependencies and version bump remain excluded.
