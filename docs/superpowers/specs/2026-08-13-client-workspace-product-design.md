# MPReply Client Workspace Product Design

**Status:** approved design for implementation planning

**Date:** 2026-08-13

**Scope:** authenticated customer workspace, supporting backend contracts, responsive UX, accessibility and verification

## Objective

Turn the current authenticated MPReply interface into a launch-ready operating system for marketplace communication. The result must support the complete customer workflow rather than expose implementation stages, provider names, API paths or roadmap placeholders.

The workspace must cover existing operational areas and add real customer surfaces for Team, Settings, Audit Log, AI instruction sets and Knowledge Base. Empty decorative pages are not acceptable.

## Product principles

- The workspace is auto-first. Manual review is an explicit fallback for risky, ambiguous or policy-blocked cases.
- Every screen answers: where am I, what is happening, what needs attention, what can I do, and what happens after the action.
- Customer-facing language is concise native Russian. Internal labels such as `MVP adapter`, `OpenRouter`, `SafetyGate`, `workspace`, `usage evaluation`, endpoint paths and sprint plans are not shown.
- Marketplace credentials remain backend-only and encrypted at rest. The browser never reads credentials back from the API.
- Data and actions are tenant-scoped. Backend authorization is the security boundary; hidden frontend controls are not treated as authorization.
- No fabricated metrics, prices, customer evidence, integration capabilities or marketplace states.

## Information architecture

The main navigation is grouped by customer task instead of implementation layer.

### Work

- **Главная:** actionable attention queue, integration health, recent sync state and secondary operational metrics.
- **Обращения:** one queue for reviews, questions and chats.
- **Ручная проверка:** cases that require an explicit human decision.

### Automation

- **Правила:** automation rules and SafetyGate behavior in customer language.
- **Наборы AI:** named instruction sets used to generate replies.
- **База знаний:** structured text facts available to reply generation.

### Marketplaces

- **Подключения:** consolidated health and credential state.
- Provider-specific account management for Wildberries, Ozon, Яндекс Маркет and Авито only to the extent supported by verified backend contracts.

### Insights

- **Аналитика:** workload, response time, automation, failures and AI consumption without invented KPIs.

### Management

- **Команда:** members, roles and invitations.
- **Настройки:** organization identity and operational defaults.
- **Тариф и лимиты:** verified plan and usage data.
- **Журнал действий:** append-only organization audit history.

The standalone technical AI Assistant navigation item is removed. Draft generation, model evidence and safety results belong to the message workflow and automation configuration.

## Visual direction

