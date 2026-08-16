# Avito Client Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, observable and role-aware Avito Messenger integration workspace to the authenticated client cabinet.

**Architecture:** Add a dedicated `AvitoIntegrationWorkspace` over the existing marketplace-account and overview APIs. Preserve the review/question workspace and all existing provider screens; encode Client ID and Client Secret into the backend's existing opaque Avito credential JSON only at mutation boundaries.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, TanStack Query 5, Zod 4, Vitest, Testing Library, Playwright, axe.

## Global Constraints

- Work only on `codex/0.1.104-backend`; do not create or switch branches or worktrees.
- Project version remains `0.1.103`.
- No live Avito request, credential, provider write or production-readiness claim.
- No backend, migration, dependency or design-token change unless a verified frontend contract gap makes it unavoidable.
- New Avito connections and rotations accept only Client ID and Client Secret; legacy access tokens remain read-only backend compatibility.
- Raw Client ID, Client Secret, access token and full Avito user ID never render after submission or enter logs, snapshots, safe errors or history.
- Owner/admin may mutate; manager/viewer remain read-only.
- Successful mutations return query-invalidation Promises so pending state covers the refresh.
- Do not refactor Wildberries, Ozon, Yandex Market or `ReviewQuestionIntegrationWorkspace`.
- Do not merge, deploy, tag or bump versions.

---

### Task 1: Catalog, route and exact creation contract

**Files:**
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify: `apps/web/components/integrations/IntegrationsWorkspace.tsx`
- Create: `apps/web/components/integrations/AvitoIntegrationWorkspace.tsx`
- Create: `apps/web/app/app/integrations/avito/page.tsx`

**Interfaces:**
- Produces: `AvitoIntegrationWorkspace()` and `/app/integrations/avito`.
- Produces: `encodeAvitoClientCredentials(clientId: string, clientSecret: string): string` inside the Avito module.
- Produces exact create body `{ organization_id, marketplace: "avito", display_name, seller_id, credentials, default_response_mode }`.

- [ ] **Step 1: Add RED catalog and create tests**

Import `AvitoIntegrationWorkspace`, assert the catalog link targets `/app/integrations/avito`, and render the form. Fill `Название подключения`, `ID пользователя Авито`, `Client ID`, and `Client Secret`; assert the POST body equals:

```ts
expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
  organization_id: organization.id,
  marketplace: "avito",
  display_name: "Авито основной",
  seller_id: "123456",
  credentials: JSON.stringify({ client_id: "client-123", client_secret: "synthetic-secret" }),
  default_response_mode: "inherit",
});
```

Assert submit remains disabled until all required values are valid and both credential inputs clear after the successful mutation.

- [ ] **Step 2: Add RED read-only role coverage**

For `manager` and `viewer`, return one Avito account and overview fixture. Assert there is no new-account form and no buttons or inputs for validate, sync, user-ID replacement, credential rotation or revocation.

- [ ] **Step 3: Run the unit module once and record expected RED**

Run from `apps/web`:

```powershell
npx vitest run tests/unit/integrations-workspace.test.tsx --maxWorkers=1
```

Expected: failures identify the unavailable catalog entry and missing Avito component/route.

- [ ] **Step 4: Implement catalog entry and route**

Change the Avito catalog item to `available: true`, `badge: "Доступно"`, `href: "/app/integrations/avito"`, with copy limited to Messenger chat synchronization. Create a route matching the established integration page header and linking back to `/app/integrations`.

- [ ] **Step 5: Implement minimal Avito list/create workspace**

Use existing `marketplaceAccountListSchema` and `marketplaceAccountSchema`. Encode credentials only at the POST boundary:

```ts
function encodeAvitoClientCredentials(clientId: string, clientSecret: string): string {
  return JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
}
```

The form validates `^[1-9][0-9]*$`, trims values, prevents duplicate submit, returns the `invalidateQueries` Promise on success, then clears Client ID and Client Secret state.

- [ ] **Step 6: Run the same unit module once and obtain GREEN for Task 1**

