# MPReply Full Product Redesign, Copy, SEO and Marketing — Design Specification

## Scope

This is a full-product redesign of MPReply, not a homepage-only refresh.

The work covers:
- every public route;
- shared public navigation and footer;
- all public marketing, SEO and product copy;
- authenticated seller workspace pages;
- shared dashboard navigation, states and visual system;
- product-truth documentation that governs future UI/copy work.

The approved visual direction is the latest MPReply light-blue preview. It is the visual source of truth. Changes made for accessibility, semantics, performance or responsive behavior must preserve the approved composition, spacing and visual hierarchy unless the user explicitly approves a design change.

## Primary outcome

MPReply must read and look like one coherent product from landing page to authenticated workspace.

The public site should explain the product in seller language and convert qualified marketplace sellers. The authenticated workspace should continue the same brand system but become denser, calmer and operationally focused.

The redesign must eliminate the current mix of Respio-era copy, developer-facing terminology, obsolete marketplace-readiness labels and generic AI/SaaS language.

## Competitive research principle

Public copy must be informed by real competitor positioning and category language rather than invented from scratch.

Research sources include direct and adjacent competitors such as:
- MPReviews;
- Spix;
- ReviewerBot;
- Comenta;
- SmartReply;
- OTVETO;
- Gorgias;
- eDesk;
- ReplyDesk;
- ChannelReply;
- Re:amaze;
- FeedbackWhiz;
- SageMailer;
- Sellercloud/Memaila.

We do not copy competitor wording verbatim. We extract:
- pain points they lead with;
- information hierarchy;
- feature-to-benefit framing;
- onboarding language;
- proof patterns;
- CTA structure;
- objections handled on feature/pricing/integration pages;
- marketplace-specific vocabulary;
- useful category terms for SEO.

Then MPReply copy is rewritten from first principles around the product's actual strengths and Russian marketplace context.

### Competitor patterns worth retaining

1. **One workspace / one inbox**
   Strong category players consistently reduce the problem to scattered conversations across channels. MPReply should lead with the operational benefit of reviews, questions and buyer messages in one workspace.

2. **Context before generation**
   Strong AI-support products emphasize product/order/customer/brand context instead of generic text generation. MPReply should explain that answers are prepared with product context, team rules and brand style.

3. **Automation plus control**
   Strong competitors frame automation as routine handling with human handoff for exceptions. MPReply should make `автоматически или после проверки` a core product mechanism rather than a safety disclaimer.

4. **Rules and workflow, not only AI**
   Competitors with stronger product depth sell routing, rules, templates, assignment, analytics and actions. MPReply should clearly position itself as an operational system, not an AI reply generator.

5. **Marketplace-specific value**
   Seller-focused competitors outperform generic helpdesks when they name marketplace constraints, product-card context, response queues and seller workflows. MPReply copy should speak directly to marketplace operators rather than generic ecommerce support teams.

### Competitor patterns to reject

Do not reproduce:
- unsupported `99% accuracy` style claims;
- invented hours saved;
- fabricated customer counts, rankings or testimonials;
- fake urgency;
- generic `AI magic` language;
- unverified free-trial periods;
- inflated production-readiness claims;
- vague enterprise slogans that do not describe a seller workflow.

## Product positioning

### Category

MPReply is a marketplace customer-communication workspace for sellers and teams.

It combines:
- reviews;
- buyer questions;
- buyer messages/chats;
- AI-assisted reply preparation;
- configurable automation;
- human review for exceptions;
- integrations;
- analytics and operational visibility.

### Core promise

The core promise is not `AI writes text`.

The product promise is:

> Bring marketplace customer communication into one workflow, prepare contextual replies with AI, automate routine cases and keep control over exceptions.

### Primary audiences

1. Individual seller who spends time switching between marketplace cabinets.
2. Marketplace manager handling a large queue of reviews/questions/messages.
3. Team lead who needs consistent brand tone, rules and visibility.
4. Agency or multi-account operator managing multiple seller workspaces.

## Product truth and release truth

The UI must no longer label Ozon, Yandex Market or Avito as `planned`.