The quality benchmark is [Vella — Branding & Product Experience for Fintech](https://www.behance.net/gallery/250608259/Vella-Branding-Product-Experience-for-Fintech), used as a maturity reference rather than a layout template.

Applicable Vella qualities:

- disciplined hierarchy and spacing;
- confident typography;
- coherent light product environment;
- restrained accent color;
- polished real product screens;
- consistent component geometry and iconography.

Fintech charts, device mockups, decorative brand presentation and Vella-specific compositions are not copied.

MPReply remains light-first with dark mode as a semantic adaptation of the same system. Graphite text and neutral surfaces carry most of the interface. Existing violet and cyan brand tokens are reserved for active controls, focus, selection and limited product emphasis. Error, warning, review, processing and success use dedicated semantic colors.

Dashboard page headings use a compact product scale: 32–40 px on desktop and 28–32 px on mobile. The current global 58 px heading must not apply to authenticated product pages. Cards remain within restrained radii and may use either a subtle border or compact elevation, not a broad shadow plus border. Identical card grids, nested cards, decorative gradients and glassmorphism are prohibited.

One coherent icon family is used throughout the workspace. Color never carries status alone. Motion is limited to functional state changes and navigation, with a `prefers-reduced-motion` alternative.

## Core workflows

### First-run onboarding

The recoverable onboarding sequence is:

1. Create an organization.
2. Connect a marketplace account.
3. Validate access through the supported provider contract.
4. Run the first synchronization.
5. Choose the default response mode.
6. Review or customize the default AI instruction set.
7. Show readiness and take the user to the actionable dashboard.

Progress is derived from persisted organization, account, credential-validation, sync and instruction-set state. The browser does not invent completion flags. A user may leave and resume without losing completed steps.

### Actionable dashboard

The dominant surface is **Требует внимания**, ordered by operational risk and recency. It includes unanswered messages, manual-review cases, failed or ambiguous outbound replies, credential problems and failed or stale synchronization where the backend exposes verified state.

Secondary surfaces show marketplace health, recent synchronization, recent audited actions and compact workload trends. Every problem links directly to the relevant filtered queue or configuration surface. Metrics never receive equal visual weight merely because they exist.

### Message workspace

Inbox supports reviews, questions and chats. Filters are represented in the URL so a state can be refreshed and shared within the same authorized organization. Desktop uses a task-focused list/detail composition. Mobile uses sequential list → message → action navigation instead of compressing three columns.

Message details bring together customer content, product/account context, reply history, generated draft, applicable instruction set, SafetyGate result and the permitted action. Technical provider details appear only when they help an authorized operator diagnose a real state and are translated into customer language.

## AI instruction sets

`AIInstructionSet` is a named organization-owned policy profile containing:

- name;
- response tone;
- brand rules;
- reply signature;
- prohibited phrases;
- active state;
- default state;
- creator/updater identity and timestamps.

Every organization has exactly one active default set. A marketplace account may reference another active set. Resolution is account assignment first, then organization default.

The existing `seller_settings` values are migrated into the organization's initial default set. Migration must preserve current tone, brand rules, reply signature and prohibited phrases. The legacy single `knowledge_base` text is migrated into an active general knowledge entry when non-empty.

An active/default/assigned set cannot be deleted. The UI requires reassignment or a new default first. Archiving is preferred to destructive deletion. If an account assignment becomes invalid, resolution falls back only to a valid default. If no valid default exists, automatic generation/sending fails closed and the case is routed to a safe recoverable state.

Owner and admin may create, edit, assign, archive and restore sets. Manager and viewer have read access only.

## Knowledge Base

Knowledge Base contains structured text records only. PDF/DOCX upload, parsing, embedding ingestion and opaque bulk import are out of scope.

`KnowledgeEntry` contains:

- organization ID;
- title;
- category;
- content;
- status: draft, active or archived;
- optional marketplace account ID;
- optional product ID;
- creator/updater identity and timestamps.

Categories are a validated finite set covering company information, delivery, returns, warranty, product guidance and other verified seller facts. Search and filtering operate on tenant-scoped fields using parameterized SQLAlchemy expressions.

Reply generation receives active organization-wide entries plus active entries matching the message account and product. Selection and total character count are bounded on the backend. Instruction policy and factual context are placed in separate prompt sections; knowledge content cannot override system rules, SafetyGate or prohibited-phrase policy.

Owner and admin may create, edit, activate, archive and restore entries. Manager and viewer have read access only.

## Team, settings and audit

The existing team backend remains authoritative. The Team screen supports member listing, pending invitations, invitation creation/revocation, role changes and member removal. Owner memberships cannot be demoted or removed through ordinary member actions. Users cannot accidentally remove their own active membership. The UI exposes role capabilities before confirmation.

Settings covers verified organization fields and response defaults. Credential management remains in marketplace connections. Any new mutable organization field requires explicit validation, audit events and tenant-scoped authorization.

Audit Log remains append-only. Owner/admin can filter by action category, entity, actor and date. Raw action codes are mapped to stable Russian labels. Details exclude secrets, tokens, credentials, raw prompts and unsafe provider payloads. Manager/viewer receive a clear forbidden/read-only state and cannot fetch audit records through the API.

## Permissions

| Capability | Owner | Admin | Manager | Viewer |
| --- | --- | --- | --- | --- |
| Work with messages and permitted replies | Yes | Yes | Yes | Read only |
| Manage automation rules | Yes | Yes | Read only | Read only |
| Manage AI instruction sets | Yes | Yes | Read only | Read only |
| Manage knowledge entries | Yes | Yes | Read only | Read only |
| Manage team and invitations | Yes | Yes | No | No |
| Change organization settings | Yes | Yes | No | No |
| Read audit log | Yes | Yes | No | No |

Backend checks are mandatory for every write and restricted read. Frontend permission states explain capability but never replace backend checks.

## API and data integrity

New endpoints follow current FastAPI/Pydantic/SQLAlchemy conventions and reject unknown request fields. UUIDs, enums, lengths, date ranges, cursor values and cross-entity relationships are validated. An account or product assigned to a set/knowledge entry must belong to the same organization.

Database constraints enforce valid statuses and a partial unique index permits only one active default instruction set per organization. Default changes lock the organization's instruction-set rows within one transaction. Account/product relationships are loaded and checked against the organization before assignment; a mismatched tenant identifier is rejected before mutation.

Audit events cover creation, update, default change, assignment, activation, archiving and restoration. Audit metadata contains identifiers and changed field names, not secret or full content values.

No SQL is constructed through user-controlled string concatenation. Search, sorting and filters use explicit allowlists and bound parameters.

## Error, loading and state behavior

Every workspace surface implements:

- skeleton loading that preserves the final shell, list rows and detail-panel geometry;
- useful empty state with a permitted next action;
- safe error copy and retry;
- forbidden/read-only state;
- partial or stale data indication where independent requests differ;
- duplicate-submit protection;
- specific success feedback;
- confirmation for destructive or security-sensitive actions.

API endpoint names, stack traces, internal service names, database errors and provider secrets are never displayed. A request ID may be shown for support when available.

## Responsive and accessibility contract

The implementation is explicitly reviewed at 390, 768, 1024 and 1440 px, with an additional 320 px overflow guard. Authenticated pages must have no horizontal document overflow.

On mobile, the sidebar becomes a modal drawer with backdrop, Escape/backdrop close, focus return, focus containment and background scroll lock. Team, Knowledge Base and Audit Log tables render stacked label-value rows below 768 px. Numeric analytics tables retain local horizontal scrolling with a visible scroll region instead of widening the document.

Controls target approximately 44 px on touch layouts. All form controls have visible labels, status is conveyed by text as well as color, focus is visible, keyboard order follows visual order and reduced motion is respected.

## Verification strategy

Implementation follows vertical TDD slices. Each slice receives one focused RED run, implementation, one focused GREEN run and review. Unchanged suites are not repeated.

Backend coverage includes:

- schema validation;
- tenant isolation;
- RBAC for every role;
- cross-organization ID rejection;
- default-set concurrency/integrity;
- assignment fallback and fail-closed behavior;
- bounded knowledge selection;
- prompt-policy separation;
- audit redaction;
- parameterized query and SQL-injection regressions.

Frontend coverage includes:

- schemas and API clients;
- permission states;
- loading, empty, error, retry, partial and success behavior;
- onboarding resume;
- navigation and URL filters;
- mobile drawer interaction;
- no internal implementation copy;
- no authenticated-page overflow at target widths.

The final gate runs once after all slices are integrated:

- backend Ruff, strict Pyright, unit/security tests, compileall and Alembic head/history;
- frontend `design:detect`, unit tests, typecheck, lint and build;
- Playwright E2E for critical authenticated workflows;
- axe accessibility checks for all primary workspace routes;
- authenticated desktop/mobile visual regression;
- Lighthouse on representative authenticated routes;
- `git diff --check` and repository integrity scripts.

Visual snapshots are reviewed, not regenerated merely to silence failures. Marketplace provider calls, production deployment, version bump and dependency changes remain separate explicit operations unless required by an approved implementation task.

## Delivery slices

1. Shell, navigation, responsive foundation and customer-language cleanup.
2. Actionable dashboard and onboarding.
3. Message workspace completion for reviews, questions and chats.
4. AI instruction-set backend, migration, account assignment and UI.
5. Structured Knowledge Base backend and UI.
6. Team, Settings and Audit Log customer surfaces over existing contracts.
7. Analytics/billing polish and cross-workspace consistency.
8. Full security, accessibility, responsive, visual and release verification.

Each slice must leave the branch in a coherent state and may be reviewed independently. No slice may advertise a capability before its backend and verification are present.

## Explicit exclusions

- PDF/DOCX upload or parsing.
- Vector database or semantic retrieval until real scale and relevance evidence justify it.
- Fabricated marketplace readiness or provider behavior.
- Separate role-specific applications with divergent navigation.
- Decorative device mockups inside the product.
- New visual token system unrelated to existing MPReply tokens.

## Acceptance criteria

The design is complete when the authenticated workspace has no roadmap placeholders or internal implementation copy, all specified sections are backed by real tenant-scoped behavior, primary workflows are usable on desktop and mobile, security boundaries are enforced server-side, and the final verification strategy passes with fresh evidence.
