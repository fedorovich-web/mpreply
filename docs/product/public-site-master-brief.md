# Respio public site — master product, marketing and conversion brief

## Business objective

Convert marketplace sellers, operators and agencies into qualified demos/onboarding without overstating readiness. Every page must answer: what problem is removed, what is truly supported, why automation is controllable, and what the next action is.

## Audience and JTBD

- Seller with growing review/question volume and little support capacity.
- Marketplace operator responsible for speed, quality and rating risk.
- Multi-brand/multi-store operator needing one workflow.
- Agency managing several seller organizations.

Jobs: keep queues attended, answer faster, preserve brand voice, auto-send when confidence/policy allow, route risky cases to people, and understand failures/usage/bottlenecks.

## Product truth

Respio is auto-first; semi-auto is optional. Wildberries is the current MVP execution path. Ozon/Yandex Market/Avito must not be called production-ready until implemented and runtime-verified. Groq/Qwen 3.8 is backend-only; the browser never receives the provider key. Credentials are backend-only and encrypted. SafetyGate, rules, idempotency, retries and auditability are real mechanisms, not slogans.

## Route architecture

| Route | Intent | Role |
|---|---|---|
| `/` | Understand Respio | Acquisition |
| `/features` | Evaluate capabilities | Consideration |
| `/marketplaces` | Coverage/readiness | Qualification |
| `/marketplaces/wildberries` | WB review/question workflow | Search + conversion |
| marketplace-specific other pages | Channel-specific intent with honest readiness | Search + expectation |
| `/pricing` | Commercial intent | Qualification |
| `/demo` | See actual workflow | Conversion support |
| `/resources` | Topical authority | Discovery/SEO |
| `/contacts` | Reach operator/company | Trust |
| `/privacy`, `/terms` | Legal disclosures | Trust |

## Homepage story

Hero: category, outcome, auto-first control model, one primary CTA, real product artifact. Then problem framing, decision pipeline (`message → context → AI draft → SafetyGate → rules → auto-send or review → adapter → audit`), product surfaces, marketplace readiness statuses, safety/failure handling, and one clear close.

Avoid fake counters, three equal CTAs, generic AI slogans, decorative gradients and ambiguous checkmarks implying integrations are live.

## Messaging

Priorities: operational control, throughput, auto-first guardrails, one workspace, visibility into usage/failures/quality. Russian must sound native and concrete. Avoid untranslated jargon and inflated AI claims.

## CTA rules

One primary conversion action per page. Labels describe actual next state: `Открыть демо`, `Посмотреть, как работает Respio`, `Обсудить подключение`. Do not use `Попробовать бесплатно` before a real free plan exists.

## Credibility policy

Allowed: real product mechanics/UI/readiness labels/security controls/tests. Forbidden: invented logos, testimonials, user counts, savings, prices, uptime, compliance badges and integrations.

## Mobile UX

No desktop-card feed simply stacked. No horizontal overflow at 320px. Critical copy cannot be hover-only. Controls remain keyboard/touch accessible, forms use labels/types/autocomplete, sticky UI does not dominate viewport.

## Acceptance criteria

Product claims match implementation; every route has clear intent/conversion role; desktop/tablet/mobile intentionally designed; tokens used; typecheck/lint/build pass; Playwright/axe/Lighthouse pass where browser available; snapshots are intentionally approved; logo/palette/type/icon system reviewed coherently.