Working product truth for the redesign:
- Wildberries is supported;
- Ozon is supported;
- Yandex Market is supported;
- Avito is supported.

However, public release copy and merge order must remain consistent with the backend branch and release certification. If a provider path has not yet completed live runtime certification on the branch that will be deployed, the frontend PR must not be merged ahead of the backend/runtime work that makes the public claim true in production.

This is a merge/release dependency, not a reason to revert the UI to `planned` messaging.

### AI-model claims

Do not hard-code a model/provider marketing strip unless those exact models are implemented and verified on the deployment branch.

The UI may use provider-neutral language such as:
- `ИИ готовит ответ`;
- `модель для подготовки ответа`;
- `выбор модели`, if that capability exists in the final backend branch.

Exact model names must be generated from verified runtime capability/configuration or removed from public marketing until verified.

## Public information architecture

All public pages must be redesigned as intentional pages rather than inherited template variants.

### `/` — Home

Purpose: explain the product in one screen, demonstrate the workflow and drive onboarding/demo intent.

Structure:
1. Header.
2. Hero: category + outcome + realistic MPReply UI WebP.
3. Marketplace strip.
4. Unified workspace with interactive `Отзывы / Вопросы / Сообщения` tabs.
5. Context/AI section based on actual runtime capabilities.
6. `Как это работает` horizontal connected journey.
7. Operational outcomes using factual product mechanics.
8. Final CTA with separate CTA UI WebP and restrained wave background.
9. Full footer.

The hero must not regain a second competing decorative background. The generated product UI illustration supplies the hero's visual depth.

### `/features`

Purpose: sell product depth, not repeat the homepage.

Sections should map features to seller jobs:
- unified queue;
- contextual reply preparation;
- automation rules;
- review/approval path;
- brand style/knowledge context where supported;
- team workflow and roles;
- analytics/history;
- integration reliability and error visibility.

Each section answers `what problem does this remove from a marketplace manager's day?`.

### `/marketplaces`

Purpose: integration discovery and marketplace coverage.

Show all supported marketplaces with a clear explanation of what flows through MPReply. Do not use internal adapter/runtime terminology in normal marketing copy.

### `/marketplaces/wildberries`
### `/marketplaces/ozon`
### `/marketplaces/yandex-market`
### `/marketplaces/avito`

Each marketplace page must have unique copy and SEO intent, not a mechanically swapped marketplace name.

Each page should cover:
- what seller communication is centralized;
- how MPReply fits into that marketplace workflow;
- review/question/message coverage that is actually supported;
- AI/context workflow;
- automation/review options;
- connection/setup expectations;
- operational states and error visibility;
- marketplace-specific FAQ where useful.

### `/pricing`

Purpose: explain the commercial model clearly without invented prices or fake discounts.

Until final pricing is configured, the page should explain:
- what usage dimensions can affect a plan;
- what is included conceptually;
- who each plan tier is for, only if real tiers exist;
- contact/onboarding path where price is not yet public.

No fake `most popular`, crossed-out fake price or fabricated annual discount.

### `/demo`

Purpose: show the actual product workflow before signup.

Use realistic scenarios for:
- review;
- question;
- buyer message;
- prepared reply;
- automatic vs review-required decision.

The demo should resemble the real product, not an invented feature showcase.

### `/resources`

Purpose: become the SEO/editorial entry point rather than a generic `resources` page.

Public label: `Блог` or another approved Russian editorial label.

Content clusters should be derived from real seller search intent:
- ответы на отзывы Wildberries;
- ответы на отзывы Ozon;
- ответы на вопросы покупателей;
- автоответы на отзывы;
- работа с негативными отзывами;
- ИИ для ответов на отзывы;
- единое окно для маркетплейсов;
- автоматизация коммуникации с покупателями;
- brand tone/templates/rules where relevant.

Do not mass-produce thin SEO pages.

### `/contacts`

Purpose: qualified sales/support contact.

Ask only for information useful to a real onboarding conversation: marketplaces, volume, team/process and automation needs.

