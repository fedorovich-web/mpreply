# MPReply Blue Public Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public homepage and shared public visual tokens into the approved airy blue MPReply direction without inventing capabilities or weakening existing product/security constraints.

**Architecture:** Keep the existing Next.js public shell, SEO helpers and tokenized CSS system. Replace homepage composition with focused presentational sections and a small accessible tab component, while centralizing new blue palette/spacing values in `styles/tokens.css` and homepage/public styles in `styles/public-site.css`.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS custom properties, Vitest/Testing Library, Playwright, axe, Lighthouse CI.

**Spec:** `docs/superpowers/specs/2026-09-12-mpreply-blue-public-redesign-design.md`

## Global Constraints

- Product claims must match `PRODUCT.md`; Wildberries is the current verified MVP execution path.
- Do not claim GPT/Claude/Gemini/DeepSeek are runtime providers unless implemented and verified; current AI generation truth is Groq/Qwen 3.8.
- Marketplace/provider credentials remain backend-only and encrypted.
- Use existing Onest font and one coherent icon system.
- Repeated colors, spacing, gradients, radii and shadows must be tokens.
- No fake metrics, testimonials, ratings, prices, customer counts or unsupported integrations.
- Preserve reduced-motion, semantic HTML, keyboard focus and WCAG AA-oriented contrast.

---

### Task 1: Add homepage contract tests

**Files:**
- Create: `apps/web/tests/unit/public-home-contract.test.ts`
- Test: `apps/web/tests/unit/public-home-contract.test.ts`

**Interfaces:**
- Consumes: source files `app/page.tsx`, `styles/tokens.css`, `styles/public-site.css`.
- Produces: static regression contract for required homepage sections and banned fabricated claims.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const page = readFileSync(join(root, "app/page.tsx"), "utf8");
const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
const publicCss = readFileSync(join(root, "styles/public-site.css"), "utf8");

describe("public homepage redesign contract", () => {
  it("contains the approved product-story sections", () => {
    expect(page).toContain("homepage-workspace");
    expect(page).toContain("homepage-ai-layer");
    expect(page).toContain("homepage-process");
    expect(page).toContain("homepage-outcomes");
    expect(page).toContain("homepage-final-cta");
  });

  it("does not fabricate customer proof or unsupported model providers", () => {
    expect(page).not.toMatch(/50K\+|довольных клиентов|GPT-5\.6|Claude Sonnet 5|Gemini 3\.8|DeepSeek V4/i);
  });

  it("uses blue public tokens and spacious section rhythm", () => {
    expect(tokens).toContain("--color-brand-primary: #2563eb");
    expect(tokens).toContain("--gradient-public-blue");
    expect(tokens).toContain("--public-section-spacing");
    expect(publicCss).toContain(".homepage-process");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- public-home-contract.test.ts`
Expected: FAIL because the approved homepage classes and blue tokens do not exist yet.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/unit/public-home-contract.test.ts
git commit -m "test: define public homepage redesign contract"
```

### Task 2: Update public brand tokens

**Files:**
- Modify: `apps/web/styles/tokens.css`
- Test: `apps/web/tests/design/*`

**Interfaces:**
- Produces: blue brand tokens used by all public components.

- [ ] **Step 1: Replace the public brand primitives**

Set the primary palette around `#2563EB`, deeper interaction state `#1D4ED8`, sky accent `#0EA5E9`, pale section tint, blue focus token and smooth public gradient. Keep semantic success/warning/danger colors independent.

- [ ] **Step 2: Increase public rhythm tokens**

Set desktop major-section spacing to approximately `clamp(6rem, 9vw, 9rem)` while keeping responsive reductions for tablet/mobile.

- [ ] **Step 3: Run design/token tests**

Run: `npm run test:unit -- tests/design`
Expected: PASS after updating any token expectations that encode the superseded violet brand direction.

### Task 3: Build the homepage product-story composition

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/public-site/HomeWorkspaceTabs.tsx`
- Modify: `apps/web/styles/public-site.css`
- Test: `apps/web/tests/unit/public-home-contract.test.ts`

**Interfaces:**
- `HomeWorkspaceTabs` renders semantic tab buttons and tab panels for `reviews`, `questions`, and `all` without external state dependencies.

- [ ] **Step 1: Implement hero and marketplace-readiness strip**

Use left-aligned hero copy plus a CSS/HTML product artifact. Keep one primary hero CTA and one secondary demo action. Do not claim unsupported marketplace readiness.

- [ ] **Step 2: Implement accessible workspace tabs**

Render `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, matching `tabpanel` IDs and keyboard-friendly buttons.

- [ ] **Step 3: Implement AI layer with runtime truth**

Show the actual backend generation stack (`Groq` + `Qwen 3.8`) and explain that provider orchestration is backend-only. Do not list unimplemented providers.

- [ ] **Step 4: Implement asymmetric four-step process**

Use a connected path and four distinct mini-artifacts: marketplace logos/readiness, queue rows, generated reply artifact, auto-send/review switches. Keep steps visually unequal in internal content but equal in semantic importance.

- [ ] **Step 5: Implement factual outcome row, concise final CTA and full footer**

Use mechanics such as one queue, automation/review paths, audit/history and multi-tenant roles rather than invented percentages/customer counts.

- [ ] **Step 6: Verify contract test passes**

Run: `npm run test:unit -- public-home-contract.test.ts`
Expected: PASS.

### Task 4: Responsive, accessibility and interaction hardening

**Files:**
- Modify: `apps/web/styles/public-site.css`
- Modify: `apps/web/components/public-site/HomeWorkspaceTabs.tsx`
- Modify/Create browser tests under `apps/web/e2e/` only where necessary.

**Interfaces:**
- Produces: keyboard-operable tabs, intentional mobile composition and reduced-motion-safe visuals.

- [ ] **Step 1: Add 1024/768/390/320 responsive rules**

Prevent horizontal overflow, reduce hero/product-artifact scale intentionally and keep process readable without a simple four-card vertical dump.

- [ ] **Step 2: Add reduced-motion/focus states**

Disable nonessential transforms when `prefers-reduced-motion: reduce`; ensure tab/button focus visibility uses the shared focus token.

- [ ] **Step 3: Run static quality gates**

Run:
```bash
npm run design:detect
npm run typecheck
npm run lint
npm run build
```
Expected: all exit 0.

- [ ] **Step 4: Run browser quality gates**

Run:
```bash
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```
Expected: all configured suites pass; visual changes are reviewed intentionally rather than blindly regenerated.

### Task 5: Align product/design documentation and finish branch

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`

**Interfaces:**
- Produces: authoritative documentation matching the approved blue public-site direction while retaining capability truth.

- [ ] **Step 1: Update public visual-direction notes**

Document the new blue palette, spacious editorial rhythm, tabbed product demonstration and asymmetric process flow.

- [ ] **Step 2: Preserve capability/readiness truth**

Do not change Wildberries/Ozon/Yandex/AI-provider readiness unless implementation evidence exists elsewhere in the branch.

- [ ] **Step 3: Re-run full verification**

Run the complete static and browser gate set again after docs/code are final.

- [ ] **Step 4: Review diff and open PR**

Confirm no unrelated backend/security changes, no hard-coded secrets and no unsupported marketing claims before opening the pull request.
