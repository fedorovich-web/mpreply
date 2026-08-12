# Respio public site design closure

Date: 2026-08-12  
Branch: `work/0.1.104-yandex-foundation`  
Release context: `0.1.104` development; project version remains `0.1.103` until release closure  
Status: approved design direction, pending implementation plan

## 1. Purpose

Close the public-site visual design as one coherent production system instead of continuing independent Hero experiments and incremental section polish.

The closure keeps the current product-first Hero concept and improves its composition, hierarchy, motion and responsive behavior. It explicitly does **not** return to the rejected orbital/WebGL/"AI atom" direction.

The intended outcome is a public site that feels product-specific, premium and operationally credible while remaining fast, accessible and understandable to marketplace sellers.

## 2. Final Hero decision

The production Hero is based on the existing `HeroProductFlowCanvas` concept:

`buyer question + product context + seller rules -> AI processing -> verified ready answer`

This is the final narrative model for the Hero.

The old orbital/WebGL Hero (`HeroFlowCanvas`, `HeroFlowWebGL`, orbital scene contracts and related historical visual candidates) is not a production direction and must not be reintroduced by documentation, fallback markup, tests or later visual cleanup.

### 2.1 Design ratio

The final Hero should retain roughly:

- 70% of the current production `HeroProductFlowCanvas` semantics and concrete product evidence;
- 30% of the successful art-direction ideas from the standalone Product Pipeline 2.0 demo: stronger hierarchy, one shared visual environment, a more compact processing node, a more dominant final-answer state and subtler signal flow.

The demo is a design reference, not source code to copy verbatim.

### 2.2 Hero hierarchy

The scene must read in one glance as:

1. incoming buyer question;
2. product facts/context;
3. seller rules/constraints;
4. compact AI processing/checking node;
5. final answer as the visual culmination.

The final answer must be the strongest object in the scene. The AI processor must be important but must not compete with the answer for visual dominance.

### 2.3 Shared visual environment

The Hero should read as one integrated product scene rather than four unrelated dashboard cards floating in empty space.

Use:

- controlled tonal background/environment;
- depth through scale, overlap, elevation and restrained parallax;
- soft local lighting or radial emphasis where useful;
- fewer visible borders;
- shadows and tonal separation aligned with global tokens;
- clear source-to-processing-to-result direction.

Do not turn the entire scene into a giant bordered card. The environment may be bounded by composition, tonal contrast and ambient depth without becoming another nested container.

### 2.4 Input objects

The left/input side contains three distinct information sources:

- buyer question;
- product context;
- seller rules.

The product context should continue using believable product data and the existing real product image where appropriate. Seller rules should be represented concisely, for example through three short rule chips or equivalent compact evidence.

These inputs should not all have equal size or visual weight. Product context is the primary evidence object; question and seller rules are supporting inputs.

### 2.5 AI processing node

The processing node becomes more compact and more clearly machine-like than a normal dashboard card.

It communicates three ideas only:

- intent/question understanding;
- evidence/context verification;
- rule/risk validation.

Avoid a tall card containing another grid of cards. The node may use a darker or stronger branded tonal treatment if contrast is accessible in both themes, but it must remain part of the Respio system rather than becoming a separate cyberpunk object.

### 2.6 Final answer

The ready-answer object is the dominant visual endpoint.

It shows:

- the concrete answer;
- a small confidence/verification state only if it is meaningful and product-true;
- short evidence rows showing why the answer is supported;
- a clear publication/readiness state.

Evidence should be scan-friendly and not become a dense nested-card stack. Prefer lightweight rows or tonal groups over multiple framed boxes.

### 2.7 Connections and motion

Signal paths remain part of the Hero but become quieter.

The current concept of animated flow between inputs, processor and answer is retained, with these rules:

