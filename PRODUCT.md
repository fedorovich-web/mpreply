# Respio — Product Context

Status: authoritative product context for design, marketing, frontend, SEO, copy and AI coding agents.
Version: 0.1.27

## Product

Respio is a multi-tenant SaaS for marketplace sellers, operators and agencies. It centralizes reviews and questions, prepares replies with AI, applies SafetyGate and automation rules, and sends approved replies through supported official integrations. Respio is an operational product, not a generic AI text generator.

## Operating model

- Default mode: auto-first.
- Semi-automatic/manual review: optional fallback or explicit workspace choice.
- Low-confidence, risky or under-contextualized replies must not be blindly auto-sent.
- Marketplace credentials stay backend-only, encrypted at rest, excluded from frontend responses and normal logs.
- External sending must respect official marketplace APIs, limits and policies.

## Current implementation truth

- Wildberries: current MVP adapter and real execution path.
- Ozon, Yandex Market and Avito: do not imply production-ready sending until official contracts are verified, adapters implemented and runtime-tested.
- The authenticated integrations workspace exposes account setup, credential validation, rotation, revocation and manual sync for all four registered adapters. These controls do not certify live provider access or sending without seller credentials.
- Groq: backend-only provider; MVP model is `qwen/qwen3.8-27b` with strict structured output and reasoning disabled for reply generation.
- Existing layers: auth, organizations, RBAC, integrations, Inbox, AI drafts, SafetyGate, automation rules, worker queue, auto replies, manual review, analytics, billing foundation, admin and Docker deployment foundation.

## Primary audiences

1. Individual seller — fast setup, safe defaults, visible outcomes.
2. Marketplace manager — one Inbox, filters, state clarity and reliable AI behavior.
3. Team lead/support manager — queues, approvals, analytics, audit and roles.
4. Agency/multi-workspace operator — tenant isolation, repeatable onboarding and reporting.

## Jobs to be done

- Collect customer reviews/questions in one queue.
- Reduce response time without sacrificing accuracy or marketplace compliance.
- Keep brand tone consistent.
- Route uncertain cases to humans.
- See unanswered, risky, failed or delayed work.
- Measure workload, automation, response speed, AI usage and cost.

## Brand voice

Calm, competent, concise, specific and operational. Use native Russian, concrete verbs, evidence and explicit limitations. Never use fake urgency, fabricated customers/logos/testimonials/metrics/prices, “магия AI”, “100% безопасно”, or unsupported claims.

## Public redesign progress

- `0.1.14`: approved Signal Flow foundation — full header, light-first theme, violet/mint tokens and animated hero canvas.
- `0.1.15`: secondary public routes aligned to the same system; public copy prefers natural Russian product language over internal implementation jargon.
- `0.1.16`: public shell polish — active navigation, accessible mobile menu, clearer theme switching, stronger footer and expandable FAQ.

## Quality foundation progress

- `0.1.17`: frontend unit-test foundation, automated design-token/contrast tests and CI/local-gate enforcement added before the next substantial dashboard vertical slice.

## Product dashboard progress

- `0.1.18`: Automation Rules became a live, tenant-scoped workspace over the existing backend CRUD/evaluation model. Owner/admin roles can create, edit, enable and disable rules; manager/viewer roles remain read-only. Organization responses now expose the current membership role so the UI does not guess authorization from hidden controls or post-click `403` responses. Critical Automation Rules unit, E2E and accessibility contracts are part of the release tooling.

## Public visual-system stabilization · 0.1.19

- The public site uses self-hosted Onest with optimized Russian/English WOFF2 subsets for weights 400, 500, 600 and 700.
- Public typography, colors, semantic states, page/surface backgrounds, gradients, spacing, radii, shadows, focus rings, transition durations/easings and Canvas parameters are centralized in CSS custom properties rather than page-local visual literals.
- The default public background is a neutral near-white system, avoiding uncontrolled beige/white/light-violet section jumps.
- CTA hierarchy is singular and contextual: the hero retains the primary connection action, the header opens the demo, and the final conversion section uses a contact-oriented action instead of repeating the same primary label.
- Process steps are visually equal; SafetyGate remains meaningful through content and status semantics rather than an oversized third-step card.
- Rendered public HTML and public stylesheet sources are checked by local Nu HTML Checker tooling, with CSS syntax validation enforced separately.

## Public-site conversion priorities

1. Make Respio understandable on the first screen.
2. Explain why it is more than a text generator.
3. Show auto-first + SafetyGate + human fallback clearly.
4. Build trust through architecture, security and readiness honesty.
5. Move qualified visitors toward a real demo/contact/onboarding action.

## Public routes

