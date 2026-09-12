# MPReply public-site SEO specification

## Objective

Build qualified organic visibility for MPReply around marketplace customer communication, auto-replies, reviews, buyer questions and messages while preserving useful page intent and product truth.

Traffic volume alone is not success. Search pages must help marketplace sellers understand the product and move toward a relevant commercial or educational next step.

## Principles

- One dominant intent per page.
- Product/release truth outranks keyword opportunity.
- Native Russian, no keyword stuffing.
- No doorway pages or marketplace pages created by name replacement.
- Commercial pages explain the product; editorial pages answer genuine seller questions.
- Exact AI provider/model names are not SEO proof unless verified in the deployment runtime.
- No invented ratings, offer data, customer counts, review counts or organization facts for schema.

## Research requirement

Before the final copy rewrite, inspect current search results, competitor pages and category language for the target queries. Record useful patterns and retrieval date.

Research should cover:
- Russian marketplace/reputation/review automation products;
- relevant support/helpdesk products with marketplace/ecommerce workflows;
- current SERP titles/descriptions/headings for priority clusters;
- recurring questions/objections visible in competitor content;
- irrelevant consumer or one-off text-generator intent that MPReply should exclude.

Competitor research informs structure and vocabulary, never verbatim copying.

## Primary semantic clusters

### Core commercial cluster

- автоответы на отзывы;
- автоматические ответы на отзывы;
- ответы на отзывы маркетплейсов;
- сервис ответов на отзывы;
- ответы на вопросы покупателей;
- сообщения покупателей;
- чаты маркетплейсов;
- ИИ для маркетплейсов;
- нейросеть для ответов на отзывы;
- автоматизация отзывов;
- автоматизация общения с покупателями;
- единое окно для маркетплейсов;
- единый кабинет отзывов и вопросов.

### Marketplace modifiers

- Wildberries / Вайлдберриз / WB;
- Ozon / Озон;
- Яндекс Маркет;
- Авито.

Do not place every spelling variant in visible headings. Use natural Russian and page-specific query intent.

### Educational/editorial cluster

- как отвечать на отзывы покупателей;
- ответы на негативные отзывы;
- шаблоны ответов на отзывы;
- как отвечать на вопросы покупателей;
- автоматизация работы с отзывами;
- ИИ для ответов на отзывы;
- как работать с отзывами на Wildberries;
- как работать с отзывами на Ozon;
- единое окно для нескольких маркетплейсов;
- правила автоматических ответов;
- тональность бренда в ответах покупателям.

These are research seeds, not permission to publish thin pages automatically.

## Route intent map

### `/`

Intent: category/product discovery and branded conversion.

Primary topic: MPReply as one workspace for reviews, questions and messages with contextual AI replies and configurable automation.

### `/features`

Intent: capability evaluation.

Explain seller jobs and workflow changes rather than repeating keyword lists.

### `/marketplaces`

Intent: marketplace coverage/integration discovery.

Target users asking which marketplaces can be handled in one service and how the workflow is unified.

### `/marketplaces/wildberries`

Intent: Wildberries-specific commercial/search evaluation.

Use genuinely WB-specific workflow and terminology supported by the product.

### `/marketplaces/ozon`

Intent: Ozon-specific commercial/search evaluation.

Do not clone the Wildberries page. Cover Ozon-specific seller communication and connection expectations supported by MPReply.

### `/marketplaces/yandex-market`

Intent: Yandex Market-specific commercial/search evaluation.

Use natural `Яндекс Маркет` visible copy; alternate spelling variants belong in metadata/body only where natural.

### `/marketplaces/avito`

Intent: Авито buyer-message/customer-communication evaluation.

The page must reflect the communication types and workflow that are actually supported rather than pretending Avito behaves identically to review-centric marketplaces.

### `/pricing`

Intent: commercial/pricing evaluation.

Do not invent prices, discounts, tiers or trial periods for SEO snippets.

### `/demo`

Intent: product-demo evaluation.

Explain what the visitor can see/understand in the demo; avoid keyword-heavy marketing copy.

### `/resources`

Intent: educational discovery and topical authority.

Public navigation label: `Блог` unless later changed. This route is the editorial hub for useful seller content and internal links to relevant product pages.

### `/contacts`

Intent: branded contact / onboarding conversation.

### `/privacy`, `/terms`

Intent: legal trust. These should be indexable only according to the broader site policy and should not be optimized as commercial landing pages.

## Page-level SEO brief

Every indexable commercial/editorial page needs:

- one primary intent;
- primary semantic cluster;
- target seller segment;
- concrete pain/question;
- MPReply mechanism or editorial answer;
- evidence/limitations;
- one useful CTA or next route;
- intentional internal links;
- unique title;
- unique meta description;
- canonical;
- one visible H1;
- logical H2/H3 hierarchy;
- structured data only when content qualifies.

## Metadata rules

Use the existing SEO helper for consistent metadata behavior.

Every primary page should have:
- concise unique title aligned to intent;
- unique description that explains outcome/mechanism rather than listing keywords;
- self-canonical URL;
- OpenGraph/Twitter metadata where supported;
- stable `metadataBase` through site configuration.

Avoid title formulas that differ only by marketplace name if page intent differs materially.

## Canonical and indexation policy

- Primary public routes self-canonical.
- Query parameters do not create new canonical pages by default.
- Auth/app/admin routes are excluded from indexing.
- No hreflang until a real alternate-language site exists.
- Correct status codes; no soft 404 pages.
- Avoid trailing-slash/query duplication.

## Structured data

Use only when the rendered page genuinely qualifies.

Potential types:
- `WebSite`;
- `SoftwareApplication` where the available factual fields are sufficient;
- `Organization` only when real operator/company data exists;
- `BreadcrumbList` on appropriate nested pages;
- selective `FAQPage` only when useful FAQs are visibly rendered and policy permits.

Never invent:
- aggregate ratings;
- review counts;
- offers/prices;
- company data;
- awards;
- customers.

## Internal linking

Create intentional links between:
- homepage ↔ features;
- homepage/features ↔ marketplace hub;
- marketplace hub ↔ each marketplace page;
- marketplace pages ↔ demo/pricing/account/contact where relevant;
- Blog/editorial content ↔ the most relevant commercial page;
- features ↔ the integration/workflow that proves the feature.

Use descriptive anchor text. Do not repeat `Подробнее` as the default link label.

## Content quality

No paragraph should exist only to repeat a query phrase.

Marketplace pages must provide unique seller value. A page fails the quality bar if the marketplace name can be replaced and every other sentence remains true.

Explain technical mechanisms in seller language first. Internal terms may appear only when they help a technical/admin audience.

## Image and performance SEO

- Keep image dimensions explicit.
- Use compressed WebP/appropriate modern image formats where practical.
- Meaningful product images receive useful alt text; decorative images use empty alt.
- Protect LCP/CLS/INP; do not add heavy third-party marketing scripts by default.
- Hero product art must not become a blocking oversized asset.

## Measurement

Useful outcomes after launch:
- qualified impressions/clicks by semantic cluster;
- conversion to demo/account/contact;
- activation from organic sessions where measurable;
- indexing/canonical errors;
- Core Web Vitals field data when available;
- queries indicating expectation mismatch or unsupported intent.

SEO work is successful when it attracts users whose marketplace communication problem MPReply can actually solve.
