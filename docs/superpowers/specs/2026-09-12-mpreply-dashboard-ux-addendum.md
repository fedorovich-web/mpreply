# MPReply Dashboard UX Addendum

**Parent spec:** `docs/superpowers/specs/2026-09-12-mpreply-full-product-redesign-copy-seo-design.md`

## Purpose

The authenticated MPReply workspace must not only match the approved public visual direction. It must be materially easier to understand and operate for sellers, marketplace managers, team leads and administrators.

The dashboard is a work tool. Visual consistency with the public site is required, but operational clarity takes priority over decorative marketing treatment.

## UX principles

### 1. Start from the user's job, not the backend entity

Every screen must answer three questions quickly:

1. What needs my attention?
2. What can I do here?
3. What happens after I do it?

Internal implementation nouns such as `worker`, `revision`, `provider`, `SafetyGate`, `tenant`, `pipeline`, raw enum values and API route names must not be primary user-facing concepts.

### 2. One dominant next action

Each page or selected item should have one visually dominant next action when one exists.

Examples:
- new marketplace connection → `Подключить`;
- existing connection → `Управлять`;
- prepared reply requiring review → `Одобрить и отправить`;
- draft reply → `Подготовить ответ` or `Отправить` depending on state;
- failed synchronization → `Повторить` or `Проверить подключение`.

Secondary actions remain available but must not compete with the primary task.

### 3. Statuses must explain meaning and consequence

Avoid status-only interfaces where the user must interpret internal terminology.

A status should communicate:
- what happened;
- whether action is required;
- what the next action is.

For example, prefer `Нужна проверка — в ответе не хватает данных о товаре` over a bare `manual_review` or `SafetyGate: review`.

### 4. Keep context beside the action

Do not force the user to jump between screens to understand an item.

For an incoming review/question/message, keep the useful context near the reply workflow:
- marketplace;
- product/account;
- rating/type where applicable;
- customer text;
- relevant product or knowledge context;
- current reply/draft;
- reason for review or failure;
- history only when needed.

### 5. Progressive disclosure

Normal users see operational information first. Technical diagnostics are placed behind explicit details/diagnostics affordances or restricted admin views.

Examples that should not dominate ordinary seller screens:
- provider/model telemetry;
- token counts;
- latency;
- raw request/response payloads;
- worker job identifiers;
- internal checkpoint names.

### 6. Filters serve decisions

Filters must reflect how users actually triage work:
- marketplace;
- review/question/message type;
- unanswered / prepared / review required / sent / failed;
- rating where relevant;
- product/account where supported;
- search.

Do not expose backend enums directly. Preserve filter state where practical when navigating between list items.

### 7. Empty, loading and error states are first-class UX

Every data-driven workspace must define:
- initial loading;
- empty organization/account;
- no results for current filters;
- recoverable API error;
- permission/read-only state;
- partial marketplace/integration failure where relevant.

Empty states should explain the next useful action instead of displaying generic `Нет данных`.

### 8. Permissions are visible before failure

Owner/admin/manager/viewer differences should be reflected in the UI before a user clicks an action that the backend will reject.

Backend authorization remains the security boundary, but the UI should not tease unavailable actions and rely on a later `403` as normal UX.

### 9. Dense but calm visual hierarchy

Use the approved MPReply light-blue design system with dashboard-specific density:
- cool white/light surfaces;
- blue primary actions and selected states;
- restrained shadows;
- clear borders;
- compact typography hierarchy;
- readable tables/lists;
- no marketing-scale gradients behind routine controls;
- no nested-card maze.

### 10. Responsive workflows, not stacked desktop screenshots

At desktop widths, use list/detail or list/context patterns where they reduce navigation.

At tablet/mobile widths:
- prioritize the active task;
- collapse secondary navigation intentionally;
- turn split panes into clear drill-down flows;
- keep primary actions reachable;
- avoid horizontal overflow and tiny table-only interfaces.

## Screen-level UX requirements

### Обзор

Prioritize exceptions and workload, not decorative KPI cards.

Recommended order:
1. items requiring attention;
2. current incoming workload;
3. processing/connection problems;
4. automation outcome summary;
5. usage/plan information only if actionable.

### Обращения

Preferred desktop model: triage list + selected conversation/context + reply workflow.

The user should be able to:
- filter;
- select an item;
- read the customer message and product context;
- prepare/edit/send a reply;
- understand state changes;
without bouncing across several unrelated pages.

### На проверке

Every item must show a human-readable reason for review. Editing, approval and return-for-rework actions must be clearly distinct.

### ИИ-ассистент

Treat AI as part of the reply workflow, not a developer console.

Show:
- source message/context;
- answer settings actually supported;
- prepared answer;
- reason for caution if any;
- regenerate/edit/approve actions.

Hide provider telemetry from the default view.

### Автоматизация

Rules should read like seller logic, for example:
`Если оценка 4–5 и нет стоп-слов → ответить автоматически`.

The UI should make rule priority, enabled state and consequences understandable without requiring knowledge of raw enums.

### Интеграции

Marketplace card state is account-aware:
- no account → `Подключить <marketplace>`;
- account exists → `Управлять <marketplace>`.

Connection pages should show account identity, health/sync state and actionable errors without exposing secrets.

### Аналитика

Lead with operational questions:
- сколько обращений приходит;
- сколько уже обработано;
- что требует ручного внимания;
- где возникают задержки/ошибки;
- какие площадки/товары создают больше нагрузки.

Raw provider metrics are diagnostics, not the primary story.

### Тариф и лимиты

Explain:
- current plan;
- period;
- used vs available limits;
- what happens near/at a limit;
- how to change plan/contact sales if supported.

Do not invent prices, discounts or plan benefits.

### Superadmin/internal

Technical terminology is permitted where operationally necessary, but layout, status semantics, confirmation patterns and error handling must still follow the same UX quality bar.

## Acceptance criteria

- A seller can identify the primary action on each main workspace screen within one scan.
- No primary workflow requires understanding internal backend terminology.
- Data-driven pages have explicit loading/empty/filter-empty/error/read-only states.
- Permissions are reflected before action, while backend RBAC remains authoritative.
- Desktop workflows minimize unnecessary page changes; mobile workflows are intentionally composed.
- All key actions have visible success/failure feedback.
- Keyboard navigation, focus, contrast and accessible names pass automated coverage.
- The authenticated product is unmistakably the same MPReply brand as the approved homepage, without becoming a marketing landing page inside the app.
