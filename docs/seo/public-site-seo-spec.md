# MPReply public-site SEO and content specification

## Editorial priority

Every public text follows this order:

1. customer usefulness and clarity;
2. SEO/search intent;
3. marketing presentation.

Do not force uniqueness. Do not copy competitor wording or block order. Do not invent claims, numbers or benefits. Natural Russian and factual product value outrank clever slogans.

## Product category and search intent

Primary category:

- automatic replies to marketplace reviews;
- automatic replies to buyer questions;
- AI replies to reviews and questions;
- service for managing marketplace reviews and questions;
- automation of seller/customer communication on marketplaces.

Core marketplace clusters:

- Wildberries / WB: automatic replies to reviews and questions;
- Ozon: automatic replies to reviews and questions;
- Яндекс Маркет: replies to reviews and buyer questions;
- Авито: buyer questions and messages where supported by the final connected product.

Supporting intent:

- how to reply to positive reviews;
- how to reply to negative reviews and complaints;
- how to automate replies across simple, complex, negative and ambiguous scenarios;
- how to keep reviews and questions from several marketplaces in one workspace;
- how AI can use product context and company rules;
- how optional manual approval can be configured for selected categories when the business needs extra control.

These are research seeds, not permission to stuff keywords into copy.

## Competitor research standard

Before a major public-copy rewrite, inspect current relevant competitors and adjacent marketplace SaaS products. Minimum evidence set should include:

- direct Russian review/question automation services such as OTVETO, Spix, Otvetochka and relevant alternatives;
- marketplace SaaS products such as MPSTATS, MarketGuru, SellerFox and other products that demonstrate strong seller-oriented positioning and information architecture;
- international ecommerce/review/customer-support products such as Gorgias, Trustpilot Business, REVIEWS.io, Yotpo, Birdeye and other relevant current services.

Analyze:

- title/H1/H2 hierarchy;
- descriptions and subheadings;
- customer outcomes;
- product proof and examples;
- FAQ objections;
- marketplace/use-case landing pages;
- navigation and internal linking;
- blog/resource topics;
- CTA labels and conversion path;
- evidence policy;
- current visual/product storytelling patterns.

Use patterns as evidence. Never copy wording, composition or block order mechanically.

## Route intent map

| Route | Dominant intent | Role |
|---|---|---|
| `/` | automatic replies to marketplace reviews and questions | Category + conversion |
| `/features` | evaluate MPReply capabilities | Consideration |
| `/marketplaces` | work with reviews/questions across supported marketplaces | Coverage + conversion |
| `/marketplaces/wildberries` | automatic replies to Wildberries reviews/questions | Search + conversion |
| `/marketplaces/ozon` | automatic replies to Ozon reviews/questions | Search + conversion |
| `/marketplaces/yandex-market` | replies to reviews/questions on Яндекс Маркете | Search + conversion |
| `/marketplaces/avito` | buyer communication on Авито within MPReply | Search + conversion |
| `/pricing` | pricing/commercial evaluation | Qualification |
| `/demo` | see how MPReply processes an actual customer message | Conversion support |
| `/resources` | practical marketplace-review knowledge | Authority + discovery |
| `/contacts` | contact the operator | Trust + conversion |

## Page copy hierarchy

Each public page should answer, in this order where relevant:

1. What does MPReply do?
2. Who is the page for?
3. Which customer task is automated or simplified?
4. What is the concrete outcome?
5. How does the product use context and rules for different scenarios?
6. Which marketplace or workflow is covered?
7. Which optional control settings are available where relevant?
8. What should the visitor do next?

Internal implementation details are not public copy. Avoid unexplained engineering terms such as idempotency, retry, queue, worker, adapter, runtime quota, tenant scope, confidence threshold, pipeline and fallback strategy.

## Homepage content contract

Recommended sequence:

1. Hero with category clarity and marketplace context.
2. Marketplace proof/logos without implementation-stage labels.
3. Customer outcomes.
4. Concrete review-to-answer example.
5. One workspace for four marketplaces.
6. Complex-scenario proof showing that automation is not limited to trivial cases; optional manual approval is secondary.
7. Workspace capabilities with meaningful illustrations.
8. Multi-model LLM section with current, factual model names and plain-language roles.
9. Useful FAQ with one-open-at-a-time behavior and real objections/search intent.
10. Practical resources/blog entries.
11. One clear final CTA.

## LLM content policy

The target launch uses multiple strong models selected for Russian marketplace review/question tasks. Public model copy must follow these rules:

- exact names/versions must match the selected and connected launch stack;
- roles must be understandable to a customer;
- no unverified benchmark claim;
- no claim that a model is “best” without actual comparative evidence;
- no invented accuracy percentage, response time or superiority statement;
- model versions may change as stronger versions appear, but the user-facing workflow remains one MPReply product.

Before final production selection, benchmark candidates on real Russian scenarios: positive and negative reviews, complaints, product questions, ambiguous requests, long context, tone-of-voice adherence and factuality. Optional human-review scenarios may be benchmarked separately, but they are not the primary automation story.

## FAQ policy

FAQ exists to answer real objections and long-tail search intent, not to repeat page copy.

Priority questions:

- what exactly MPReply automates;
- whether replies can be sent automatically;
- what context is used;
- what happens to negative reviews/complaints;
- how rules and company tone work;
- supported marketplaces;
- why multiple AI models are used;
- how MPReply works with complex, negative and ambiguous scenarios;
- how optional manual approval can be configured where the business needs it.

No FAQ markup should be added unless the visible page genuinely contains the questions and answers.

## Resources and blog policy

Build useful topic clusters around real seller questions:

- how to reply to positive/negative reviews;
- automatic replies on Wildberries/Ozon/Яндекс Маркет/Авито;
- buyer questions about products;
- how to configure automation rules for different review/question scenarios;
- review response examples and practical templates with context;
- work with complaints, returns and delivery issues without unsupported promises;
- use of AI for marketplace reviews/questions;
- brand tone and response rules.

Avoid empty trend articles and generic AI filler.

## Evidence policy

Allowed:

- real product capabilities;
- real marketplace coverage at launch;
- real screenshots/examples;
- verified model names and roles;
- documented customer cases and metrics when they actually exist.

Forbidden:

- invented user counts;
- fabricated savings or revenue growth;
- fake testimonials or logos;
- made-up accuracy/latency;
- unsupported “number one” or “unique on the market” claims.

## Technical SEO

Required:

- unique titles/descriptions;
- canonical URLs and `metadataBase`;
- sitemap and robots handling;
- authenticated app routes excluded from indexing;
- one visible H1 per public document where appropriate;
- logical H2/H3 structure;
- descriptive links;
- server-rendered primary content;
- accurate status codes and no soft 404s;
- optimized images with dimensions and alt text where meaningful;
- controlled query/trailing-slash duplication;
- structured data only when visible content qualifies.

Use `WebSite`, `SoftwareApplication`, `BreadcrumbList` and selective `FAQPage` only when factual and supported by visible content. Never invent ratings, offers, review counts, company data or awards.

## Success criteria

Traffic alone is not success. Track:

- qualified organic impressions/clicks;
- conversion to demo/contact/onboarding;
- activation after signup when available;
- search queries showing expectation mismatch;
- indexing errors;
- Core Web Vitals field data when available.
