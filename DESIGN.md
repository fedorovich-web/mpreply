# MPReply — Design System and UX Direction

Status: authoritative visual and UX source of truth for the public site, authenticated workspace and internal admin screens.

## Design intent

**Clear marketplace operations in one coherent MPReply product.**

The latest approved MPReply public previews are the visual source of truth. For the current secondary-page fidelity pass, the approved handoff renders for `/features`, `/marketplaces`, marketplace detail, `/pricing` and `/demo` take precedence over older visual descriptions. Public pages and the authenticated product must look related: same palette, typography, component character and spacing logic, adapted to different information densities.

Accessibility, semantics, performance and responsive fixes must preserve the approved composition and hierarchy unless a design change is explicitly approved.

## Brand palette

Primary brand family:

- primary action: `#5148E8`;
- action gradient middle stop: `#635BFF`;
- action gradient end stop: `#5964FF`;
- primary hover/deeper accent: `#443BCF`;
- primary active accent: `#3D35C0`;
- approved primary action gradient: `linear-gradient(110deg, #5148E8 0%, #635BFF 58%, #5964FF 100%)`.

`#635BFF` is a gradient stop, not a standalone secondary brand color. Use white and cool near-white/lavender surfaces with dark navy text. Success, warning and danger are semantic colors and remain separate from the brand palette.

Reusable visual primitives belong in shared CSS custom properties: colors, surfaces, borders, radii, shadows, section rhythm, focus rings, transitions and public gradients.

Marketplace brand colors may remain marketplace-specific; they are not MPReply design tokens.

## Two visual lanes

### Public / marketing

Purpose: explain, demonstrate and convert.

Use:
- generous whitespace;
- strong editorial hierarchy;
- realistic MPReply product artifacts;
- restrained violet/indigo brand accents;
- different compositions between sections/pages;
- one clear primary conversion action per context.

Major public desktop sections should usually preserve approximately **112–160px** of vertical separation where the approved composition calls for it.

For the five approved handoff page families, vertical section padding is the approved render spacing + 15px at the top and +15px at the bottom. Do not apply that increment twice through overlapping fidelity layers.

Avoid:
- card-everything layouts;
- identical section templates across every route;
- glassmorphism;
- broad uncontrolled glow;
- gradient text;
- generic AI blobs;
- fake screenshots, testimonials or metrics;
- excessive decorative motion.

### Authenticated workspace / admin

Purpose: help users understand state and complete recurring work efficiently.

The dashboard is visually quieter and denser than marketing, but stays in the same MPReply family. Priorities are scanning speed, stable controls, clear information hierarchy, visible state and obvious next action.

Every operational screen should answer:

1. Where am I?
2. What is happening?
3. **What needs attention?**
4. What can I do?
5. What happens next?

Do not give equal visual weight to every metric, filter and control.

## Typography

- Use the existing self-hosted Onest family.
- Russian copy is the primary quality check for line lengths and wrapping.
- Body text needs comfortable line-height and useful measure.
- Display headings may be compact but must remain readable on 320/390px layouts.
- Do not add tiny uppercase eyebrow text to every section mechanically.
- One coherent type system must cover marketing, tables, forms, dashboard controls and legal pages.

## Public page rhythm

- Major chapters are clearly separated by whitespace, not by arbitrary background stripes.
- Content width stays near the approved 1180–1240px range where existing containers use it.
- Alternate white/cool near-white surfaces only when composition benefits from it.
- Keep the latest approved section padding rather than compressing the page after unrelated fixes.
- On the current approved handoff pages, preserve the render-derived spacing and then add exactly 15px above and 15px below each section.

## Homepage visual contract

### Hero

- Left: category/outcome copy and CTAs.
- Right: dedicated realistic MPReply product-UI WebP.
- Do not put a second active wave/background asset behind the hero UI; the illustration itself provides visual depth.
- Preserve the approved airy spacing and split composition.

### Unified workspace demonstration

`Отзывы / Вопросы / Сообщения` remains real interactive HTML/React, not a screenshot. Tabs must be keyboard accessible and the content should resemble a plausible seller workflow.

### How it works

Use the approved connected horizontal journey. Do not regress to four identical feature cards. Steps should read as one process: connect → receive → prepare → send/review.

### Closing CTA

May use a separate UI WebP plus a restrained wave background. Keep this visually distinct from the hero.

## Secondary public pages

Every public route uses the same visual language but gets a composition appropriate to its purpose.