- thin directional connections rather than broad glowing hoses;
- substantially less glow than the current broad canvas strokes;
- fewer moving signal particles than the current implementation;
- motion serves reading order and processing feedback, not decoration;
- pointer parallax is subtle and progressive enhancement only;
- no random drift, bouncing, elastic easing or continuous attention-seeking motion;
- pause or reduce work when the Hero is offscreen or the document is hidden where practical;
- `prefers-reduced-motion` produces a complete static composition.

## 3. Hero copy and layout

The public Hero stays customer-first and product-specific.

Desktop layout remains an asymmetric two-column composition:

- copy on the left;
- product pipeline scene on the right.

H1 must remain naturally readable in Russian and must not be narrowed into excessive line breaks. Primary and secondary CTAs remain side by side while they physically fit.

The Hero must explain value before implementation details. Avoid internal terms such as scheduler, adapter, retry, runtime, queue or provider-state terminology.

## 4. Homepage final story

The homepage is normalized to one deliberate sequence:

1. Hero — product promise plus Product Pipeline 2.0 scene;
2. marketplace coverage — where Respio works;
3. customer outcomes — what repetitive work is removed and what quality is preserved;
4. concrete question-to-answer proof — deeper product example if needed beyond the Hero summary;
5. one operational workspace — reviews/questions/chats and daily handling;
6. automation and control — rules, exceptions and manual approval as secondary control;
7. AI/model routing — only current, product-true model claims;
8. pricing/trial — current commercial truth only;
9. resources — practical guides/content entry points;
10. FAQ — real objections and search intent;
11. final CTA.

Sections may combine adjacent narrative responsibilities when this improves rhythm, but the customer must receive all eleven ideas in a clear order.

## 5. Homepage visual rhythm

The page must avoid a repetitive card-grid rhythm.

Use a mix of:

- asymmetric product demonstrations;
- concise outcome rows;
- controlled card groups where comparison is genuinely useful;
- full-width tonal moments;
- editorial text + product artifact compositions;
- deliberately different density between explanatory and conversion sections.

Do not redesign every section into a unique micro-system. All sections remain inside one Respio visual language.

## 6. Public routes

The closure applies the same system to the existing public routes, including at minimum:

- `/`;
- `/features`;
- `/marketplaces`;
- marketplace detail routes;
- `/pricing`;
- `/demo`;
- `/resources`;
- `/contacts`;
- `/about` if present;
- legal routes where shell consistency matters.

This is a consistency and polish pass, not a mandate to rebuild every route from scratch.

Each route should share:

- typography hierarchy;
- eyebrow treatment;
- container widths;
- section spacing;
- button geometry and states;
- surface/radius/shadow language;
- focus states;
- responsive rules;
- light/dark semantic tokens;
- header/footer behavior.

## 7. Design-system cleanup

`DESIGN.md` and the public-site master brief must be reconciled with production reality.

Historical rejected Hero candidates may remain in Git history but must not remain as competing current contracts in authoritative documentation.

The current design authority after this batch must state unambiguously:

- light-first public system;
- Electric Pulse brand roles;
- product-first Product Pipeline Hero;
- no orbital/WebGL Hero as current direction;
- no generic glassmorphism or gradient-soup backgrounds;
- borders only when structurally useful;
- semantic tokens for light/dark themes;
- performance and accessibility outrank decoration.

Unused legacy Hero implementation files should be removed only after tests/search confirm that they have no valid consumer or fallback responsibility.

## 8. Responsive closure

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
- no card/content collisions;
- no unreadable Hero scaling;
- H1 wrapping remains intentional;
- CTA layout changes only when needed;
- product pipeline remains understandable rather than merely stacking every desktop object;
- touch targets remain usable;
- no essential content depends on hover;
- section spacing remains deliberate.

Mobile Hero may simplify signal animation and composition, but it must preserve the same narrative: inputs -> checking -> ready answer.

## 9. Dark theme

Dark mode is a semantic adaptation of the same design, not a second art direction.

Requirements:

