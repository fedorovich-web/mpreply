# MPReply public site — marketing and conversion brief

## Business objective

Explain MPReply clearly to marketplace sellers and teams, demonstrate the workflow, answer realistic objections and move qualified visitors toward account creation, demo or contact without overstating product readiness.

Every commercial page must answer:
- what seller problem this page addresses;
- what MPReply actually does about it;
- what result or operational change the user gets;
- what control/constraint matters;
- what the next useful action is.

## Audience and jobs

Primary audiences:
- individual seller switching between marketplace cabinets;
- marketplace manager handling a recurring queue of reviews, questions and buyer messages;
- team lead responsible for response quality, consistency and exceptions;
- agency/multi-account operator managing several seller workspaces.

Primary jobs:
- collect communication in one workspace;
- respond consistently with product and brand context;
- automate routine cases;
- keep exceptions under human control;
- understand what needs attention and why;
- see connection, processing and failure states without reading technical telemetry.

## Product promise

MPReply is not marketed as an AI text generator. The core promise is one operational workflow for marketplace communication:

**Отзывы, вопросы и сообщения покупателей в одном пространстве; ИИ готовит контекстный ответ; рутина обрабатывается автоматически или после проверки — по правилам команды.**

## Product truth

The product UI supports Wildberries, Ozon, Yandex Market and Avito.

All four may be shown as available in the product experience. Public production claims must be released together with the backend/runtime certification that makes those claims true in production.

The approved public tariff presentation is:
- `Старт` — `490 ₽ / мес`;
- `Профессиональный` — `990 ₽ / мес`;
- `Бизнес` — `1 990 ₽ / мес`;
- annual payment presentation — `-20%`;
- trial presentation — `14 дней`.

Do not invent extra prices, crossed-out anchors, discounts, urgency or trial terms beyond that approved presentation. Payment-provider wiring remains a separate launch-stage task.

Exact AI provider/model names must not be used as marketing proof unless verified on the deployment branch.

Do not expose credential, worker, adapter, provider, tenant or internal safety-pipeline vocabulary as primary seller-facing copy.

MPReply has no public blog. Do not create a `/blog` route, render `Блог` in public navigation or footers, or repurpose `/help` as an editorial/blog section.

## Visual source of truth

For the current secondary-page fidelity pass, the supplied approved renders for `/features`, `/marketplaces`, marketplace detail, `/pricing` and `/demo` are the visual source of truth.

- Do not redesign those pages "by inspiration".
- Preserve meaningful UI, headings, tables, buttons and interactions as code.
- Use raster only for approved visual assets or icon replacements that are demonstrably closer to the supplied render.
- One raster asset is one file; do not create sprites or combined raster UI panels.
- Vertical padding for each approved section is render spacing + 15px at the top and +15px at the bottom. Do not apply the increment twice through overlapping CSS layers.

## competitor-informed copy

Final public copy must be based on current competitor and category research before it is written.

Research should capture, for each relevant competitor:
- first-screen promise;
- pain point named first;
- information hierarchy;
- how they explain one inbox/workspace;
- how they explain AI context;
- how they explain automation versus human review;
- objections handled on features/integrations/pricing pages;
- CTA structure;
- useful category and marketplace vocabulary;
- unsupported or weak claims we should not repeat.

Useful recurring category patterns to improve on:
1. one inbox/workspace instead of switching between channels;
2. context before generation rather than generic AI text;
3. automation with handoff/control for exceptions;
4. rules/workflow/analytics rather than AI-only positioning;
5. marketplace-specific language instead of generic ecommerce-support copy.

Do not copy competitor wording verbatim. Rebuild each block around actual MPReply mechanics and Russian seller intent.

## Copy quality test

Before a major block is accepted, answer yes to all:
1. Does it name a concrete seller problem or outcome?
2. Does it explain what MPReply actually changes in the workflow?
3. Is the claim supported by current product/release truth?
4. Is it more specific than a generic AI SaaS slogan?
5. Does it avoid invented proof?

If not, rewrite it.

## Route architecture

| Route | Primary intent | Page job |
|---|---|---|
| `/` | category + product understanding | explain MPReply in one flow and drive onboarding/demo |
| `/features` | capability evaluation | map product mechanics to seller jobs |
| `/marketplaces` | integration discovery | show supported marketplace coverage and common workflow |
| `/marketplaces/wildberries` | Wildberries communication automation | marketplace-specific search + conversion |
| `/marketplaces/ozon` | Ozon communication automation | marketplace-specific search + conversion |
| `/marketplaces/yandex-market` | Yandex Market communication automation | marketplace-specific search + conversion |
| `/marketplaces/avito` | Avito buyer communication | marketplace-specific search + conversion |
| `/pricing` | commercial evaluation | present the approved tariff options and limits clearly |
| `/demo` | product evaluation | show realistic MPReply workflow before signup |
| `/help` | support + FAQ | task-oriented help, troubleshooting and common questions |
| `/contacts` | qualified contact | collect useful onboarding context |
| `/privacy`, `/terms` | legal trust | readable accurate legal pages |

## Homepage

