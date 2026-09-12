# MPReply Product Redesign — Design Specification

## Source of truth

The latest user-approved homepage preview from 2026-09-12 is the visual source of truth for MPReply. Public pages and the authenticated workspace must evolve from that direction rather than introduce a new aesthetic.

Product truth for this redesign:

- MPReply is a ready B2B SaaS product for marketplace sellers and support teams.
- Ready integrations: Wildberries, Ozon, Яндекс Маркет and Авито.
- Core communication types: reviews, buyer questions and buyer messages.
- Core workflow: unified inbox → contextual AI draft → automatic send or human approval → status/history.
- Public copy must not describe ready integrations as planned, beta or coming soon.

## Product and visual principles

- Light, airy SaaS interface with a white/near-white foundation and restrained blue atmospheric gradients.
- Strong product blue for primary actions; soft blue tints for hierarchy, not decorative noise.
- Generous section spacing and clear chapter rhythm. Sections must not visually merge into one continuous card stack.
- Expressive typography with concise copy and strong hierarchy.
- Cards, tabs, inputs, filters, buttons, statuses and navigation use one shared design language across public pages and dashboard.
- Avoid identical section templates. Alternate split layouts, product scenes, editorial bands, process compositions and compact factual blocks.
- No glassmorphism, excessive glow, gradient text, nested card stacks or generic “AI SaaS” decoration.
- No one-off palette/spacing/radius/shadow values when a semantic token can serve the same role.

## Approved homepage direction

The homepage keeps the approved structure and character:

1. **Header** — compact navigation, sign-in and a clearly differentiated account/onboarding action.
2. **Hero** — outcome-led copy on the left and a realistic MPReply UI scene on the right. The scene is a dedicated optimized image, not a fake operational control surface.
3. **Marketplace strip** — Wildberries, Ozon, Яндекс Маркет and Авито are all shown as ready integrations. Avoid brittle vanity metrics.
4. **Unified workspace** — reviews, questions, messages and combined queue demonstrated as one product workflow.
5. **Context and quality** — explain product/order/conversation context, brand tone, team rules and approval controls. Do not market unverified model/provider names.
6. **How it works** — visually distinct four-step workflow: connect → receive → prepare → send/approve. It must explain operations, not become four identical icon cards.
7. **Operational outcomes** — factual product mechanics and workflow benefits without fabricated percentages, customer counts, ratings or testimonials.
8. **Closing conversion block** — a different conversion job from the hero: move an informed visitor into account creation or product demo.
9. **Footer** — complete product/resources/company/support/legal navigation.

## Public information architecture

Existing and relevant public routes must share one system and be reviewed as a product family rather than independent landing pages:

- `/` — homepage.
- `/features` — capabilities and workflows.
- `/marketplaces` plus marketplace detail routes — integration overview and platform-specific product value.
- `/pricing` — plan selection and constraints stated clearly.
- `/demo` — product demonstration entry point.
- `/resources` — editorial/blog content.
- `/contacts` — support/contact entry point.
- `/auth/*` — sign-in, registration and recovery surfaces.
- onboarding entry points connected to registration and marketplace connection.
- legal pages retain restrained styling and strong readability.

Do not create a fake cases page without verified customer material. A dedicated cases route is added only when real, publishable evidence exists. FAQ content may live on relevant commercial pages or become a dedicated route when there is enough non-duplicated support content.

## Public copy and SEO

- One visible H1 per page.
- Search intent and page purpose come before keyword repetition.
- Core semantic themes: marketplace review replies, buyer questions, buyer messages, unified marketplace inbox, AI-assisted response automation, moderation/approval, seller support workflow.
- Native Russian, concrete verbs and short claims that can be supported by the product.
- Avoid repeating `MPReply` in every block.
- No fake metrics, testimonials, ratings, savings percentages or customer counts.
- No public AI model/provider names unless specifically approved and verified for that marketing claim.
- CTA labels describe the next state and are contextual across header, hero, page body and closing CTA.
- Metadata, canonical URLs, Open Graph data, sitemap and structured data must reflect the actual page content.
- FAQ structured data is used only when the same FAQ is visible on the page.

