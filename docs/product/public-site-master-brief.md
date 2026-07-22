# MPReply public site — master product, marketing and conversion brief

## Business objective

Explain MPReply clearly enough that a marketplace seller or operator understands within seconds:

- the service automates replies to reviews and buyer questions;
- it works across Wildberries, Ozon, Яндекс Маркет and Авито at launch;
- the service automatically handles different types of reviews and buyer questions when sufficient context is available;
- optional manual approval can be configured for selected categories, but it is not the primary automation story;
- several AI models may be used for different task types.

The site must convert qualified visitors without exposing internal implementation details or inventing proof.

## Audience and jobs to be done

Primary audiences:

- seller with a growing volume of reviews/questions and limited team capacity;
- marketplace operator responsible for response speed and quality;
- multi-brand or multi-store team that wants one workspace;
- agency/operator managing several seller businesses.

Core jobs:

- reduce repetitive manual replies;
- respond faster;
- keep product context and company rules in the answer;
- automate a broad range of review/question scenarios while retaining optional control settings where the business needs them;
- work with several marketplaces in one service;
- keep a visible history of replies and decisions.

## Target-launch truth versus current engineering truth

The public site describes the fully implemented target launch product. The user will not launch MPReply halfway through implementation.

Therefore marketing pages do not show internal roadmap labels such as `MVP`, `planned`, `coming soon`, `readiness`, adapter/runtime status or other implementation-stage terminology.

This does not allow exaggeration. By public launch, every marketplace, model, capability, price, screenshot and proof point shown on the site must match production reality. Current repository code and `PRODUCT.md` remain authoritative for engineering status until full implementation is complete.

## Route architecture

| Route | Dominant intent | Role |
|---|---|---|
| `/` | Understand MPReply and its main outcome | Acquisition |
| `/features` | Evaluate capabilities | Consideration |
| `/marketplaces` | Understand marketplace coverage | Qualification |
| `/marketplaces/wildberries` | WB reviews/questions | Search + conversion |
| `/marketplaces/ozon` | Ozon reviews/questions | Search + conversion |
| `/marketplaces/yandex-market` | Яндекс Маркет reviews/questions | Search + conversion |
| `/marketplaces/avito` | Авито buyer communication | Search + conversion |
| `/pricing` | Commercial evaluation | Qualification |
| `/demo` | See a believable customer-message workflow | Conversion support |
| `/resources` | Practical knowledge and SEO authority | Discovery |
| `/contacts` | Reach the operator | Trust + conversion |
| `/privacy`, `/terms` | Legal disclosures | Trust |

## Homepage story

1. **Hero** — automatic replies to marketplace reviews and questions across simple, complex, negative and ambiguous scenarios when sufficient context is available.
2. **Marketplace proof** — Wildberries, Ozon, Яндекс Маркет, Авито without readiness badges.
3. **Customer outcomes** — less repetitive manual work, answers based on real context, one operational workspace.
4. **Concrete example** — a believable complex buyer question, product context, and a specific answer.
5. **One marketplace workspace** — show daily operational value, not technical integration status.
6. **Complex-scenario proof** — demonstrate that automation is not limited to trivial cases; optional manual approval stays secondary.
7. **Workspace capabilities** — meaningful cards with illustrations, not `01/02/03/04` placeholders.
8. **LLM section** — several current models with short, understandable roles and no unverified superiority claims.
9. **FAQ** — answer real objections and search questions; one item open at a time, stable interaction without unpleasant layout jumping.
10. **Resources/blog** — practical marketplace-review content.
11. **Light final CTA** — one clear next action on a solid tonal surface, not a default full-block gradient.

## Messaging hierarchy

Public copy follows this priority:

1. customer usefulness and clarity;
2. SEO/search intent;
3. marketing presentation.

Do not force originality. Do not copy competitors. Do not write vague AI filler. Use concrete Russian based on real seller tasks and actual product behavior.

Prefer:

- `Автоматические ответы на отзывы и вопросы на маркетплейсах`;
- `MPReply автоматически работает с вопросами о товаре, негативными отзывами и неоднозначными обращениями, используя доступный контекст и правила бренда`;
- `Отзывы и вопросы с четырёх маркетплейсов — в одном сервисе`.

Avoid:

