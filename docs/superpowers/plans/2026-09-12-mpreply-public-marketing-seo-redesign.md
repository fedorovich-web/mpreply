# MPReply Public Marketing and SEO Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every public MPReply route in the approved light-blue visual system and rewrite all public copy, SEO and marketing around real competitor/category patterns and verified product truth.

**Architecture:** Keep the existing Next.js App Router/public shell and SEO helpers. Build page-specific editorial compositions rather than one repeated template. Create a competitor/message research artifact first, then implement route-by-route copy, metadata, internal links and visual composition, with public UI demonstrations remaining semantic React/HTML where interaction matters and generated WebP assets used only for decorative/product-art needs.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Next Metadata, JSON-LD, Vitest, Playwright, axe, Lighthouse CI.

**Spec:** `docs/superpowers/specs/2026-09-12-mpreply-full-product-redesign-copy-seo-design.md`

**Shared-system prerequisite:** `docs/superpowers/plans/2026-09-12-mpreply-shared-design-system-and-governance.md`

## Global Constraints

- Latest approved homepage preview is the visual source of truth for all public pages.
- Public pages must share design language but must not be mechanically identical templates.
- Copy is competitor-informed, not invented generic SaaS copy and not copied verbatim.
- No unsupported metrics, customer counts, trial periods, discounts, testimonials, provider/model claims or production-readiness claims.
- Hero uses `mpreply-hero-ui.webp` and no competing active wave background.
- Closing CTA may use `mpreply-cta-ui.webp` plus restrained `mpreply-cta-waves.webp`.
- Natural Russian SEO phrasing; no keyword stuffing.
- One visible H1 per indexable page; unique metadata and useful internal linking.
- Legal pages retain legal meaning and are not rewritten into marketing language.

---

### Task 1: Build the competitor copy and page-intent matrix

**Files:**
- Create: `docs/marketing/2026-09-mpreply-competitor-copy-matrix.md`
- Create: `docs/marketing/2026-09-mpreply-page-message-map.md`

**Interfaces:**
- Consumes: live/current competitor websites and category search language.
- Produces: source-backed patterns and page-level messaging used by every public route.

- [ ] **Step 1: Research direct Russian competitors**

Review current public messaging for MPReviews, Spix, ReviewerBot, Comenta, SmartReply and OTVETO. Capture for each:
- hero promise;
- problem framing;
- feature→benefit framing;
- integrations named;
- proof/claim style;
- CTA wording;
- pricing/onboarding framing;
- obvious weaknesses or vague claims.

- [ ] **Step 2: Research adjacent international competitors**

Review Gorgias, eDesk, ReplyDesk, ChannelReply and other relevant marketplace/helpdesk products. Capture the same dimensions, especially one-inbox, context, automation, handoff and operational visibility patterns.

- [ ] **Step 3: Write the matrix with source URLs and retrieval date**

Do not reproduce long competitor passages. Paraphrase positioning patterns and quote only short fragments where necessary.

- [ ] **Step 4: Produce the MPReply page message map**

For `/`, `/features`, `/marketplaces`, each marketplace page, `/pricing`, `/demo`, `/resources`, `/contacts`, define:
- search/user intent;
- primary problem;
- primary promise;
- proof/mechanism;
- objections to answer;
- primary CTA;
- internal-link destinations;
- banned unsupported claims.

- [ ] **Step 5: Commit research artifacts**

```bash
git add docs/marketing
 git commit -m "docs(marketing): map competitor copy and public intent"
```

### Task 2: Lock public SEO/copy contracts before route rewrites

**Files:**
- Modify/Create: `apps/web/tests/unit/public-pages-redesign-contract.test.ts`
- Create: `apps/web/tests/unit/public-seo-copy-contract.test.ts`
- Modify: `apps/web/tests/unit/public-home-contract.test.ts`

**Interfaces:**
- Produces: static regression coverage for naming, stale jargon, unsupported claims, page-specific H1/metadata expectations and internal-link destinations.

- [ ] **Step 1: Add banned-copy assertions**

Reject public occurrences of stale phrases such as `Respio`, `MVP adapter`, `production-ready`, `worker`, `SafetyGate`, `backend-only`, fake trial claims and unsupported model strips.

- [ ] **Step 2: Add route-specific content expectations**

Examples:
```ts
expect(home).toContain("Автоответы на отзывы");
expect(features).toContain("единая очередь");
expect(marketplaces).toContain("Wildberries");
expect(marketplaces).toContain("Ozon");
expect(resources).toMatch(/Блог|Материалы/);
```

Use final copy from the message map, not placeholders.

- [ ] **Step 3: Run unit suite and confirm RED**

Run: `cd apps/web && npm run test:unit`

- [ ] **Step 4: Commit RED contracts**

```bash
git add apps/web/tests/unit
 git commit -m "test(web): define public marketing and SEO contracts"
```

### Task 3: Finalize shared public shell, header and footer

