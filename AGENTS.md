# MPReply Agent Instructions

These rules apply to AI coding agents and automated contributors working in this repository.

## Mandatory context before UI/copy changes

Read in order:
1. `PRODUCT.md`
2. `DESIGN.md`
3. `docs/product/public-site-master-brief.md` for public/marketing work
4. `docs/seo/public-site-seo-spec.md` for SEO work
5. `docs/design/ui-ux-quality-standard.md`
6. Relevant architecture and integration specifications under `docs/superpowers/specs/`
7. Existing tokens/components before adding visual primitives

## Product truth

MPReply centralizes marketplace reviews, buyer questions and supported buyer messages, prepares contextual replies with AI and handles routine cases automatically or after human review according to workspace rules.

Product UI supports Wildberries, Ozon, Yandex Market and Avito. Do not return Ozon, Yandex Market or Avito to `planned` UI messaging. `Подключить` versus `Управлять` is determined by whether the current organization has a connected account for that marketplace.

Public merge/deploy claims still require matching backend/runtime release certification. Do not merge a frontend production claim ahead of the backend work that makes it true.

Billing/payment-provider wiring is a separate launch-stage task after the site is running on its production domain. Do not redesign billing or payment-provider UX in this branch, do not replace the existing tariff price fallback with a new product state, and do not invent checkout/payment actions.

Do not market exact AI provider/model names unless those exact capabilities are implemented and verified on the deployment branch.

Never fabricate customers, logos, testimonials, ratings, metrics, prices, discounts, uptime, compliance claims or free-trial periods.

## Copy and SEO rules

Public copy must be informed by real competitor/category research rather than invented generic SaaS language. Extract useful positioning patterns, information hierarchy, objections, vocabulary and CTA structure; never copy competitor wording verbatim.

Write native, specific Russian around seller jobs and actual MPReply behavior. If a sentence could appear unchanged on any generic AI SaaS, rewrite it.

Marketplace detail pages require genuinely unique copy and search intent; do not produce them by name substitution.

## UI and UX rules

The latest approved light-blue MPReply homepage preview is the visual source of truth for the redesign.

- Public pages: spacious, editorial, conversion-oriented.
- Dashboard/admin: same brand system, but calmer, denser and task-oriented.
- Preserve approved section spacing/composition when fixing unrelated technical issues.
- Reusable colors, surfaces, borders, radii, shadows, spacing and motion belong in shared tokens.
- Do not mix icon systems or use emoji as production icons.
- Avoid glassmorphism, card-everything layouts, uncontrolled glow, decorative motion and generic AI visuals.
- Respect reduced motion and intentional 320/390px mobile composition.

Operational screens must make it clear:
- where the user is;
- what is happening;
- what needs attention;
- what action is available;
- what happens after that action.

Primary UX copy should not expose developer implementation terminology when a normal seller-facing phrase exists.

## Required frontend checks

From `apps/web`:

```bash
npm run test:unit
npm run test:design-tokens
npm run typecheck
npm run lint
npm run validate:css-syntax
npm run build
npm run validate:w3c
npm run test:e2e
npm run test:a11y
npm run test:visual
npm run lighthouse
```

Repository/container gates must also remain green when applicable.

Visual snapshots are not a substitute for review. Never regenerate snapshots only to silence a failure.

## Quality policy

Objective automated checks are mandatory. Subjective design heuristics are not allowed to block user-approved design work.

Never:
- weaken a test because implementation is inconvenient;
- suppress lint/type/a11y findings without technical justification;
- add dead code or unused dependencies;
- introduce hidden side effects or duplicated architecture;
- use blanket exceptions/fail-open behavior;
- use `npm audit fix --force` as a default remediation;
- claim a check passed unless the current tree actually ran it.

## Security and permissions

Marketplace/provider credentials remain backend-only and encrypted where required. Backend RBAC is the security boundary. Frontend permission-aware UX should remove knowingly unavailable mutations and explain read-only state without assuming hidden controls are security.

Tenant isolation, idempotency, retries and external-write safety must not be weakened by frontend redesign work.