### `/privacy` and `/terms`

Keep legal meaning accurate. Redesign typography, navigation and readability, but do not turn legal pages into marketing copy.

## SEO system

### Primary semantic clusters

Core:
- автоответы на отзывы;
- автоматические ответы на отзывы;
- ответы на отзывы маркетплейсов;
- ответы на вопросы покупателей;
- сообщения покупателей;
- чаты маркетплейсов;
- ИИ для маркетплейсов;
- нейросеть для ответов на отзывы;
- автоматизация отзывов;
- единое окно маркетплейсов;
- автоматизация общения с покупателями.

Marketplace modifiers:
- Wildberries / Вайлдберриз / WB;
- Ozon / Озон;
- Яндекс Маркет;
- Авито.

Use natural Russian phrasing and page-specific intent. Do not stuff multiple spelling variants into visible headings.

### Metadata

Every indexable public page receives:
- unique title;
- unique meta description;
- canonical;
- OpenGraph/Twitter metadata as supported by the existing SEO helper;
- appropriate structured data;
- one visible H1;
- clean heading hierarchy.

### Internal linking

Create intentional links between:
- homepage and feature pages;
- marketplace hub and marketplace detail pages;
- feature pages and relevant marketplace pages;
- blog/editorial content and commercial pages;
- demo/pricing/contact/onboarding paths.

Anchor text should describe the destination rather than repeatedly use `Подробнее`.

## Public copy standard

Every major block must pass five tests:

1. Does it name a seller problem or outcome?
2. Does it explain what MPReply actually does?
3. Is the claim supportable by product/runtime truth?
4. Could the same sentence appear on any generic AI SaaS? If yes, rewrite it.
5. Is it better and more specific than the competitor pattern it was derived from?

### Tone

- native Russian;
- concise;
- operational;
- specific;
- competent;
- no fake excitement;
- no developer jargon unless the audience is explicitly technical/admin;
- no English labels where a natural Russian product term exists.

## Dashboard / authenticated workspace redesign

The dashboard uses the same MPReply brand system but not the same marketing density.

Public site: expressive, spacious, conversion-oriented.
Dashboard: information-dense, calm, scan-friendly, action-oriented.

### Shared navigation

Primary user-facing navigation:
- Обзор;
- Обращения;
- На проверке;
- ИИ-ассистент;
- Автоматизация;
- Интеграции;
- Аналитика;
- Тариф и лимиты.

Admin/internal tooling can retain technical language where it describes diagnostics rather than seller actions.

### `/app/dashboard`

Show operational priorities first:
- unanswered/new work;
- items requiring review;
- successful/failed processing where meaningful;
- active marketplace connections;
- usage/limits only where useful.

Avoid a dashboard of decorative metrics.

### `/app/inbox`

Primary workspace for reviews/questions/messages.

Must optimize for:
- fast scanning;
- marketplace/type/status filters;
- context next to the message;
- reply preparation;
- visible state;
- clear next action.

### `/app/review-queue`

Language should describe why an answer requires attention, what the manager can change and what happens after approval/rejection.

Do not expose implementation nouns such as `revision`, `worker pipeline` or `SafetyGate` as normal user copy.

### `/app/ai-assistant`

Frame around preparing a better answer, not around provider telemetry.

Normal users need:
- source/context;
- tone/style controls where implemented;
- draft;
- reason for additional review;
- regenerate/edit/approve actions.

Provider/model/token/latency telemetry belongs only in explicit diagnostics/admin contexts.

### `/app/automation-rules`

Explain rules in seller language:
- when to answer automatically;
- which cases need review;
- conditions by rating/type/product/keyword or other actual supported conditions;
- ordering/priority where applicable;
- clear enabled/disabled state.

### `/app/integrations`

All four marketplaces are available in the product UI.

`Подключить` vs `Управлять` is based on whether the current organization has an account connected for that marketplace, not on a marketplace-specific hard-code.

Each integration should expose:
- connection state;
- relevant account identity safely;
- sync/health state where available;
- actionable errors;
- connect/manage/reconnect/revoke actions according to RBAC.