**Files:**
- Modify: `apps/web/components/public-site/PublicHeader.tsx`
- Modify: `apps/web/components/public-site/PublicShell.tsx`
- Modify: `apps/web/lib/site-config.ts`
- Modify: `apps/web/styles/marketing-site.css`
- Test: `apps/web/e2e/public-site.spec.ts`

**Interfaces:**
- Produces: MPReply navigation, active states, login/onboarding CTAs, complete footer and valid route links shared by all public pages.

- [ ] **Step 1: Implement final navigation IA**

Use concise Russian labels: `Возможности`, `Интеграции`, `Тарифы`, `Блог`, `Помощь`; keep `Войти` and `Создать аккаунт` distinct.

- [ ] **Step 2: Complete footer IA**

Ensure product, integrations, resources/support and legal groups link only to real destinations. Remove stale `/#safetygate` anchor.

- [ ] **Step 3: Verify responsive menu and active-route behavior**

Run targeted E2E for desktop/mobile header/menu/navigation.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/public-site apps/web/lib/site-config.ts apps/web/styles/marketing-site.css apps/web/e2e/public-site.spec.ts
 git commit -m "feat(web): finalize MPReply public shell"
```

### Task 4: Finalize homepage exactly in approved direction

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/public-site/HomeWorkspaceTabs.tsx`
- Modify: `apps/web/styles/homepage-approved.css`
- Use: `apps/web/public/images/mpreply-hero-ui.webp`
- Use: `apps/web/public/images/mpreply-cta-ui.webp`
- Use: `apps/web/public/images/mpreply-cta-waves.webp`
- Test: `apps/web/tests/unit/public-home-contract.test.ts`
- Test: `apps/web/tests/unit/home-workspace-tabs.test.tsx`
- Test: `apps/web/e2e/public-site.spec.ts`

**Interfaces:**
- Produces: approved hero, marketplace strip, interactive unified inbox, provider-neutral AI/context section, connected process journey, factual outcomes and closing CTA.

- [ ] **Step 1: Remove unsupported hard-coded AI provider/model marketing strip**

Replace exact unverified provider names with mechanism-oriented copy from the message map unless runtime configuration in the final integration branch supplies verified names.

- [ ] **Step 2: Preserve approved Hero composition**

Keep hero WebP, no second wave background, approved section spacing and CTA hierarchy.

- [ ] **Step 3: Preserve real interactive workspace tabs**

Use semantic tab keyboard support and realistic review/question/message examples without fake metrics.

- [ ] **Step 4: Keep `Как это работает` as connected horizontal journey**

Do not regress to equal generic cards.

- [ ] **Step 5: Verify home unit/E2E/a11y tests**

Run:
```bash
cd apps/web
npm run test:unit -- public-home-contract.test.ts home-workspace-tabs.test.tsx
npm run test:e2e
npm run test:a11y
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/public-site apps/web/styles/homepage-approved.css apps/web/tests apps/web/e2e
 git commit -m "feat(web): finalize approved MPReply homepage"
```

### Task 5: Redesign `/features` around seller jobs

**Files:**
- Modify: `apps/web/app/features/page.tsx`
- Modify: `apps/web/styles/marketing-pages.css`
- Test: `apps/web/tests/unit/public-pages-redesign-contract.test.ts`

**Interfaces:**
- Produces: unique feature page covering unified queue, context, automation, review path, team workflow, analytics/history and integration reliability.

- [ ] **Step 1: Rewrite metadata/H1 from the message map**
- [ ] **Step 2: Build job-oriented sections instead of repeated feature cards**
- [ ] **Step 3: Add contextual internal links to marketplace/demo/pricing pages**
- [ ] **Step 4: Run unit/W3C checks**
- [ ] **Step 5: Commit**

```bash
git add apps/web/app/features/page.tsx apps/web/styles/marketing-pages.css apps/web/tests
 git commit -m "feat(web): redesign MPReply features page"
```

### Task 6: Redesign marketplace hub and four marketplace pages with unique intent

**Files:**
- Modify: `apps/web/app/marketplaces/page.tsx`
- Modify: `apps/web/components/public-site/MarketplaceLanding.tsx`
- Modify: `apps/web/app/marketplaces/wildberries/page.tsx`
- Modify: `apps/web/app/marketplaces/ozon/page.tsx`
- Modify: `apps/web/app/marketplaces/yandex-market/page.tsx`
- Modify: `apps/web/app/marketplaces/avito/page.tsx`
- Modify: `apps/web/styles/marketing-pages.css`
- Test: `apps/web/tests/unit/public-pages-redesign-contract.test.ts`

**Interfaces:**
- Produces: hub discovery page plus four pages with unique metadata, H1, marketplace-specific workflow copy and FAQ where justified.

- [ ] **Step 1: Implement hub copy and supported marketplace presentation**
- [ ] **Step 2: Write unique Wildberries page**
- [ ] **Step 3: Write unique Ozon page**
- [ ] **Step 4: Write unique Яндекс Маркет page**
- [ ] **Step 5: Write unique Авито page**
- [ ] **Step 6: Add page-specific internal links and structured data**
- [ ] **Step 7: Verify no mechanically duplicated marketplace body copy**
- [ ] **Step 8: Commit**

