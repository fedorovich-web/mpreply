# MPReply Blue Public Redesign — Design Specification

## Scope

Redesign the public homepage and shared public visual language around the user-approved light blue MPReply direction while preserving existing product truth, accessibility, performance and security constraints.

## Visual direction

- Light-first page with a near-white foundation and restrained sky-blue section washes.
- Brand primary becomes product blue, not violet. No purple brand gradient, no dark-blue page background.
- Preferred gradient direction: deep product blue into clean sky blue with smooth interpolation and no visible banding.
- Generous vertical rhythm: major sections must read as clearly separate editorial chapters, with substantially more top/bottom padding than the current compressed layout.
- Preserve Onest typography and the existing token architecture. New repeated visual values must be CSS variables.
- Avoid identical section templates. The page alternates composition: hero split layout, tabbed product demonstration, lightweight AI/provider row, asymmetric process flow, metrics row, conversion panel, full footer.
- No glassmorphism, excessive glow, nested card stacks, decorative card-everything grids or gradient text.

## Homepage structure

1. **Header** — compact navigation, `Войти`, and a distinct account/onboarding action. Do not repeat the hero primary CTA label mechanically.
2. **Hero** — left-aligned category/outcome copy and right-side realistic product UI artifact. Primary intent is automatic handling of marketplace reviews/questions with optional human review.
3. **Marketplace/readiness strip** — show marketplace names and real readiness honestly; never imply Ozon/Yandex Market production sending until adapters are runtime-verified.
4. **Unified workspace** — product demonstration with tabs for reviews, questions and the supported communication types. This must visually explain the current workflow rather than become another generic feature-card grid.
5. **AI layer** — lightweight horizontal treatment. Claims must match runtime implementation. Current backend truth is Groq/Qwen 3.8; additional model/provider names may only be shown once actually integrated and verified.
6. **How it works** — four-step asymmetric flow with a connective path and distinct mini-artifacts per step: connect marketplace → receive queue → generate/contextualize → auto-send or review. Do not regress to four identical icon cards.
7. **Outcome/operations** — compact factual benefits using supported product mechanics, not invented customer counts, ratings, savings percentages or testimonials.
8. **Final conversion section** — one concise CTA composition, less copy than the previous draft, visually distinct from the outcome section.
9. **Footer** — complete multi-column footer with product/resources/company/support/legal links.

## Copy and SEO

- One visible H1.
- Primary homepage semantic cluster: automatic replies to marketplace reviews/questions; AI-assisted replies; seller support automation; unified queue/workspace.
- Native Russian, concrete verbs, no AI-template slogans.
- Avoid repeating the brand name throughout body copy; use it only where it adds clarity.
- No fabricated proof: no fake customer counts, testimonials, ratings, prices, marketplace readiness or unsupported model/provider claims.
- CTA labels must describe the next state and be contextual rather than identical across header, hero and closing section.
- Existing canonical/metadata/structured-data rules remain in force.

## Interaction and accessibility

- Tabs use semantic controls, keyboard operation and visible focus.
- Respect `prefers-reduced-motion`.
- No critical information available only on hover.
- Maintain WCAG AA-oriented contrast and current automated axe coverage.
- Mobile is intentionally composed at 320/390px, not merely desktop stacked.

## Security/product constraints

- Marketplace credentials stay backend-only and encrypted.
- Frontend remains presentation-only for provider secrets.
- SafetyGate, RBAC and backend authorization remain unchanged.
- Public claims follow implemented capabilities; design changes do not weaken security controls or imply unsupported integrations.

## Acceptance criteria

- Homepage matches the approved airy blue direction with clearly increased section spacing.
- Unified-workspace tabs and the asymmetric four-step process are both present.
- Header/hero/final CTA labels are not mechanically duplicated.
- Footer is complete.
- Product claims remain truthful.
- Reusable colors/spacing/gradients are tokenized.
- `design:detect`, typecheck, lint and build pass; browser E2E/a11y/visual/Lighthouse are run when CI/browser infrastructure is available.