- `/features`: feature-to-job storytelling, not a homepage duplicate.
- `/marketplaces`: integration discovery and workflow coverage.
- marketplace detail pages: unique marketplace-specific content and structure.
- `/pricing`: clear commercial explanation without invented prices.
- `/demo`: realistic product workflow.
- `/help`: task-oriented support and FAQ entry point.
- `/contacts`: focused onboarding/sales contact.
- `/privacy`, `/terms`: readable legal typography without marketing distortion.

For `/features`, marketplace detail and `/demo`, keep meaningful UI, text, tables, buttons and interaction code-driven. Raster assets are allowed only for approved visual assets and for icon replacements that are demonstrably closer to the supplied renders. One raster asset must remain one file; do not introduce sprites or combined raster UI panels.

Do not solve every page with the same hero + three cards + CTA template.

## Dashboard UX hierarchy

### Overview

Show operational priorities before decorative metrics. Answer what needs attention, what changed and where the user should go next.

### Inbox / Обращения

Prefer a triage/list-detail flow with:
- fast marketplace/type/status filtering;
- message content and product context near each other;
- clear state and next action;
- useful desktop and mobile layouts;
- preserved filter/state semantics when moving between items where feasible.

### На проверке

Put reason for review next to the draft and available decision. Use seller language. Do not expose internal nouns such as `revision`, `worker pipeline` or `SafetyGate` in normal UX.

### ИИ-ассистент

Normal users need source/context, reply style where supported, prepared draft and edit/regenerate/approve actions. Provider/model/token/latency belongs in diagnostics, not the primary screen.

### Автоматизация

Explain conditions as seller decisions: when to answer automatically, which situations require review, whether a rule is enabled and what has higher priority.

### Интеграции

Show connection state, safe account identity, sync/health where useful, actionable errors and RBAC-appropriate actions. `Подключить` versus `Управлять` depends on account state for all supported marketplaces.

### Аналитика

Answer seller questions rather than exposing provider telemetry as the main story.

### Тариф и лимиты

Make period, usage and remaining limits understandable. Never invent pricing.

## States and feedback

Every data-driven workspace must intentionally cover:

- loading: explain what is loading;
- empty: explain why the screen is empty and the next useful action;
- error: explain what failed and what the user can do;
- success: confirm the result without blocking the workflow;
- read-only: explain permission state before the user attempts a forbidden mutation.

Dangerous/destructive actions must be visually distinct and confirmable.

## Forms and actions

- Visible labels, not placeholder-only forms.
- One clear primary action where possible.
- Action copy describes the resulting state (`Сохранить правило`, `Подключить Ozon`, `Одобрить и отправить`).
- Prevent duplicate submission.
- Preserve entered values on recoverable validation errors where safe.
- Do not make the user discover authorization through a post-click 403 if the current role is already known.

## Responsive behavior

Mobile is intentionally composed, not desktop stacked blindly.

At 320px and 390px:
- no horizontal overflow;
- primary actions remain reachable;
- filters do not dominate the viewport;
- dense tables become suitable mobile patterns rather than squeezed columns;
- critical state is never hover-only;
- long Russian labels/headings wrap intentionally.

For public handoff fidelity, explicitly review 1086px, 1024px, 768px and 430px layouts in addition to normal desktop/mobile baselines. The pixel width of an exported reference image is not by itself a responsive breakpoint specification.

## Motion

Use short opacity/transform transitions for useful state feedback. Avoid bounce/elastic motion, layout-property animation and decorative sequences that slow recurring work. Respect `prefers-reduced-motion`.

## Accessibility

- WCAG AA-oriented contrast.
- Semantic HTML and meaningful heading hierarchy.
- Visible focus.
- Keyboard access to all interactive controls.
- Tabs support Tab, ArrowLeft, ArrowRight, Home and End.
- Color is never the only state signal.
- Automated axe is mandatory but does not replace semantic/manual review.

## Design governance

The user is the final judge of subjective visual quality. Do not use a subjective design heuristic as a blocking CI gate.

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
- production Compose/container validation.

Visual snapshots are evidence, not an excuse to accept a design regression. Never update snapshots only to silence a failure.

## Absolute anti-patterns

Reject:
- fake proof or unsupported product claims;
- generic AI-template copy;
- arbitrary hard-coded duplicate visual systems;
- endless nested cards;
- meaningless pills;
- mixed icon languages;
- important status available only on hover;
- dashboard pages that lead with implementation telemetry instead of user tasks.