### `/app/analytics`

Use seller-oriented measures. Do not surface raw provider telemetry as a primary analytics story.

### `/app/billing`

Use `Тариф и лимиты`, clear period/usage/limit semantics and no fake pricing.

### Superadmin/internal screens

Technical terms are allowed when they are actually needed for operations, diagnostics, provider status or security. They must still be readable and consistent.

## Design system

### Core palette

Approved direction:
- deep product blue around `#1E40AF` / `#1D4ED8`;
- primary `#2563EB`;
- sky accent `#0EA5E9`;
- light sky accents up to `#7DD3FC`;
- white and cool near-white surfaces;
- dark navy text rather than black.

Semantic success/warning/danger colors remain separate from brand colors.

### Token architecture

Repeated visual values must live in shared tokens:
- colors;
- surface colors;
- borders;
- radii;
- shadows;
- spacing/rhythm;
- focus rings;
- transitions;
- public gradients.

Page styles may use local layout values, but must not create a second ungoverned design system of repeated hard-coded hex colors and shadows.

### Spacing

Preserve the approved generous public rhythm. Major desktop sections should remain visually separated by approximately 112–160px of vertical space where the approved composition calls for it.

Do not regress to compressed section stacking.

### Hero and image assets

- Hero uses a dedicated `WebP` product-UI illustration.
- Hero does not need a second active wave background behind the product art.
- Closing CTA may use a separate product-UI WebP plus restrained wave asset.
- Generated imagery must represent plausible MPReply UI and must not introduce fake capabilities/metrics.
- Interactive product explanations remain real HTML/React where interaction matters; do not replace tabs or core demos with screenshots.

## Accessibility and interaction

- WCAG AA-oriented contrast.
- Semantic HTML.
- Visible focus.
- `prefers-reduced-motion` respected.
- Tabs support click, Tab focus, ArrowLeft/ArrowRight and Home/End keyboard behavior.
- No critical state only on hover.
- 320px and 390px mobile layouts are intentionally composed.

## Quality policy

The user is the final judge of subjective visual quality.

Do not use Impeccable or similar subjective design heuristics as a blocking CI gate.

Objective gates remain mandatory:
- unit tests;
- design-token tests;
- typecheck;
- lint;
- CSS syntax validation;
- production build;
- W3C HTML/CSS validation;
- E2E;
- accessibility;
- visual regression;
- Lighthouse;
- production container validation/build.

Visual snapshots must be reviewed intentionally. Do not update snapshots merely to silence a failure.

## Source-of-truth cleanup

As part of this work, align:
- `PRODUCT.md`;
- `DESIGN.md`;
- `AGENTS.md`;
- public-site master brief;
- SEO spec;
- relevant tests and CI scripts.

They must no longer instruct agents to restore the superseded Respio violet/mint visual system or obsolete `planned` integration copy.

Remove dead theme/design infrastructure only when no longer used. Do not leave orphaned components, scripts or dependencies after the redesign.

## Merge dependency

PR #14 remains draft until:
1. this full redesign/copy/SEO scope is implemented;
2. review findings are fixed;
3. public claims are reconciled with the backend/runtime branch that will actually be deployed;
4. visual regression is reviewed;
5. the complete objective Quality Gate passes on the final SHA.

## Definition of done

The work is complete only when:
- every public route has been intentionally redesigned;
- public copy has been rewritten using competitor/category research rather than generic invented SaaS language;
- SEO metadata and page intent are unique and coherent;
- dashboard visual system matches the MPReply brand;
- dashboard UX-copy has been cleaned across all user-facing screens;
- four marketplace integrations are no longer presented as `planned`;
- `Подключить / Управлять` reflects actual organization connection state;
- exact AI-model claims match verified runtime capability;
- approved hero/CTA WebP assets render correctly;
- source-of-truth documentation matches the implemented product;
- no dead Respio/Impeccable/theme-era artifacts remain unless still required;
- objective CI, browser, accessibility, visual and Lighthouse gates are green;
- the user has reviewed the final visual result before merge.