- same component geometry and hierarchy;
- semantic surfaces and text colors rather than blanket inversion;
- restrained brand glow;
- accessible text/status contrast;
- product images and evidence remain legible;
- processing node remains distinguishable from surrounding surfaces without becoming an isolated neon panel.

## 10. Accessibility and performance

The closure must preserve or improve the existing quality baseline:

- keyboard navigation and visible focus;
- WCAG AA-oriented contrast;
- semantic headings/regions;
- labels for interactive elements;
- reduced-motion support;
- no hover-only essential information;
- stable layout with no Hero-driven CLS;
- animation based on transform/opacity/canvas drawing rather than layout churn;
- no unnecessary heavy runtime dependency for the Hero;
- no return to Three.js/WebGL for the production Hero.

## 11. Technical boundaries

This batch is public-site design work only.

It does not:

- alter marketplace backend correctness;
- repeat Yandex provider probes;
- write to protected Yandex Question ID `27265525`;
- implement Ozon or Avito;
- change billing/product truth merely to improve marketing copy;
- merge, deploy, tag or force-push;
- bump the version before release closure.

The existing Yandex correction and its CI blocker remain separate engineering concerns.

## 12. Implementation boundaries

Expected implementation focus:

- `apps/web/app/page.tsx`;
- `apps/web/components/public-site/HeroProductFlowCanvas.tsx`;
- `apps/web/components/public-site/HeroProductFlowCanvas.module.css`;
- shared public shell/components only where global consistency requires it;
- `apps/web/styles/public-site.css`, theme/tokens where justified;
- selected public route layouts/components;
- design/unit/E2E/a11y tests covering the affected contracts;
- `DESIGN.md` and `docs/product/public-site-master-brief.md` reconciliation.

Avoid unrelated dashboard redesigns and broad component rewrites.

## 13. Test-first contracts

Implementation follows TDD for behavioral/design contracts that can be automated.

Required RED/verification contracts include at minimum:

1. homepage imports only the approved product-flow Hero, not the rejected orbital Hero;
2. authoritative public design docs identify Product Pipeline as the current Hero and do not present orbital/WebGL as a current candidate;
3. Hero contains the required semantic inputs: buyer question, product context and seller rules;
4. Hero contains one processing stage and one dominant ready-answer outcome;
5. reduced-motion mode preserves a complete static scene;
6. Hero does not introduce `three`, WebGL or another heavy 3D runtime dependency;
7. no `transition: all` is introduced;
8. responsive tests/visual review cover the seven required widths;
9. light and dark representative public routes pass accessibility checks;
10. public shell and affected routes retain existing semantic token contracts;
11. resources entry point exists in the homepage narrative if the route is available;
12. existing SEO metadata, schema and conversion actions remain valid after visual restructuring.

Automated visual tests support but do not replace human browser review.

## 14. Visual acceptance procedure

The design is not considered closed by CI alone.

Before declaring completion:

1. run design/unit/type/lint/build/W3C gates;
2. run relevant E2E and accessibility suites;
3. render/review the homepage at all seven required widths;
4. review representative secondary public routes in both themes;
5. check Hero motion in normal and reduced-motion modes;
6. verify no old orbital/WebGL visual appears in production paths;
7. obtain explicit user visual acceptance.

Only after this acceptance should the public-site design be described as frozen/closed.

## 15. Definition of done

Public-site design closure is complete when:

- the product-flow Hero is the single authoritative production Hero;
- the Hero reads clearly as question/product/rules -> AI checking -> ready answer;
- the ready answer is the strongest visual endpoint;
- the scene feels integrated rather than a flat dashboard card grid;
- motion is restrained, directional and accessible;
- homepage story includes the missing resources layer and has deliberate visual rhythm;
- major public routes share one consistent visual system;
- light and dark themes are coherent;
- all seven responsive widths have been visually reviewed;
- authoritative design documentation matches implementation;
- rejected orbital/WebGL concepts cannot be mistaken for current direction;
- relevant automated gates are green;
- the user explicitly approves the final rendered site.
