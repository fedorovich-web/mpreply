# MPReply Public Site Design Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the MPReply public-site design around the existing Product Pipeline Hero, one coherent homepage story, consistent public-route styling, responsive/dark-mode polish, and removal of the rejected orbital/WebGL Hero path.

**Architecture:** Keep `HeroProductFlowCanvas` as the single production Hero renderer and evolve it in place: three concrete inputs feed one compact processing node and one dominant answer outcome through lightweight Canvas connections. Keep global visual roles in `styles/tokens.css` / `styles/theme.css`, keep page-level composition in `styles/public-site.css`, and keep Hero-specific geometry in its CSS module. Reuse the existing Playwright public-site/a11y/visual suites instead of creating a parallel QA system.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, CSS Modules + shared CSS custom properties, Canvas 2D, Vitest 4, Playwright 1.61, axe, Lighthouse CI.

## Global Constraints

- Work only on `work/0.1.104-yandex-foundation`; do not modify `main` or `develop` directly.
- Project version remains `0.1.103` until release closure; do not bump package versions in this batch.
- No merge, deploy, tag, force-push, or `npm audit fix --force`.
- The production Hero is `buyer question + product context + seller rules -> AI processing -> verified ready answer`.
- Do not reintroduce orbital/WebGL/"AI atom" visuals into production.
- No Three.js/WebGL runtime is needed by the production Hero.
- Keep the current real product image and believable marketplace/product context.
- The ready-answer object is the strongest visual endpoint; the processor must not compete with it.
- Signal motion is directional and restrained; reduced motion must render a complete static scene.
- Required review widths: `1440`, `1280`, `1024`, `768`, `430`, `390`, `375`.
- Dark mode is a semantic adaptation of the same geometry, not a separate art direction.
- Accessibility/performance outrank decoration; no `transition: all`, hover-only critical content, layout-driven animation, or unnecessary heavy runtime.
- The Yandex backend correction, its provider runtime constraints, and protected Question ID `27265525` are out of scope and must not be touched.
- The existing backend strict-Pyright failure is a separate release blocker; frontend success must not be described as a full repository Quality Gate pass until that blocker is resolved.

## File Structure

- `apps/web/components/public-site/HeroProductFlowCanvas.tsx` — semantic Hero objects, Canvas connection lifecycle, pointer/reduced-motion behavior.
- `apps/web/components/public-site/HeroProductFlowCanvas.module.css` — Hero geometry, depth, hierarchy and responsive composition.
- `apps/web/app/page.tsx` — homepage narrative order and resource preview.
- `apps/web/lib/public-resources.ts` — shared resource metadata consumed by `/` and `/resources`.
- `apps/web/app/resources/page.tsx` — resource library consuming shared metadata.
- `apps/web/styles/tokens.css` — semantic Hero/public visual roles shared by light theme.
- `apps/web/styles/theme.css` — dark-theme overrides for the same semantic roles.
- `apps/web/styles/public-site.css` — homepage/public-route section rhythm and shared responsive rules.
- `apps/web/tests/design/public-site-closure.test.ts` — focused source/design contracts for the closure.
- `apps/web/tests/design/design-tokens.test.ts` — existing token/contrast contract; remove obsolete orbital-WebGL assertions/readers.
- `apps/web/e2e/public-site.spec.ts` — responsive behavior, Hero semantics, resources/navigation and overflow checks.
- `apps/web/e2e/accessibility.spec.ts`, `apps/web/e2e/dark-theme-accessibility.spec.ts` — existing representative public accessibility gates.
- `apps/web/e2e/visual.spec.ts` — existing 1440/390 visual baselines for representative public routes.
- `DESIGN.md`, `docs/product/public-site-master-brief.md` — one authoritative Product Pipeline direction.
- Remove after reference verification: `HeroFlowCanvas.tsx`, `HeroFlowCanvas.module.css`, `HeroFlowModel.ts`, `HeroFlowWebGL.ts` and unused `three` / `@types/three` dependencies.

---

### Task 1: Lock the Product Pipeline closure contract with RED design tests

**Files:**
- Create: `apps/web/tests/design/public-site-closure.test.ts`
- Modify later tasks: `apps/web/app/page.tsx`, `apps/web/components/public-site/HeroProductFlowCanvas.tsx`, docs/package files