```bash
git add apps/web/app/marketplaces apps/web/components/public-site/MarketplaceLanding.tsx apps/web/styles/marketing-pages.css apps/web/tests
 git commit -m "feat(web): redesign marketplace marketing pages"
```

### Task 7: Redesign `/pricing` without fake commercial claims

**Files:**
- Modify: `apps/web/app/pricing/page.tsx`
- Modify: `apps/web/styles/marketing-pages.css`

**Interfaces:**
- Produces: clear pricing-model explanation based only on configured/known commercial truth.

- [ ] **Step 1: Rewrite metadata/H1**
- [ ] **Step 2: Explain usage dimensions and plan logic without invented prices**
- [ ] **Step 3: Remove fake `popular`, discounts, free-trial periods or unsupported tiers**
- [ ] **Step 4: Add CTA to real onboarding/contact path**
- [ ] **Step 5: Verify W3C/a11y**
- [ ] **Step 6: Commit**

### Task 8: Redesign `/demo` as a realistic product workflow

**Files:**
- Modify: `apps/web/app/demo/page.tsx`
- Modify/Create small presentational components under: `apps/web/components/public-site/`
- Modify: `apps/web/styles/marketing-pages.css`
- Test: `apps/web/e2e/public-site.spec.ts`

**Interfaces:**
- Produces: realistic review/question/message scenarios, prepared reply and automatic-vs-review decision that resemble actual product UX.

- [ ] **Step 1: Define three realistic seller scenarios**
- [ ] **Step 2: Implement semantic interactive/demo composition**
- [ ] **Step 3: Remove technical telemetry and invented outcomes**
- [ ] **Step 4: Verify mobile/a11y/E2E**
- [ ] **Step 5: Commit**

### Task 9: Turn `/resources` into an editorial/SEO entry point

**Files:**
- Modify: `apps/web/app/resources/page.tsx`
- Modify: `apps/web/styles/marketing-pages.css`
- Modify SEO helpers/data only if needed.

**Interfaces:**
- Produces: blog/editorial landing IA aligned to real seller search intents without thin generated pages.

- [ ] **Step 1: Use public label `Блог`**
- [ ] **Step 2: Define editorial clusters from the research/message map**
- [ ] **Step 3: Add useful category descriptions and commercial cross-links**
- [ ] **Step 4: Do not fabricate article inventory; show only actual/planned content truthfully**
- [ ] **Step 5: Verify metadata and internal links**
- [ ] **Step 6: Commit**

### Task 10: Redesign contacts and legal pages

**Files:**
- Modify: `apps/web/app/contacts/page.tsx`
- Modify: `apps/web/app/privacy/page.tsx`
- Modify: `apps/web/app/terms/page.tsx`
- Modify: `apps/web/styles/marketing-pages.css`

**Interfaces:**
- Produces: qualified contact flow and readable legal layouts.

- [ ] **Step 1: Rewrite contacts around marketplaces, team/process and automation needs**
- [ ] **Step 2: Preserve privacy legal meaning while updating MPReply naming/layout**
- [ ] **Step 3: Preserve terms legal meaning while updating MPReply naming/layout**
- [ ] **Step 4: Verify headings, links and readability**
- [ ] **Step 5: Commit**

### Task 11: Complete public SEO metadata, structured data and internal linking audit

**Files:**
- Modify: `apps/web/lib/seo.ts` only if required
- Modify: all public route `page.tsx` metadata blocks
- Test: `apps/web/tests/unit/public-seo-copy-contract.test.ts`

**Interfaces:**
- Produces: unique titles/descriptions/canonicals, valid structured data and descriptive internal links.

- [ ] **Step 1: Audit one H1 and metadata per indexable route**
- [ ] **Step 2: Audit canonical/origin `https://mpreply.ru`**
- [ ] **Step 3: Add/verify OpenGraph/Twitter fields through existing helper**
- [ ] **Step 4: Verify marketplace-specific intent and avoid duplicate descriptions**
- [ ] **Step 5: Audit internal anchors; replace generic `Подробнее` where destination intent can be named**
- [ ] **Step 6: Run SEO contract tests and Lighthouse**
- [ ] **Step 7: Commit**

### Task 12: Public visual/regression review and final verification

**Files:**
- Modify visual snapshots only after manual review: `apps/web/e2e/visual.spec.ts-snapshots/*`

- [ ] **Step 1: Run full static suite**

```bash
cd apps/web
npm run test:frontend
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
```

- [ ] **Step 2: Run public E2E/a11y/visual/Lighthouse**

```bash
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

- [ ] **Step 3: Review every desktop/mobile snapshot against approved homepage language**

Check spacing, typography, composition, CTA hierarchy, overflow and visual consistency. Do not approve snapshots merely because tests can be updated.

- [ ] **Step 4: Re-run after any visual fix**
- [ ] **Step 5: Commit reviewed snapshot changes only when intentional**
