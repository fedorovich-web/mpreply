# MPReply 0.1.27 — Visual Recovery v4 candidate report

## Release status

**LOCAL VISUAL CANDIDATE / NOT FINAL / NOT REMOTE VERIFIED / VISUAL ACCEPTANCE PENDING**

Historical confirmed GREEN baseline: `0.1.26`.

The previous v3 candidate was explicitly judged visually incomplete. v4 is a screenshot-driven recovery pass against the latest rejection feedback. It must not be called final, committed, pushed or remote GREEN until those states are factually verified.

## Task-relevant Senior+ roles applied

- Creative Director / Digital Art Director;
- Principal Product Designer;
- Senior UX Architect;
- Senior Design Systems Architect;
- Principal Frontend Engineer;
- Senior CSS Architecture Specialist;
- Senior SVG/Canvas Graphics Engineer;
- Senior Motion Designer;
- Senior Accessibility Engineer;
- Senior Web Performance Engineer;
- Senior B2B SaaS Marketing Strategist;
- Senior CRO Specialist;
- Senior Russian SEO Strategist;
- Senior UX Writer;
- Senior Russian Editor/Linguist;
- Senior Visual QA Engineer.

## v4 recovery scope

### 1. Hero Canvas rebuilt around readable orbital geometry

The rejected v3 orbital tangle was replaced by a smaller, clearer hybrid composition:

- 5 exact SVG elliptical orbits;
- 3 readable inputs: reviews, questions and product data;
- one MPReply AI core;
- one automatic-answer output;
- Canvas 2D only for moving particles and output signals;
- no warped harmonic paths;
- no wave fan;
- no manager branch in Hero;
- no giant oval Hero background.

Motion safeguards retained:

- `ResizeObserver`;
- `IntersectionObserver`;
- page visibility pausing;
- `prefers-reduced-motion`;
- DPR cap;
- FPS cap;
- mobile complexity reduction.

### 2. Homepage positioning corrected

The public story is automation-first for different marketplace scenarios, including short reviews, complex product questions, negative feedback and ambiguous inquiries. Optional human approval is a secondary control configuration, not the main automation limitation story.

The public copy does not include rejected phrases such as:

- `Автоответы по умолчанию`;
- `SafetyGate до отправки`;
- `Исключения — менеджеру`;
- `Повторы без дублей`.

### 3. Realistic product-context example

The homepage example uses a concrete buyer question about a USB-C hub, MacBook Air M3, 4K 60 Hz output and 100 W Power Delivery. The answer is based on the product attributes shown in the example rather than generic filler.

The wording `правила бренда` was removed from public copy.

### 4. Marketplace section fully restructured

The rejected empty floating-node stage was removed from markup. The new block uses:

- a marketplace rail for Wildberries, Ozon, Яндекс Маркет and Авито;
- one central live-feed composition;
- realistic examples of review/question activity;
- no `MVP`, `planned`, readiness or implementation-stage status labels.

### 5. LLM section uses local provider logos

LLM cards use local SVG files from:

```text
apps/web/public/brand/llm/
```

Included provider assets:

- OpenAI;
- Anthropic / Claude;
- Google Gemini;
- DeepSeek.

There is no runtime CDN dependency for these logos.

The rejected public disclaimer about comparative testing and unsupported superiority claims was removed from the page. Truthfulness remains an internal product/release requirement rather than customer-facing filler.

### 6. Marketing icons redesigned as standalone sculpted glyphs

The previous icon tile pattern was removed. v4 custom marketing glyphs now use:

- no rounded-square backplate;
- no decorative cyan dot;
- no spark decoration;
- no `01/02/03/04` placeholders;
- a ground shadow layer;
- a depth/extrusion layer;
- a primary face layer;
- a separate highlight layer.

This produces a stronger 3D-style object treatment while remaining lightweight inline SVG.

### 7. FAQ changed to zero-layout-shift architecture

The previous answer replacement could still change height for longer content. v4 renders all answers into one shared CSS grid area:

- one question active at a time;
- opening another question replaces the active state;
- all answer panels reserve the same geometry;
- inactive panels are visually hidden but remain part of layout sizing;
- switching answers does not change page height;
- no `<details>` multi-open behavior.

### 8. Resources section redesigned

Three equal article cards were replaced with an editorial hierarchy:

- one dominant featured guide;
- two supporting compact articles;
- varied scale and hierarchy rather than repetitive equal boxes.

### 9. Final CTA uses the actual Electric Pulse pair

The final CTA uses the brand family built from:

- violet `#635BFF`;
- violet hover/depth `#5148E8`;
- cyan `#00E5E5`.

Primary and secondary actions remain visually distinct and high contrast against the CTA background.

### 10. Decorative borders removed from current homepage composition

Homepage surfaces use tonal separation, radius, elevation and controlled shadows rather than decorative border outlines. The final CTA/footer transition also removes the rejected visible separator.

## Regression protection

`apps/web/tests/unit/public-visual-recovery-contract.test.ts` contains 18 v4 screenshot-driven regression tests covering:

- direct customer-first/SEO copy;
- absence of rejected Hero filler;
- absence of unfinished-product statuses;
- absence of `правила бренда` wording;
- automation-first complex scenarios;
- one public eyebrow contract;
- solid tonal section surfaces and brand CTA gradient;
- 5-orbit SVG+Canvas Hero;
- motion caps/reduced motion;
- realistic product-context example;
- marketplace rail/feed composition;
- one-open FAQ with zero-layout-shift answer stack;
- standalone dimensional icons without spark/backplate tiles;
- absence of public engineering jargon;
- local LLM logos and no rejected disclaimer;
- editorial resources hierarchy;
- no decorative inset-border shadows;
- progressive custom cursor.

## Gates actually run on current v4 code

| Gate | Status |
|---|---|
| Frontend unit suite | **39/39 GREEN** |
| Dedicated v4 screenshot contract | **18/18 GREEN** |
| Design-token suite | **65/65 GREEN** |
| TypeScript | **GREEN** |
| ESLint | **GREEN** |
| Impeccable design scan | **GREEN** |
| CSS syntax | **GREEN** |
| npm audit | **GREEN — 0 vulnerabilities** |
| Production build | **GREEN — 31/31 pages** |
| W3C/Nu CSS | **GREEN — 5 stylesheet sources** |
| W3C/Nu HTML | **GREEN — 16 rendered routes** |

## Browser layer

A real Playwright run was attempted with the installed system Chromium binary:

```text
/usr/bin/chromium
```

The Next.js dev server started and returned HTTP 200, but browser navigation was blocked by enterprise policy:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Therefore the following are **BLOCKED**, not GREEN:

- Playwright browser E2E;
- axe accessibility in a real browser;
- seven-breakpoint rendered review;
- visual screenshots;
- Lighthouse.

## Integrity limitation

Repository integrity verification is **BLOCKED by incomplete supplied archive context**. The context archive lacks tracked files previously identified as:

```text
infra/coolify/.env.production.example
apps/api/app/tests/test_credentials_service.py
```

This is not proof that the real repository is RED.

## Final local status

**LOCAL VISUAL RECOVERY v4 CANDIDATE / CODE + STANDARDS GATES GREEN WHERE RUN / BROWSER LAYER BLOCKED BY ENTERPRISE POLICY / USER VISUAL ACCEPTANCE PENDING.**