- unexplained `SafetyGate` in the Hero;
- `MVP`, `readiness`, adapters or runtime state;
- idempotency, retry, queue, pipeline, confidence threshold and similar engineering jargon;
- generic slogans such as `революционный AI нового поколения`;
- unsupported numbers or superlatives.

## Hero contract

- light-first composition;
- H1 usually 2–3 desktop lines and never intentionally squeezed to 5+ lines;
- H1 desktop maximum 64px;
- lead directly below H1;
- two CTAs in one row while they fit;
- marketplace proof after CTAs;
- signature Orbital Ribbon Flow on the right;
- no giant oval background;
- no unexplained proof strip with `Автоответы по умолчанию / SafetyGate до отправки / Исключения — менеджеру / Повторы без дублей`.

## Orbital Ribbon Flow contract

Use the hybrid renderer:

- SVG: exact thin elliptical orbits and branch trajectories;
- Canvas: moving particles and signal events;
- HTML: accessible labels.

Required visual characteristics:

- varied eccentricity, rotation, opacity and stroke weight;
- visible but calm motion;
- AI core;
- one clear output flow to the ready automatic answer;
- incoming labels for reviews, questions, negative feedback and product characteristics;
- violet intelligence around the core;
- cyan used as a localized signal accent, not a random blob;
- no warped strips, wave fan, thick hoses or random cyan blob.

## LLM policy

The target launch uses multiple top-quality models selected for marketplace reviews/questions. Exact model versions shown publicly must match the chosen and connected production stack.

Selection is based on comparative tests using real Russian scenarios:

- positive reviews;
- negative reviews and complaints;
- product questions;
- ambiguous requests;
- long context;
- company tone and rules;
- factuality;
- difficult cases requiring human review.

Do not choose a model only because it is cheaper, faster or popular. Do not publish unsupported benchmark claims.

## Visual direction

- light-first Electric Pulse;
- primary violet `#635BFF`;
- accent cyan `#00E5E5`;
- controlled gradient family `#5148E8 → #00E5E5` only for localized roles where it materially improves the composition;
- solid tonal surfaces are the default for Hero, sections and final CTA; no generic full-background gradient soup;
- shadows/elevation/tonal separation instead of decorative border grids;
- one public eyebrow contract;
- Onest typography with shared token roles;
- custom cursor only as fine-pointer progressive enhancement;
- dark theme as semantic adaptation of the same system.

Master references: PitchBot AI, ARIA and Relatra. Do not create a collage of many unrelated references.

## CTA rules

Use concrete labels that describe the next step:

- `Посмотреть, как работает MPReply`;
- `Посмотреть демонстрацию`;
- `Обсудить подключение`.

Do not use `Попробовать бесплатно` until a real free offer exists.

## Credibility policy

Allowed:

- real product behavior;
- real launch marketplace coverage;
- real product examples/screenshots;
- exact connected model names;
- real case studies and metrics when available.

Forbidden:

- invented customer logos;
- fabricated testimonials;
- fake user counts;
- unsupported savings/revenue growth;
- invented prices or uptime;
- unsupported compliance badges;
- made-up model benchmark results.

## FAQ and resources

FAQ answers real customer objections and search intent without repeating page copy. It uses one-open-at-a-time accordion behavior with tokenized spacing and stable motion. Resources build practical topic authority around automatic replies, negative reviews, buyer questions, marketplace-specific workflows, product context and brand tone.

No generic AI trend filler.

## Mobile and accessibility

Required review widths:

- 1440;
- 1280;
- 1024;
- 768;
- 430;
- 390;
- 375.

At every width:

- no horizontal overflow;
- no overlap;
- no absurd heading wrapping;
- no crushed controls;
- Canvas remains intentional;
- touch targets and focus states remain accessible;
- no critical information is hover-only;
- `prefers-reduced-motion` is respected.

## Acceptance criteria

A visual candidate is not complete until:

- all 13 screenshot-review defects are addressed;
- customer-first copy contains no rejected technical/roadmap language;
- the hybrid Orbital Ribbon Flow replaces the rejected warped-strip Canvas;
- tokens, typography, eyebrows, shadows, gradients and buttons are coherent;
- relevant unit and design tests are GREEN;
- typecheck/lint/build/W3C checks are GREEN where applicable;
- browser screenshots are reviewed at all seven required widths when the environment allows;
- visual acceptance is given by the user;
- remote GitHub GREEN is not claimed until an actual remote run passes.
