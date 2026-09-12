# MPReply Shared Design System and Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one MPReply visual/token system, source-of-truth product documentation and objective quality gates shared by the public site and authenticated workspace.

**Architecture:** Keep the existing Next.js/CSS architecture, but move repeated blue palette, surfaces, borders, shadows, radii, spacing, focus and semantic states into shared tokens. Public and dashboard styles consume the same primitives with separate density/composition layers. Remove obsolete Respio/Impeccable/dead-theme assumptions from governance while restoring objective visual-regression coverage.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Vitest, Playwright, axe, Lighthouse CI, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-mpreply-full-product-redesign-copy-seo-design.md`

**UX addendum:** `docs/superpowers/specs/2026-09-12-mpreply-dashboard-ux-addendum.md`

## Global Constraints

- Latest approved light-blue homepage preview is the visual source of truth.
- Public site and dashboard must look like one MPReply product.
- Dashboard is denser and calmer than marketing pages.
- Repeated visual values belong in shared tokens; no second uncontrolled hard-coded design system.
- User is the final judge of subjective design quality; Impeccable must not block CI.
- Objective gates remain mandatory: unit, design-token, typecheck, lint, CSS syntax, build, W3C, E2E, accessibility, visual regression, Lighthouse and containers.
- No fake metrics, unsupported pricing, unsupported model names or fabricated marketplace readiness.
- No test weakening or snapshot regeneration solely to silence failures.

---

### Task 1: Lock the shared MPReply token contract

**Files:**
- Modify: `apps/web/styles/brand-theme.css`
- Modify: `apps/web/styles/marketing-site.css`
- Modify: `apps/web/styles/homepage-approved.css`
- Modify: `apps/web/styles/marketing-pages.css`
- Test: `apps/web/tests/unit/brand-theme-contract.test.ts`
- Test: `apps/web/tests/design/*`

**Interfaces:**
- Consumes: existing semantic tokens and approved blue palette.
- Produces: shared `--color-brand-*`, surface, border, text, radius, shadow, spacing and focus variables used by public/dashboard layers.

- [ ] **Step 1: Extend the failing token contract**

Add assertions that repeated approved values are present as variables and that public/page layers do not redeclare the primary brand palette repeatedly.

```ts
expect(theme).toContain("--color-brand-primary: #2563eb");
expect(theme).toContain("--color-brand-primary-strong: #1d4ed8");
expect(theme).toContain("--color-brand-deep: #1e40af");
expect(theme).toContain("--color-brand-accent: #0ea5e9");
expect(theme).toContain("--color-brand-accent-soft: #7dd3fc");
expect(theme).toContain("--shadow-card");
expect(theme).toContain("--radius-card");
expect(theme).toContain("--space-section-public");
```

- [ ] **Step 2: Run token tests and confirm RED**

Run: `cd apps/web && npm run test:design-tokens && npm run test:unit -- brand-theme-contract.test.ts`

Expected: FAIL on missing/duplicated token contract.

- [ ] **Step 3: Centralize repeated visual primitives**

Move repeated brand colors, common cool surfaces, border colors, shadows, radii and public section rhythm from `homepage-approved.css` / `marketing-pages.css` into shared variables. Keep local one-off layout values local.

- [ ] **Step 4: Re-run token and CSS validation**

Run: `cd apps/web && npm run test:design-tokens && npm run validate:css-syntax`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/styles apps/web/tests
 git commit -m "refactor(web): centralize MPReply visual tokens"
```

### Task 2: Remove obsolete theme/design-gate dead code without weakening objective QA

**Files:**
- Modify: `apps/web/package.json`
- Delete if unused: `apps/web/components/public-site/ThemeToggle.tsx`
- Delete/update: `apps/web/tests/unit/theme-toggle.test.tsx`
- Modify: `.github/workflows/quality-gate.yml`
- Modify: `scripts/check_integrity.py`
- Modify: `scripts/release-gate.ps1`
- Modify: `scripts/web-design-gate.ps1`

**Interfaces:**
- Produces: no Impeccable blocking path; visual regression remains mandatory.

- [ ] **Step 1: Write/extend integrity tests**

Require objective browser gates including `npm run test:visual` and explicitly forbid `design:detect` as a required gate.

```py
for token in [
    "npm run test:e2e",
    "npm run test:a11y",
    "npm run test:visual",
    "npm run lighthouse",
]:
    assert token in workflow
assert "npm run design:detect" not in workflow
```

- [ ] **Step 2: Run integrity check and confirm RED where visual gate is missing**

Run: `python scripts/check_integrity.py`

- [ ] **Step 3: Restore visual regression to GitHub/local release gates**

Add `npm run test:visual` after E2E/a11y setup and before Lighthouse where appropriate. Do not reintroduce Impeccable.

- [ ] **Step 4: Remove unused public ThemeToggle code if repository search shows no runtime consumer**

Run repository search first; only delete after proving it is unused. Preserve dark-theme support needed by authenticated/internal screens.

- [ ] **Step 5: Verify**

Run:
```bash
python scripts/check_integrity.py
cd apps/web
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github apps/web scripts
 git commit -m "ci(web): enforce objective visual quality gates"
```

### Task 3: Align product/design/agent source of truth

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify as needed: `docs/product/public-site-master-brief.md`
- Modify as needed: `docs/seo/public-site-seo-spec.md`

**Interfaces:**
- Produces: authoritative MPReply naming, approved blue design direction, marketplace release dependency, provider-neutral AI marketing rule and updated QA commands.

- [ ] **Step 1: Add a source-of-truth contract test**

Create `apps/web/tests/unit/product-source-of-truth.test.ts` that rejects stale top-level statements such as `Respio`, `Wildberries is current MVP adapter`, `npm run design:detect` and obsolete violet public direction in authoritative docs.

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd apps/web && npm run test:unit -- product-source-of-truth.test.ts`

- [ ] **Step 3: Rewrite authoritative docs**

Document:
- product name MPReply;
- approved blue design system;
- seller-language copy policy;
- all four marketplaces represented as supported in UI, with merge/release blocked until corresponding backend/runtime certification is deployed;
- exact model names are not public marketing claims unless verified runtime capability supplies them;
- objective QA commands including visual regression;
- no Impeccable blocking requirement.

- [ ] **Step 4: Re-run contract**

Run: `cd apps/web && npm run test:unit -- product-source-of-truth.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add PRODUCT.md DESIGN.md AGENTS.md docs apps/web/tests/unit/product-source-of-truth.test.ts
 git commit -m "docs: align MPReply product and design truth"
```

### Task 4: Fix shared navigation/interaction regressions found in review

**Files:**
- Modify: `apps/web/components/public-site/PublicShell.tsx`
- Modify: `apps/web/components/public-site/HomeWorkspaceTabs.tsx`
- Test: `apps/web/tests/unit/home-workspace-tabs.test.tsx`
- Test: `apps/web/e2e/public-site.spec.ts`

**Interfaces:**
- Produces: valid footer destinations and WAI-ARIA keyboard behavior for homepage tabs.

- [ ] **Step 1: Write failing keyboard tests**

Test `ArrowRight`, `ArrowLeft`, `Home`, `End`, selection and focus movement between `Отзывы`, `Вопросы`, `Сообщения`.

- [ ] **Step 2: Write failing footer navigation assertion**

Reject `/#safetygate`; require the current approved destination, e.g. `/#how-it-works` or a real features URL.

- [ ] **Step 3: Run tests and confirm RED**

Run: `cd apps/web && npm run test:unit -- home-workspace-tabs.test.tsx && npm run test:e2e -- public-site.spec.ts`

- [ ] **Step 4: Implement roving-tab keyboard behavior**

Use ordered tab keys and focus refs; clicking and keyboard selection update active tab and focused control consistently.

- [ ] **Step 5: Fix footer link**

Use an existing section ID or page route only.

- [ ] **Step 6: Verify**

Run: `cd apps/web && npm run test:unit -- home-workspace-tabs.test.tsx && npm run test:e2e`

- [ ] **Step 7: Commit**

```bash
git add apps/web/components apps/web/tests apps/web/e2e
 git commit -m "fix(web): harden shared public interactions"
```

### Task 5: Full shared-system verification checkpoint

**Files:** no product changes unless failures identify a real defect.

- [ ] **Step 1: Run static gates**

```bash
cd apps/web
npm run test:frontend
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
```

- [ ] **Step 2: Run browser gates**

```bash
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

- [ ] **Step 3: Run repository/container gate**

Run the repository release/integrity checks and production Compose/image validation used by CI.

- [ ] **Step 4: Review visual diffs intentionally**

Do not update baselines without confirming they match the approved MPReply direction.

- [ ] **Step 5: Commit only real fixes revealed by verification**