## Dashboard information architecture

The authenticated product must use the same brand family with denser, task-oriented spacing. It is not a marketing page.

Primary user jobs:

1. See what needs attention now.
2. Work through reviews, questions and messages from all connected marketplaces.
3. Inspect marketplace, product/order and conversation context.
4. Generate or review an AI draft.
5. Approve, edit, send or allow an automation rule to send.
6. Filter by marketplace, communication type, status, assignee and risk/approval state.
7. Review automation rules and exceptions.
8. Inspect operational analytics, integrations, billing and organization settings.

Required UX patterns:

- clear list → detail workflow for inbox and moderation;
- persistent filters with understandable reset behavior;
- explicit loading, empty, error, permission and disconnected-integration states;
- visible status and next action, never technical implementation jargon;
- predictable tabs and secondary navigation;
- AI draft provenance/context shown in a user-facing way without leaking provider implementation details;
- confirmation and recovery for destructive or irreversible actions;
- keyboard/focus behavior suitable for high-frequency queue work.

## Design system architecture

Use semantic tokens shared between public and authenticated surfaces:

- brand/action colors and interaction states;
- page, surface, elevated, subtle and selected backgrounds;
- primary/secondary/muted/inverse text;
- subtle/strong/focus/status borders;
- status colors independent from brand color;
- spacing scale plus public-section and app-density aliases;
- control/card/panel radii;
- card/panel/floating shadows;
- typography roles for display, page title, section title, body, label and caption.

`tokens.css` is the foundation. Theme files may override semantic tokens for a theme, but must not maintain a second independent brand palette. New feature styles consume semantic tokens rather than embedding repeated hex values.

## Asset strategy

Dedicated marketing scenes are allowed and encouraged where they improve comprehension:

- hero unified-inbox scene;
- public workspace scene;
- multi-marketplace/source-routing scene;
- AI draft + approval/send scene;
- onboarding/integration connection scene when needed.

Raster marketing scenes should ship as optimized WebP and, where beneficial, AVIF with responsive sizing. Operational dashboard controls remain real HTML/React UI. Decorative assets must not duplicate real controls or become inaccessible sources of required information.

## Accessibility, performance and interaction

- Maintain WCAG AA-oriented contrast.
- All interactive controls are keyboard reachable with visible focus.
- Tabs, dialogs, menus and filters use correct semantics and state.
- Respect `prefers-reduced-motion`.
- Mobile layouts are intentionally composed at narrow widths rather than mechanically stacked.
- Avoid large client-only bundles for static marketing sections.
- Optimize image dimensions, loading priority and responsive `sizes`.

## Engineering constraints

- No changes that weaken backend authorization, RBAC, credential handling or SafetyGate behavior.
- Marketplace credentials remain backend-only and encrypted.
- Avoid dead components, orphan assets, duplicate CSS sources, copy-pasted variants and page-specific hacks.
- Objective gates matter: lint, typecheck, unit tests, E2E, accessibility, visual regression and Lighthouse where infrastructure is available.
- Visual-regression snapshots are reviewed intentionally; they are not regenerated merely to silence a failure.

## Acceptance criteria

- All public product claims treat Wildberries, Ozon, Яндекс Маркет and Авито as ready integrations.
- Public pages remain recognizably in the approved airy blue MPReply direction.
- Dashboard uses the same visual language but a task-appropriate information density.
- Homepage retains a strong hero/UI scene and improved section rhythm.
- “Как это работает” communicates a real workflow rather than four interchangeable cards.
- CTA hierarchy is contextual and non-repetitive.
- Public copy contains no fabricated proof or unapproved AI model marketing.
- Shared semantic design tokens are the source of repeated visual values.
- Empty/error/loading/approval states are designed for core dashboard workflows.
- Static quality gates pass before completion claims; browser/a11y/visual/Lighthouse evidence is recorded when those suites can run.