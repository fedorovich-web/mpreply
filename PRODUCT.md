# MPReply — Product Context

Status: authoritative product context for design, frontend, dashboard UX, marketing, SEO, copy and AI coding agents.

## Product

MPReply is a multi-tenant SaaS workspace for marketplace sellers, marketplace managers, teams and agencies. It centralizes customer communication from marketplaces, prepares contextual replies with AI, applies workspace rules and sends replies automatically or after human review.

The product is an operational communication system, not a generic AI text generator.

## Core workflow

1. Connect marketplace accounts.
2. Collect reviews, buyer questions and supported buyer messages into one workspace.
3. Add product, marketplace and team context to the incoming request.
4. Prepare a reply with AI.
5. Apply automation and review rules.
6. Send automatically or route the reply to a person for review.
7. Keep status, errors and meaningful history visible to the team.

## Current product truth

The product UI supports these marketplace integrations:

- Wildberries;
- Ozon;
- Yandex Market;
- Avito.

All four are shown as available integrations in MPReply. The primary integration CTA is account-state based rather than marketplace-specific:

- no account connected for the current organization → `Подключить <marketplace>`;
- account already connected → `Управлять <marketplace>`.

Do not hard-code a Wildberries-only UX or return Ozon, Yandex Market or Avito to `planned` messaging.

### Release certification

Product/UI support and production release certification are separate concepts. Public production claims must be deployed only together with the backend/runtime work that makes the corresponding integration true in production.

A frontend branch may implement the final supported-state UX before that backend work lands, but it must not be merged or deployed ahead of the required backend/runtime release certification.

### Billing rollout boundary

The current approved public tariff presentation remains in place during this redesign:

- `Старт` — `490 ₽ / мес`;
- `Профессиональный` — `990 ₽ / мес`;
- `Бизнес` — `1 990 ₽ / мес`;
- annual payment presentation — `-20%`;
- approved trial presentation — `14 дней`.

These values are part of the currently approved public-site source of truth. Do not invent additional prices, discounts, crossed-out anchors, urgency or trial terms beyond them.

Production payment-provider wiring is deferred until the site is running on its production domain. Until that deployment step, do not redesign the billing/payment flow, invent checkout actions, or reinterpret the existing tariff presentation as a product error. Billing/provider integration is a separate launch-stage task.

### Public contact truth

The only verified public contact channel is the email `support@mpreply.ru`.

MPReply currently has no public Telegram contact and no public social-network accounts. Do not render Telegram, VK, YouTube or other social links/icons in the public site unless the user explicitly adds and verifies those channels later.

No public office address or support schedule is currently verified. Do not publish a physical office/address, office card, opening hours, response-hours badge or support SLA unless the user explicitly supplies and verifies those details later.

### Public content architecture

MPReply has no public blog. Do not create a `/blog` route, show `Блог` in navigation or footers, or use `/help` as a disguised editorial/blog section. `/help` remains a task-oriented support, knowledge-base and FAQ surface.

## AI capability truth

Normal product and marketing copy should describe the user-facing capability:

- `ИИ готовит ответ`;
- reply generation uses message/product/team context;
- automation rules determine automatic handling versus review where implemented.

Do not publish exact provider/model names as marketing proof unless those exact models are implemented and verified on the branch that will be deployed. Provider/model/token/latency telemetry belongs in diagnostics or explicit technical/admin contexts, not the ordinary seller workflow.

Provider credentials and marketplace credentials remain backend-only. Secrets must never be rendered back to the browser or written to normal logs.

## Operating model

- Automation handles routine cases where configured rules allow it.
- Human review is a first-class path for exceptions, uncertainty and team-controlled workflows.
- The UX should explain why an answer requires attention instead of exposing internal implementation nouns.
- External sending must respect official marketplace API contracts, limits and policies.
- Retries, idempotency and failure handling must avoid duplicate external actions.

## Security and tenancy

- Marketplace credentials are encrypted at rest and backend-only.
- Tenant isolation is mandatory for all organization-scoped data and actions.
- Backend RBAC remains the security boundary.
- Frontend permissions should prevent confusing or knowingly forbidden actions before click, but never replace backend authorization.
- Destructive credential/account operations require explicit, understandable confirmation.

## Primary audiences

1. Individual seller who wants to stop switching between multiple marketplace cabinets.
2. Marketplace manager processing a recurring queue of reviews, questions and buyer messages.
3. Team lead who needs consistent response quality, clear exceptions, rules and visibility.
4. Agency or multi-account operator managing several seller workspaces.

## Jobs to be done

- See customer communication in one workspace.
- Understand what needs attention now.
- Prepare consistent replies with relevant context.
- Automate repetitive cases without losing control of exceptions.
- Know whether an answer was prepared, reviewed, sent, failed or needs action.
- Manage marketplace connections without exposing credentials.
- Understand workload and operational outcomes without raw provider telemetry dominating the UI.

## Public positioning

Core product promise:

> Bring marketplace customer communication into one workflow, prepare contextual replies with AI, automate routine cases and keep control over exceptions.

Public copy should lead with seller outcomes and workflow, not infrastructure terminology.

Allowed proof:
- real product mechanics;
- real supported integrations;
- real UI states;
- implemented security/control mechanisms;
- verified technical quality where relevant;
- the currently approved public tariff and trial presentation listed in this document.

Forbidden proof:
- fabricated customers or logos;
- fake testimonials or ratings;
- invented savings percentages or hours saved;
- fake uptime/compliance claims;
- prices, discounts or trial terms beyond the currently approved commercial presentation;
- exact model/provider claims not backed by the deployment runtime.

## Public routes

`/`, `/features`, `/marketplaces`, `/marketplaces/wildberries`, `/marketplaces/ozon`, `/marketplaces/yandex-market`, `/marketplaces/avito`, `/pricing`, `/demo`, `/help`, `/contacts`, `/privacy`, `/terms`.

Every route needs a distinct purpose and page-specific copy. Marketplace pages must not be generated by mechanically replacing the marketplace name.

## Dashboard priorities

The authenticated product is task-oriented rather than promotional. Priorities:

- scan speed;
- state clarity;
- obvious next action;
- contextual information next to the decision;
- useful loading, empty, error and read-only states;
- low cognitive load;
- safe permissions/destructive actions;
- accessible desktop and mobile behavior.

Normal user-facing navigation:

- Обзор;
- Обращения;
- На проверке;
- ИИ-ассистент;
- Автоматизация;
- Интеграции;
- Аналитика;
- Тариф и лимиты.

## Brand and copy voice

Calm, competent, specific and operational. Use native Russian and concrete verbs. Public copy should be informed by real competitor/category research, then rewritten for MPReply and its actual capabilities. Do not copy competitor wording verbatim and do not invent generic AI/SaaS filler.

## Definition of done for product-facing changes

A product-facing change is not complete until:

- product claims match this document and release dependencies;
- UX states are understandable without developer terminology;
- reusable visual decisions use the shared design system;
- accessibility and responsive behavior are preserved;
- objective unit, type, lint, CSS, build, W3C, E2E, accessibility, visual-regression and Lighthouse checks pass where applicable.