`/`, `/features`, `/marketplaces`, `/marketplaces/wildberries`, `/marketplaces/ozon`, `/marketplaces/yandex-market`, `/marketplaces/avito`, `/pricing`, `/demo`, `/resources`, `/contacts`, `/privacy`, `/terms`.

Do not create mass SEO pages without unique value and verified intent.

## Product UI priorities

Scan speed, state clarity, operational confidence, low cognitive load, accessibility, responsive behavior, visible error/retry states and safe destructive actions.

## Hard constraints

- Performance-first and Core Web Vitals-aware.
- Accessibility mandatory.
- Reusable visual values live in CSS variables/design tokens.
- No mixed icon systems or emoji as production UI icons.
- No generic purple/blue AI landing page, decorative glassmorphism, excessive glow, nested cards or decorative gradients as defaults.
- Respect `prefers-reduced-motion`.
- No production claim without implementation evidence.

## Tooling policy

- Playwright: E2E, responsive and visual testing.
- `@axe-core/playwright`: automated accessibility checks.
- Lighthouse CI: performance/SEO/accessibility regression monitoring.
- Composio: intentionally excluded from current core stack; not needed for public-site design, SEO, marketing or current marketplace adapters.

## Definition of done for public redesign

Approved IA/copy hierarchy, semantic HTML, correct metadata/canonical, responsive behavior, keyboard accessibility, no serious/critical configured axe violations, critical Playwright coverage, no fabricated claims, Lighthouse budgets, desktop/mobile visual QA and approved brand system.

## Product dashboard progress · Live AI Assistant · 0.1.20

- AI Assistant is now a real tenant-scoped workspace over the existing `/api/messages` and `/api/ai/drafts` contracts instead of a static Sprint-era information screen.
- Owner/admin/manager memberships can generate drafts through the backend-only Groq/Qwen 3.8 flow; viewer memberships remain read-only and can inspect persisted draft history.
- The workspace exposes the operational result that matters: generated answer, provider/model, prompt version, confidence, token usage, latency and safety flags, with loading/error/retry/empty/read-only states.
- The browser never receives an Groq API key and does not call the provider directly.

## Product dashboard progress · Live Integrations · 0.1.21

- Integrations is now a live tenant-scoped workspace over the existing marketplace-account API instead of a static Sprint-era card grid and non-functional Wildberries form.
- The overview loads real marketplace accounts for the active organization, reports active/problem states, and keeps Ozon, Yandex Market and Avito explicitly unavailable until real adapters are implemented and verified.
- The Wildberries workspace supports the existing backend capabilities: create account, inspect masked credential fingerprint, validate credentials, update account metadata/default response mode, rotate credentials, revoke credentials and request a manual sync.
- Owner/admin memberships receive management controls; manager/viewer memberships remain read-only. Backend RBAC remains the security boundary.
- Raw marketplace credentials are accepted only in create/rotate forms, sent to the backend, cleared from local form state after success and never read back from marketplace-account API responses.

## CI recovery · 0.1.22

Restored the tracked frontend unit-test foundation required by the Quality Gate. This closes the gap where incremental patches assumed `vitest.config.ts`, `vitest.setup.ts`, and the baseline API/theme tests already existed in the repository.

## CI E2E recovery · 0.1.23

Three Chromium E2E failures from the `0.1.22` Quality Gate were corrected without changing product behavior: Automation Rules now uses an unambiguous semantic heading locator, and the AI draft-history mock no longer shadows the generation endpoint. A unit regression contract protects the route matcher.


## CI E2E recovery · 0.1.24

The Automation Rules browser test now uses a stateful mock contract: a created rule remains available when the workspace refetches the collection after creation. This fixes the GitHub Chromium failure without changing customer-facing product behavior.


## Accessibility CI recovery · 0.1.25

Patch 0.1.25 is a focused accessibility hotfix for the remaining GitHub Quality Gate contrast blockers. It does not add product scope or change marketplace/backend business logic.


## Accessibility contrast hardening · 0.1.26

Patch 0.1.26 closes the remaining Wildberries accessibility failure from GitHub Actions and hardens the visual system instead of applying another selector-specific color patch. The audit covered semantic status usage across public-site and dashboard CSS, selected/nested surfaces, brand-soft active states, light/dark theme contracts and representative browser-level axe flows.

The key architectural fix is that text-bearing soft surfaces are no longer translucent. Their computed contrast no longer changes depending on the parent card or selected row underneath. The audit also corrected latent dark-theme issues in kicker text, active navigation, brand-soft labels, processing states and the danger-button text contract. A dedicated dark-theme accessibility suite is now part of the frontend a11y gate.