**Interfaces:**
- Consumes: current homepage source, Product Pipeline source, design docs and `package.json` as UTF-8 text.
- Produces: a stable source-level contract that later tasks must satisfy without introducing another Hero implementation.

- [ ] **Step 1: Create the failing closure contract**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const home = read("app/page.tsx");
const hero = read("components/public-site/HeroProductFlowCanvas.tsx");
const heroCss = read("components/public-site/HeroProductFlowCanvas.module.css");
const design = read("../../DESIGN.md");
const brief = read("../../docs/product/public-site-master-brief.md");

describe("public-site design closure", () => {
  it("uses only the Product Pipeline Hero on the homepage", () => {
    expect(home).toContain('HeroProductFlowCanvas');
    expect(home).not.toContain('HeroFlowCanvas');
  });

  it("models question, product, seller rules, processing and answer as explicit Hero roles", () => {
    for (const role of ["question", "product", "rules", "engine", "answer"]) {
      expect(hero).toContain(`data-flow-role="${role}"`);
    }
  });

  it("pauses ambient Hero animation outside the visible page lifecycle", () => {
    expect(hero).toContain("IntersectionObserver");
    expect(hero).toContain('document.addEventListener("visibilitychange"');
    expect(hero).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps the Product Pipeline lightweight", () => {
    expect(hero).not.toContain("THREE");
    expect(hero).not.toContain("WebGL");
    expect(heroCss).not.toContain("transition: all");
  });

  it("makes Product Pipeline the current documentation authority", () => {
    expect(design).toContain("Product Pipeline");
    expect(brief).toContain("Product Pipeline");
    expect(design).toContain("orbital/WebGL Hero is rejected");
  });

  it("surfaces practical resources in the homepage story", () => {
    expect(home).toContain('href="/resources"');
    expect(home).toContain("home-resources");
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run from `apps/web`:

```bash
npx vitest run tests/design/public-site-closure.test.ts
```

Expected: FAIL because `data-flow-role="rules"`, lifecycle pausing, homepage resources and final documentation wording are not all present yet.

- [ ] **Step 3: Commit the RED contract only**

```bash
git add apps/web/tests/design/public-site-closure.test.ts
git commit -m "test(public-site): lock design closure contract"
```

---

### Task 2: Rebuild Hero hierarchy around three inputs, one compact processor and one dominant answer

**Files:**
- Modify: `apps/web/components/public-site/HeroProductFlowCanvas.tsx`
- Modify: `apps/web/components/public-site/HeroProductFlowCanvas.module.css`
- Modify: `apps/web/styles/tokens.css`
- Modify: `apps/web/styles/theme.css`
- Test: `apps/web/tests/design/public-site-closure.test.ts`
- Test: `apps/web/tests/design/design-tokens.test.ts`

**Interfaces:**
- Consumes: existing product image `/brand/mpreply-hero-sneakers.webp`, current question/product/answer content and Canvas anchors.
- Produces: DOM anchors with `data-flow-role="question|product|rules|engine|answer"`; the Canvas lifecycle in Task 3 will connect these same anchors.

- [ ] **Step 1: Extend the RED test with hierarchy assertions**

Add to `public-site-closure.test.ts`:

```ts
it("keeps seller rules concise and the answer as the endpoint", () => {
  expect(hero).toContain("Правила продавца");
  expect(hero).toContain("Без неподтверждённых обещаний");
  expect(hero).toContain("Только по данным");
  expect(hero).toContain("Ответ готов к публикации");
  expect(heroCss).toContain(".rulesCard");
  expect(heroCss).toContain(".answerCard");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run tests/design/public-site-closure.test.ts
```

Expected: FAIL on the missing rules object and revised hierarchy contract.

- [ ] **Step 3: Add semantic Hero visual tokens**

Add light-theme roles to `styles/tokens.css` using existing color/shadow primitives rather than new hard-coded palette values:

```css
--hero-flow-scene-surface: var(--color-bg-subtle);
--hero-flow-input-surface: var(--color-bg-surface);
--hero-flow-engine-surface: var(--color-text-primary);
--hero-flow-engine-text: var(--color-text-on-brand);
--hero-flow-answer-surface: var(--color-bg-surface);
--hero-flow-evidence-surface: var(--color-bg-subtle);
--hero-flow-line-input: var(--color-brand-primary);
--hero-flow-line-output: var(--color-success);
--hero-flow-shadow: var(--shadow-home-stage);
```

Add the same keys to the `[data-theme="dark"]` custom-property block in `styles/theme.css`, mapping them to existing dark semantic surfaces/text roles. Do not add component selectors to `theme.css`.

- [ ] **Step 4: Restructure Hero markup without changing the factual scenario**

In `HeroProductFlowCanvas.tsx`:

- preserve the current buyer question;
- preserve the real sneaker image and product facts;
- add a compact seller-rules object containing exactly three short constraints;
- add `data-flow-role` attributes to all five semantic anchors;
- keep the processor limited to three checks: intent, evidence, rules/risk;
- keep the current concrete ready answer and evidence; do not invent a new metric or claim.

The resulting structural shape is:

```tsx
<div className={styles.inputCluster}>
  <article data-flow-role="question" ref={questionRef}>...</article>
  <article data-flow-role="product" ref={productRef}>...</article>
  <article data-flow-role="rules" ref={rulesRef}>...</article>
</div>
<div className={styles.engineWrap}>
  <article data-flow-role="engine" ref={engineRef}>...</article>
</div>
<div className={styles.answerWrap}>
  <article data-flow-role="answer" className={styles.answerCard}>...</article>
</div>
```

- [ ] **Step 5: Change only composition/hierarchy in the CSS module**

Implement these measurable relationships:

- desktop scene remains approximately the current width/height footprint and does not become a full bordered container;
- input cluster is visually smaller than the answer region;
- processor width is smaller than answer width and its height is content-driven rather than approximately `29rem`;
- answer receives the strongest `var(--hero-flow-shadow)` elevation;
- decorative borders are removed where tonal separation/shadow is sufficient;
- evidence rows use `--hero-flow-evidence-surface` rather than nested framed cards;
- retain the existing real-product image treatment;
- keep all transforms/transition properties explicit.

- [ ] **Step 6: Run focused design tests**

```bash
npm run test:design-tokens
```

Expected: PASS for the new hierarchy contract; existing token/contrast tests remain green.

- [ ] **Step 7: Commit the Hero hierarchy**

```bash
git add apps/web/components/public-site/HeroProductFlowCanvas.tsx \
  apps/web/components/public-site/HeroProductFlowCanvas.module.css \
  apps/web/styles/tokens.css apps/web/styles/theme.css \
  apps/web/tests/design/public-site-closure.test.ts
git commit -m "feat(public-site): refine product pipeline hero"
```

---

### Task 3: Make signal motion quieter, lifecycle-aware and reduced-motion complete

**Files:**
- Modify: `apps/web/components/public-site/HeroProductFlowCanvas.tsx`
- Modify: `apps/web/components/public-site/HeroProductFlowCanvas.module.css`
- Test: `apps/web/tests/design/public-site-closure.test.ts`
- Test: `apps/web/tests/design/design-tokens.test.ts`

**Interfaces:**
- Consumes: the five `data-flow-role` anchors from Task 2.
- Produces: a Canvas renderer that runs only when visible/active, draws a static complete scene for reduced motion, and keeps pointer parallax as progressive enhancement.

- [ ] **Step 1: Add RED motion-budget assertions**

Add:

```ts
it("keeps signal density and glow below the previous Hero baseline", () => {
  expect(hero).toContain("const PARTICLE_COUNT = 18");
  expect(hero).toContain("const FLOW_GLOW_WIDTH = 6");
  expect(hero).toContain("const FLOW_LINE_WIDTH = 1.75");
});
```

Also update the obsolete existing assertion in `design-tokens.test.ts` from:

```ts
expect(productFlowSource).not.toContain("IntersectionObserver");
```

to:

```ts
expect(productFlowSource).toContain("IntersectionObserver");
expect(productFlowSource).toContain('document.addEventListener("visibilitychange"');
```

- [ ] **Step 2: Verify RED**

```bash
npm run test:design-tokens
```

Expected: FAIL until the new constants/lifecycle are implemented.

- [ ] **Step 3: Replace the implicit 34-particle setup with explicit bounded constants**

Use:

```ts
const PARTICLE_COUNT = 18;
const FLOW_GLOW_WIDTH = 6;
const FLOW_LINE_WIDTH = 1.75;

const PARTICLES: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
  lane: index % 6,
  offset: (index * 0.173) % 1,
  speed: 0.018 + (index % 5) * 0.0035,
  radius: 1.1 + (index % 2) * 0.25,
}));
```

Use the constants inside `drawConnection`; reduce glow opacity/shadow proportionally instead of introducing another animation library.

- [ ] **Step 4: Add visibility/page lifecycle control**

Inside the existing `useEffect`:

```ts
let inViewport = true;
let documentVisible = document.visibilityState === "visible";

const shouldAnimate = () => !reducedMotion && inViewport && documentVisible;

const visibilityObserver = new IntersectionObserver(([entry]) => {
  inViewport = Boolean(entry?.isIntersecting);
  if (inViewport) requestFrame();
});

const onVisibilityChange = () => {
  documentVisible = document.visibilityState === "visible";
  if (documentVisible) requestFrame();
};

document.addEventListener("visibilitychange", onVisibilityChange);
visibilityObserver.observe(scene);
```

Make `requestFrame()` idempotent so only one RAF is pending. When animation is not allowed, draw one static complete scene and stop requesting frames. Disconnect/remove listeners in cleanup.

- [ ] **Step 5: Keep reduced motion complete**

When `prefers-reduced-motion` is active:

- reset pointer offsets;
- draw all six connections in a stable static state;
- do not advance particles;
- keep all five semantic objects visible.

- [ ] **Step 6: Run design tests and typecheck**

```bash
npm run test:design-tokens
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit lifecycle-safe motion**

```bash
git add apps/web/components/public-site/HeroProductFlowCanvas.tsx \
  apps/web/components/public-site/HeroProductFlowCanvas.module.css \
  apps/web/tests/design/public-site-closure.test.ts \
  apps/web/tests/design/design-tokens.test.ts
git commit -m "fix(public-site): calm hero signal motion"
```

---

### Task 4: Normalize homepage story and add a real Resources layer

**Files:**
- Create: `apps/web/lib/public-resources.ts`
- Modify: `apps/web/app/resources/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/styles/public-site.css`
- Test: `apps/web/tests/design/public-site-closure.test.ts`
- Test: `apps/web/e2e/public-site.spec.ts`

**Interfaces:**
- Produces: `publicResources`, a readonly resource metadata array shared by `/resources` and the homepage preview.
- Consumes: existing `MarketingGlyph`, `Link`, `PublicShell` and resource copy already present on `/resources`.

- [ ] **Step 1: Add RED homepage-story assertions**

Extend `public-site-closure.test.ts`:

```ts
it("orders the homepage around coverage, outcomes, proof and resources", () => {
  const heroIndex = home.indexOf('className="home-hero"');
  const coverageIndex = home.indexOf('className="home-section home-marketplace-proof"');
  const outcomesIndex = home.indexOf('className="home-section home-outcomes"');
  const resourcesIndex = home.indexOf('className="home-section home-resources"');
  const faqIndex = home.indexOf('className="home-section home-faq"');

  expect(heroIndex).toBeGreaterThanOrEqual(0);
  expect(coverageIndex).toBeGreaterThan(heroIndex);
  expect(outcomesIndex).toBeGreaterThan(coverageIndex);
  expect(resourcesIndex).toBeGreaterThan(outcomesIndex);
  expect(faqIndex).toBeGreaterThan(resourcesIndex);
});
```

Update `e2e/public-site.spec.ts` so the breakpoint loop also requires:

```ts
await expect(page.getByRole("heading", { name: "Работайте с обращениями с нескольких площадок" })).toBeVisible();
await expect(page.getByRole("heading", { name: "Практические материалы для команды продавца" })).toBeVisible();
await expect(page.getByRole("link", { name: "Все материалы" })).toHaveAttribute("href", "/resources");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/design/public-site-closure.test.ts
npx playwright test e2e/public-site.spec.ts --project=chromium --grep "homepage keeps"
```

Expected: FAIL because the coverage/resources sections and headings do not yet exist in this order.

- [ ] **Step 3: Extract the existing resource data instead of duplicating copy**

Create `lib/public-resources.ts`:

```ts
export const publicResources = [
  {
    icon: "reviews" as const,
    label: "Гайд",
    title: "Как отвечать на отзывы без шаблонных фраз",
    text: "Структура сильного ответа, работа с оценкой, повторной покупкой и негативом без лишних обещаний.",
  },
  {
    icon: "questions" as const,
    label: "Чек-лист",
    title: "Какие данные нужны ИИ для точного ответа о товаре",
    text: "Характеристики, инструкции, FAQ, ограничения и правила, которые снижают риск выдуманных фактов.",
  },
  {
    icon: "settings" as const,
    label: "Методика",
    title: "Как настроить безопасную автопубликацию",
    text: "Стоп-темы, категории риска, сценарии автопубликации и настройки согласования.",
  },
  {
    icon: "chats" as const,
    label: "Практика",
    title: "Чаты покупателей: где ИИ помогает, а где нужен менеджер",
    text: "Типовые вопросы, сохранение контекста диалога, эскалация и контроль обещаний продавца.",
  },
  {
    icon: "history" as const,
    label: "Аудит",
    title: "Какие метрики показывают качество автоматизации",
    text: "Доля автопубликации, правки, эскалации, скорость ответа и повторяющиеся пробелы в данных.",
  },
  {
    icon: "context" as const,
    label: "Шаблон",
    title: "Структура базы знаний продавца",
    text: "Как хранить информацию о товарах, совместимости, возвратах и ограничениях, чтобы ответы были единообразными.",
  },
] as const;
```

Change `/resources` to import this array and remove its local duplicate.

- [ ] **Step 4: Move marketplace coverage directly below Hero**

In `app/page.tsx`, create a concise `home-marketplace-proof` section immediately after Hero. Reuse the existing four marketplace source labels and move them out of the later workflow section so there is only one coverage proof block.

Use the exact heading:

```tsx
<h2>Работайте с обращениями с нескольких площадок</h2>
```

Keep the actual marketplace claims aligned with current launch/public truth; do not add readiness badges or fabricated counts.

- [ ] **Step 5: Add Resources preview before FAQ**

Import `publicResources`, render `publicResources.slice(0, 3)`, and include:

```tsx
<section className="home-section home-resources" aria-labelledby="home-resources-title">
  <div className="public-container">
    <div className="home-section-heading home-section-heading-left">
      <p className="public-eyebrow">Практика</p>
      <h2 id="home-resources-title">Практические материалы для команды продавца</h2>
    </div>
    <div className="home-resource-preview">
      {publicResources.slice(0, 3).map(/* existing MarketingGlyph + text */)}
    </div>
    <Link href="/resources">Все материалы</Link>
  </div>
</section>
```

Place it after pricing and before FAQ.

- [ ] **Step 6: Add shared public styles with deliberate rhythm**

In `styles/public-site.css`:

- make marketplace proof a compact tonal band rather than another card grid;
- make resource preview an editorial 3-column layout on desktop, 2/1 columns responsively;
- use existing semantic tokens/shadows/radii;
- do not add decorative 1px borders as the primary separation mechanism;
- preserve current public section spacing tokens.

- [ ] **Step 7: Run focused frontend tests**

```bash
npm run test:frontend
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit homepage story**

```bash
git add apps/web/lib/public-resources.ts apps/web/app/resources/page.tsx \
  apps/web/app/page.tsx apps/web/styles/public-site.css \
  apps/web/tests/design/public-site-closure.test.ts apps/web/e2e/public-site.spec.ts
git commit -m "feat(public-site): close homepage narrative"
```

---

### Task 5: Apply one responsive/light-dark system across public routes

**Files:**
- Modify: `apps/web/styles/public-site.css`
- Modify: `apps/web/styles/tokens.css`
- Modify: `apps/web/styles/theme.css`
- Modify only if required by shared markup contract: `apps/web/components/public-site/PublicShell.tsx`
- Test: `apps/web/e2e/public-site.spec.ts`
- Test: `apps/web/e2e/accessibility.spec.ts`
- Test: `apps/web/e2e/dark-theme-accessibility.spec.ts`

**Interfaces:**
- Consumes: the existing `PUBLIC_ROUTES` list containing `/`, features, marketplaces + detail routes, pricing, demo, resources, blog, about, contacts and legal routes.
- Produces: shared spacing/control/surface behavior inherited by the existing public pages; no page-specific second design system.

- [ ] **Step 1: Add RED semantic shell checks to the existing public E2E loop**

Inside the `for (const route of PUBLIC_ROUTES)` test, add:

```ts
await expect(page.locator(".public-shell")).toHaveCount(1);
await expect(page.locator(".public-container").first()).toBeVisible();
```

If `PublicShell` currently lacks the `.public-shell` hook, this must fail first and will be added to that component, not duplicated per page.

- [ ] **Step 2: Verify RED**

```bash
npx playwright test e2e/public-site.spec.ts --project=chromium --grep "renders a valid public page"
```

Expected: FAIL only where the shared shell hook/contract is missing.

- [ ] **Step 3: Normalize shared public surfaces and spacing**

In `public-site.css` and token files:

- keep one `public-container` width system;
- keep one public eyebrow geometry;
- keep shared button geometry/focus states;
- normalize shared section top/bottom spacing through `--public-section-spacing` rather than route-local literals;
- keep legal pages denser only through an existing semantic modifier, not a new palette;
- preserve existing public subhero classes and remove redundant route-local overrides only when the same visual role already exists globally.

Do not redesign dashboard styles in `globals.css`.

- [ ] **Step 4: Harden responsive Hero checks at the required widths**

Keep the existing loop widths and add these assertions for `375..1440`:

```ts
for (const role of ["question", "product", "rules", "engine", "answer"]) {
  await expect(page.locator(`[data-flow-role="${role}"]`)).toBeVisible();
}

const heroScene = page.getByTestId("hero-product-flow");
const heroBox = await heroScene.boundingBox();
expect(heroBox?.width ?? 0).toBeGreaterThan(280);
```

At mobile widths do not assert desktop coordinates; assert narrative visibility and zero overflow.

- [ ] **Step 5: Run public E2E and both accessibility themes**

```bash
npm run test:e2e
npm run test:a11y
```

Expected: PASS for public routes and representative dark-theme routes.

- [ ] **Step 6: Commit shared public polish**

```bash
git add apps/web/styles/public-site.css apps/web/styles/tokens.css apps/web/styles/theme.css \
  apps/web/components/public-site/PublicShell.tsx apps/web/e2e/public-site.spec.ts
git commit -m "fix(public-site): unify responsive visual system"
```

---

### Task 6: Remove rejected orbital/WebGL Hero code and reconcile design authority

**Files:**
- Delete after reference check: `apps/web/components/public-site/HeroFlowCanvas.tsx`
- Delete after reference check: `apps/web/components/public-site/HeroFlowCanvas.module.css`
- Delete after reference check: `apps/web/components/public-site/HeroFlowModel.ts`
- Delete after reference check: `apps/web/components/public-site/HeroFlowWebGL.ts`
- Modify: `apps/web/tests/design/design-tokens.test.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Modify: `DESIGN.md`
- Modify: `docs/product/public-site-master-brief.md`
- Test: `apps/web/tests/design/public-site-closure.test.ts`

**Interfaces:**
- Consumes: Task 1 contract proving homepage is already on `HeroProductFlowCanvas`.
- Produces: no competing current Hero implementation or documentation contract; `three` is removed only if it has no non-legacy consumer.

- [ ] **Step 1: Prove the legacy renderer has no live consumer before deletion**

Run from repository root:

```bash
git grep -n -E 'HeroFlowCanvas|HeroFlowWebGL|HeroFlowModel|from "three"|from '\''three'\''' -- ':!docs/**' ':!DESIGN.md' ':!apps/web/tests/design/**'
```

Expected before deletion: matches are limited to the four legacy Hero files and any direct legacy imports among them. If a non-legacy production consumer appears, do not delete its dependency in this task; isolate that consumer first.

- [ ] **Step 2: Make the design test RED for zero legacy production artifacts**

Add to `public-site-closure.test.ts` using `existsSync`:

```ts
import { existsSync } from "node:fs";

it("ships no rejected orbital Hero implementation", () => {
  for (const path of [
    "components/public-site/HeroFlowCanvas.tsx",
    "components/public-site/HeroFlowCanvas.module.css",
    "components/public-site/HeroFlowModel.ts",
    "components/public-site/HeroFlowWebGL.ts",
  ]) {
    expect(existsSync(resolve(process.cwd(), path))).toBe(false);
  }
});
```

Run it and verify FAIL while those files still exist.

- [ ] **Step 3: Delete the four unused legacy Hero files**

Delete only the four paths listed above.

- [ ] **Step 4: Remove obsolete test readers/assertions**

In `design-tokens.test.ts` remove:

- `canvasSource`;
- `canvasModelSource`;
- `canvasWebglSource`;
- `canvasSceneSources`;
- assertions that describe the old orbital/WebGL scene.

Keep and strengthen the Product Pipeline tests.

- [ ] **Step 5: Remove Three.js dependencies if the reference check is clean**

From `apps/web`:

```bash
npm uninstall three @types/three
```

Expected: `package.json` and `package-lock.json` no longer contain direct `three` / `@types/three` entries, and project version remains `0.1.103`.

- [ ] **Step 6: Replace competing design-history authority with one current section**

In `DESIGN.md`, preserve useful historical notes only under a clearly historical/rejected heading and add an authoritative current statement containing exactly:

```md
## Current public Hero · Product Pipeline

The production Hero is Product Pipeline: buyer question + product context + seller rules -> AI processing -> verified ready answer. The ready answer is the visual endpoint. The orbital/WebGL Hero is rejected and is not a current production direction.
```

In `docs/product/public-site-master-brief.md`, replace the Orbital Ribbon/WebGL Hero contract with the same Product Pipeline narrative and the motion/accessibility rules from the approved spec.

- [ ] **Step 7: Run design, dependency and build checks**

```bash
npm run test:design-tokens
npm run typecheck
npm run lint
npm run build
npm ls three
```

Expected: design/type/lint/build PASS; `npm ls three` exits non-zero or reports an empty tree because the unused dependency was removed.

- [ ] **Step 8: Commit legacy cleanup**

```bash
git add -A apps/web/components/public-site apps/web/tests/design apps/web/package.json \
  apps/web/package-lock.json DESIGN.md docs/product/public-site-master-brief.md
git commit -m "chore(public-site): remove rejected orbital hero"
```

---

### Task 7: Run exact frontend closure gates and prepare visual acceptance evidence

**Files:**
- Modify only when a failing gate reveals a closure defect: files from Tasks 2-6.
- Update visual snapshots only after reviewing the rendered differences: `apps/web/e2e/visual.spec.ts-snapshots/*`.

**Interfaces:**
- Consumes: completed Product Pipeline, homepage story, shared public system and cleaned design authority.
- Produces: verified frontend closure evidence; it does not claim repository-wide Quality Gate success while backend strict Pyright is failing.

- [ ] **Step 1: Run static/unit/design frontend gate**

From `apps/web`:

```bash
npm ci
npm run test:frontend
npm run design:detect
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
```

Expected: every command PASS. Do not suppress Impeccable/design findings; fix any closure-relevant finding in the responsible task area.

- [ ] **Step 2: Run browser behavior and accessibility**

```bash
npm run test:e2e
npm run test:a11y
```

Expected: PASS, including zero horizontal overflow and visible Hero roles across the existing responsive loop.

- [ ] **Step 3: Review the seven required widths in reduced-motion mode**

Use the existing `homepage keeps the approved Hero...` Playwright loop as the automated guard for:

```text
1440, 1280, 1024, 768, 430, 390, 375
```

For human review, inspect screenshots at those widths and check:

- H1 wrapping;
- copy/scene overlap;
- visibility of question/product/rules/engine/answer;
- final-answer dominance;
- no clipped product image or evidence rows;
- deliberate mobile composition rather than simple desktop stacking;
- no horizontal overflow.

- [ ] **Step 4: Review representative public routes in both themes**

Review at minimum:

```text
/, /features, /marketplaces, /pricing, /demo, /resources
```

Check light and dark semantic surfaces, typography, buttons, focus, section rhythm and footer/header continuity.

- [ ] **Step 5: Regenerate visual baselines only after the visual diff is accepted**

First run:

```bash
npm run test:visual
```

Expected: screenshots may fail because the intended public design changed. Review those diffs. Only after the rendered result is visually accepted run:

```bash
npm run test:visual:update
npm run test:visual
```

Expected after intentional snapshot update: PASS. Never update snapshots merely to silence unexplained differences.

- [ ] **Step 6: Run Lighthouse**

```bash
npm run lighthouse
```

Expected: PASS under the repository's existing thresholds; the Hero must not introduce a heavy 3D bundle or new layout instability.

- [ ] **Step 7: Commit accepted visual baselines, if they changed**

```bash
git add apps/web/e2e/visual.spec.ts-snapshots
git commit -m "test(public-site): accept design closure baselines"
```

Skip this commit if no visual snapshot file changed.

- [ ] **Step 8: Record scope-accurate completion status**

Completion statement must distinguish:

```text
Public-site frontend closure gates: PASS
Repository-wide Quality Gate: NOT YET GREEN while the separate backend strict-Pyright blocker remains
Version: still 0.1.103
No merge/deploy/tag performed
```

Do not close/freeze the public design until the user explicitly approves the rendered site.