Approved structure:
1. Header with `Войти` and account-creation action.
2. Hero with category/outcome copy and realistic MPReply UI WebP.
3. Marketplace strip.
4. Interactive unified workspace: `Отзывы / Вопросы / Сообщения`.
5. Context/AI section based on verified capability rather than a fake provider-logo strip.
6. Connected horizontal `Как это работает` journey.
7. Factual operational outcomes without fabricated savings.
8. Concise final CTA with separate UI WebP and restrained wave asset.
9. Full footer.

The hero must not regain a second active decorative background behind the UI illustration.

## `/features`

Do not repeat the homepage. Build the page around jobs removed from a manager's day:
- one queue instead of multiple cabinets;
- context next to each request;
- prepared reply;
- automatic handling rules;
- human review of exceptions;
- team consistency and permissions where supported;
- history/analytics/operational visibility;
- connection/error visibility.

Use feature → workflow change → seller outcome, not a grid of implementation nouns.

## `/marketplaces`

Explain what is common across marketplace integrations and how connected accounts enter one MPReply workflow. Avoid adapter/runtime language.

Marketplace cards should help users answer: is my platform supported, what can I work with in MPReply, and what is the next connection action?

## Marketplace detail pages

Wildberries, Ozon, Yandex Market and Avito pages require unique copy and structure. Do not produce them by replacing a name in the same template.

Each page should address:
- the seller's real communication workflow on that marketplace;
- supported reviews/questions/messages applicable to that platform;
- how context and reply preparation work;
- automatic versus review-required handling;
- connection/setup expectations;
- important operational/error states;
- marketplace-specific FAQ where useful;
- relevant internal links to demo/features/pricing/onboarding.

## `/pricing`

Use the approved public tariff presentation as the commercial source of truth for this redesign:

- `Старт` — `490 ₽ / мес`;
- `Профессиональный` — `990 ₽ / мес`;
- `Бизнес` — `1 990 ₽ / мес`;
- annual payment — `-20%`;
- free access period — `14 дней`.

Keep the current approved plan limits, comparison table, integrations, FAQ and final CTA code-driven. Do not add additional prices, discounts, checkout/payment actions, fake urgency or new commercial claims that are not in the approved source.

## `/demo`

The demo should resemble the actual product and answer how the workflow feels before signup.

Use realistic examples for:
- review;
- buyer question;
- buyer message;
- product/context information;
- prepared reply;
- automatic path versus `нужна проверка` path.

Do not turn demo into a fictional dashboard with unsupported features or metrics.

## `/help`

The help page is task-oriented rather than a generic editorial hub. It should cover:
- connecting the four supported marketplaces;
- working with the unified queue;
- review and automation rules;
- troubleshooting common integration/response states;
- concise FAQ;
- a clear support/contact path.

MPReply has no public blog. Keep `/help` strictly task-oriented; do not create `/blog`, `/resources`, editorial feeds, news posts or blog-style navigation.

## `/contacts`

Ask only for information useful to a real onboarding/sales conversation, such as marketplace set, approximate workflow/volume, team context and automation needs. Do not create a long lead form for data we do not need.

## Legal pages

`/privacy` and `/terms` may receive the same typography/navigation/readability redesign, but their legal meaning must not be rewritten into marketing claims.

## CTA rules

Use one primary action per conversion context and make labels describe the next state.

Approved public-site CTA language includes:
- `Попробовать бесплатно` for the approved `14 дней` free-access presentation;
- `Создать аккаунт`;
- `Посмотреть демо`;
- `Посмотреть интеграции`;
- `Обсудить подключение`;
- marketplace-specific `Подключить <marketplace>` where that action is actually the next state.

Do not invent additional trial conditions or payment promises beyond the approved commercial source.

## Credibility policy

Allowed:
- real product UI;
- real workflow mechanics;
- real supported marketplace names;
- verified security/control behavior;
- explicit limitations;
- approved public tariff/trial presentation documented above.

Forbidden:
- fabricated client logos or testimonials;
- fake customer counts;
- unsupported percentage/time savings;
- fake ratings/awards;
- additional prices/discounts/trial terms not in the approved source;
- fake urgency;
- unverified production/provider/model claims.

## Mobile UX

Public pages are intentionally composed at 320px and 390px:
- no desktop-only card feeds squeezed into one column;
- no horizontal overflow;
- primary CTA remains reachable;
- important product explanation is not hover-only;
- long Russian headings wrap deliberately;
- decorative imagery never pushes core copy/action below unusable fold lengths.

For the approved handoff pages, also review 1086px, 1024px, 768px and 430px layouts. The exported PNG width alone is not a breakpoint specification.

## Acceptance criteria

- All public pages use the approved MPReply brand design language.
- Every page has a distinct purpose and composition.
- Copy is grounded in competitor/category research and real product truth.
- The core `автоматически или после проверки` control model is understandable without internal jargon.
- No fabricated proof or unsupported exact AI models.
- SEO metadata and internal linking match page intent.
- Unit/design-token/type/lint/CSS/build/W3C/E2E/a11y/visual/Lighthouse gates pass on the final tree.