Run the Step 3 command once. Fix only failures attributable to the new Avito contract.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- apps/web/tests/unit/integrations-workspace.test.tsx apps/web/components/integrations/IntegrationsWorkspace.tsx apps/web/components/integrations/AvitoIntegrationWorkspace.tsx apps/web/app/app/integrations/avito/page.tsx
git commit -m "feat(avito): add client connection workspace"
```

### Task 2: Avito lifecycle, observability and secret boundaries

**Files:**
- Modify: `apps/web/tests/unit/integrations-workspace.test.tsx`
- Modify: `apps/web/components/integrations/AvitoIntegrationWorkspace.tsx`

**Interfaces:**
- Consumes: `MarketplaceAccountOverview`, `marketplaceAccountOverviewSchema`, `marketplaceAccountValidateSchema`, `marketplaceSyncSchema`, and `marketplaceAccountActionSchema`.
- Produces: account selection, safe health/history, Avito user-ID replacement, validation, chat sync, client-credential rotation and revocation.

- [ ] **Step 1: Add RED lifecycle and disclosure tests**

Create an Avito overview fixture with:

```ts
scopes_json: {
  validated: true,
  checked_at: timestamp,
  scopes: ["fetch_chats"],
  authentication: "client_credentials",
}
```

Add one `chats` sync state, one failed manual job and one safe event. Assert the UI shows `Доступ к чатам`, `Client ID и Client Secret`, health, scheduler state and normalized Russian error copy. Inject synthetic markers into event `details` under `client_id`, `client_secret`, `access_token`, `provider_body`, `seller_id`, and `cursor`; assert none render.

- [ ] **Step 2: Add RED mutation-payload tests**

Assert Avito user-ID replacement sends only:

```ts
{ seller_id: "654321" }
```

Assert credential rotation sends only:

```ts
{ credentials: JSON.stringify({ client_id: "client-new", client_secret: "synthetic-new-secret" }) }
```

The rotation payload must not contain `seller_id`, and the new credential inputs must clear after success.

- [ ] **Step 3: Run the focused Avito unit selection once and record RED**

```powershell
npx vitest run tests/unit/integrations-workspace.test.tsx -t "Avito" --maxWorkers=1
```

Expected: missing lifecycle labels/actions and safe-history behavior fail.

- [ ] **Step 4: Implement detail lifecycle**

Fetch `/api/marketplace-accounts/{id}/overview?jobs_limit=10&events_limit=20`. Invalidate both account-list and overview query keys after every successful mutation. Map `fetch_chats` to `Доступ к чатам`; map authentication values exactly:

```ts
const authenticationLabels = {
  client_credentials: "Client ID и Client Secret",
  access_token: "Старое подключение по access token",
} as const;
```

Owner/admin receive explicit forms and actions. Manager/viewer receive only status, overview, safe jobs and safe events.

- [ ] **Step 5: Implement safe errors and event details**

Map known Avito codes to Russian copy and use a neutral fallback. Recursively exclude keys containing `credential`, `secret`, `token`, `authorization`, `provider_body`, `client_id`, `seller_id`, or `cursor` before rendering event details. Never render raw provider error messages when a normalized local mapping exists.

- [ ] **Step 6: Run the full integration unit module once and obtain GREEN**

```powershell
npx vitest run tests/unit/integrations-workspace.test.tsx --maxWorkers=1
```

This confirms Avito plus unchanged Wildberries, Ozon and Yandex Market contracts.

- [ ] **Step 7: Run touched static checks once**

From `apps/web`:

```powershell
npx eslint components/integrations/AvitoIntegrationWorkspace.tsx components/integrations/IntegrationsWorkspace.tsx app/app/integrations/avito/page.tsx tests/unit/integrations-workspace.test.tsx
npx tsc --noEmit
```

- [ ] **Step 8: Commit Task 2**

```powershell
git add -- apps/web/tests/unit/integrations-workspace.test.tsx apps/web/components/integrations/AvitoIntegrationWorkspace.tsx
git commit -m "feat(avito): add safe integration lifecycle"
```

### Task 3: Browser, accessibility and visual contracts

**Files:**
- Modify: `apps/web/e2e/helpers/client-workspace-api.ts`
- Modify: `apps/web/e2e/client-workspace.spec.ts`
- Modify: `apps/web/e2e/client-workspace-accessibility.spec.ts`
- Modify: `apps/web/e2e/client-workspace-visual.spec.ts`
- Create: `apps/web/e2e/client-workspace-visual.spec.ts-snapshots/avito-integration-desktop-chromium-win32.png`

**Interfaces:**
- Produces: `mockClientWorkspaceApi(..., { includeAvito: true })` with exact Avito account and overview routes.
- Produces no provider request; undeclared `/api/**` routes continue returning `500`.

- [ ] **Step 1: Add schema-valid Avito fixtures**

Add an Avito account whose browser-visible `seller_id` is `null`, `authentication` is `client_credentials`, scopes contain only `fetch_chats`, and scheduler stream is `chats`. Extend helper options without changing existing `includeOzon` behavior:

```ts
options: { includeOzon?: boolean; includeAvito?: boolean } = {}
```

- [ ] **Step 2: Add Chromium behavior and overflow case**

Open `/app/integrations/avito` with Avito fixtures. Assert the account, chat permission, authentication method, safe error copy and replacement notice are visible. Assert raw error/provider markers are absent. Check `document.documentElement.scrollWidth <= window.innerWidth` at 1440 and 390 pixels.

- [ ] **Step 3: Add accessibility and visual coverage**

Add `/app/integrations/avito` to the authenticated axe route set with `includeAvito`. Add a 1440×1000 desktop screenshot named `avito-integration-desktop.png` without modifying existing snapshot expectations.

- [ ] **Step 4: Run only new browser cases once**

From `apps/web`:

```powershell
npx playwright test e2e/client-workspace.spec.ts --project=chromium -g "Avito integration"
npx playwright test e2e/client-workspace-accessibility.spec.ts --project=chromium -g "avito"
npx playwright test e2e/client-workspace-visual.spec.ts --project=chromium -g "Avito integration" --update-snapshots
```

Only the new missing Avito snapshot may be generated.

- [ ] **Step 5: Inspect the new PNG manually**

Open the exact new snapshot and check hierarchy, clipping, responsive composition, credential disclosure and consistency with the authenticated workspace. Do not accept the snapshot solely because Playwright generated it.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- apps/web/e2e/helpers/client-workspace-api.ts apps/web/e2e/client-workspace.spec.ts apps/web/e2e/client-workspace-accessibility.spec.ts apps/web/e2e/client-workspace-visual.spec.ts apps/web/e2e/client-workspace-visual.spec.ts-snapshots/avito-integration-desktop-chromium-win32.png
git commit -m "test(avito): cover client integration browser flows"
```

### Task 4: Final frontend verification and delivery

**Files:**
- Verify: all intended Avito frontend, test, spec and plan files.
- Update: existing draft PR `#11` only after local verification succeeds.

**Interfaces:**
- Produces: one verified current-SHA frontend change set on `codex/0.1.104-backend`.

- [ ] **Step 1: Run the final frontend gate once**

From `apps/web`, run each command once:

```powershell
npm run qa:web
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

- [ ] **Step 2: Inspect repository integrity**

From the repository root:

```powershell
git diff --check
git status --short
git diff --stat origin/codex/0.1.104-backend...HEAD
git diff origin/codex/0.1.104-backend...HEAD -- apps/web docs/superpowers
```

Scan added TypeScript/TSX and rendered test expectations for credential values, provider bodies, authored production comments and unrelated files. Confirm backend, migration, dependency and version files are unchanged.

- [ ] **Step 3: Commit any final intended verification adjustments**

Stage only exact files named by Tasks 1–3. Use a scoped commit; never use `git add -A`.

- [ ] **Step 4: Push and observe one current-SHA Quality Gate**

```powershell
git push origin codex/0.1.104-backend
gh run list --workflow "Quality Gate" --branch codex/0.1.104-backend --limit 5
```

Wait for the run attached to the pushed SHA. Require backend, frontend and containers to succeed; do not rerun unchanged local suites while waiting.

- [ ] **Step 5: Update draft PR truthfully**

Update PR `#11` with the Avito client workspace scope and exact verification evidence. Keep the PR draft. State that live Avito OAuth/Messenger runtime is unverified and that no merge, deploy, tag or version bump occurred.
