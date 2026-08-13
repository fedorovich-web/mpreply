# MPReply client workspace — visual, navigation and language redesign

Status: approved direction, implementation contract
Date: 2026-08-13

## 1. Objective

Turn the authenticated MPReply workspace from a functional wireframe-like interface into a production-grade operating surface for marketplace sellers and operators.

The redesign must improve three qualities together:

1. visual maturity and product trust;
2. task-oriented navigation and information hierarchy;
3. customer language informed by marketplace search vocabulary and product marketing, without keyword stuffing or internal engineering jargon.

The workspace remains an authenticated product surface and must stay excluded from search indexing. SEO-informed language in this document means using the words customers already use to describe their work, not attempting to rank private application routes.

## 2. Users and usage context

Primary users are marketplace sellers, operators, support managers and team leads. They may be using the workspace for long desktop sessions while processing reviews, questions and chats. They need to understand current work, exceptions and next actions quickly, including during failures or periods of high message volume.

The product voice is calm, direct and specific. Copy must not assume knowledge of terms such as `workspace`, `SafetyGate`, `billing-ready`, `usage`, `pipeline`, `review queue` or provider runtime concepts.

## 3. Visual direction

The selected direction is an operations cockpit rather than a marketing dashboard.

- The application stays light-first, with a controlled near-white work canvas.
- The navigation becomes a deliberate graphite/indigo contrast surface using existing MPReply theme roles.
- Electric Pulse violet identifies primary actions and current selection. Cyan is not used as generic decoration.
- Success, warning, danger and information colors remain semantic and never become brand decoration.
- Onest remains the single interface type family.
- The interface gains maturity through hierarchy, proportion, density, alignment and state detail rather than gradients, glass, glow or ornamental motion.
- No new color, font, shadow, radius or motion family is introduced. If implementation reveals a missing reusable role, it must be added to `DESIGN.md` and the centralized theme tokens rather than written as a page-local literal.

The memorable product idea is: MPReply shows what needs a decision first, then the evidence and settings behind it.

## 4. Navigation information architecture

The abstract `Работа` or `Ежедневная работа` group is removed. The three primary destinations appear first without a group label:

- `Сводка` → `/app/dashboard`
- `Отзывы, вопросы и чаты` → `/app/inbox`
- `Ответы на проверке` → `/app/review-queue`

The remaining destinations are grouped by customer task:

### Настройка ответов

- `Правила автоответов` → `/app/automation-rules`
- `Стиль ответов` → `/app/instruction-sets`
- `Данные для ответов` → `/app/knowledge-base`

### Маркетплейсы

- `Подключённые кабинеты` → `/app/integrations`

### Отчёты

- `Статистика ответов` → `/app/analytics`

### Компания

- `Сотрудники` → `/app/team`
- `Настройки` → `/app/settings`
- `Тариф` → `/app/billing`
- `История изменений` → `/app/audit-log`

Superadmin navigation remains a separately gated internal destination. Existing URLs remain unchanged so bookmarks, tests and internal links continue to work.

## 5. Screen language contract

Every screen must immediately answer:

1. what the user can do here;
2. what currently needs attention;
3. what the next action changes;
4. what information MPReply will use or preserve.

Primary screen titles change as follows:

| Current title | Approved customer title |
| --- | --- |
| Операционный центр | Сводка по отзывам и вопросам |
| Обращения | Отзывы, вопросы и чаты |
| Ручная проверка без отключения auto-first режима | Ответы на проверке |
| Автоматические ответы с понятными правилами и SafetyGate | Правила автоответов |
| Наборы AI | Стиль ответов |
| База знаний | Данные для ответов |
| Подключения маркетплейсов и состояние API | Подключённые кабинеты маркетплейсов |
| Операционная аналитика | Статистика ответов |
| Тариф, usage и лимиты | Тариф и использование |
| Команда | Сотрудники и доступ |
| Журнал действий | История изменений |

English kickers and internal labels such as `Live analytics`, `Accounts`, `Selected account`, `Billing-ready`, `Reply editor`, `AI flow`, `usage` and `SafetyGate` are removed from customer-facing copy or translated into the action they represent.

`SafetyGate` remains an internal mechanism. Where its behavior must be visible, the customer-facing heading is `Когда ответ нужно проверить`, followed by concrete conditions and consequences.

## 6. Application shell

### Sidebar

- The sidebar is a stable contrast anchor, not another white panel.
- Logo, navigation and organization context form one vertical hierarchy.
- Primary destinations appear before grouped configuration destinations.
- The active destination uses a filled existing brand-soft role plus a non-color signal such as weight or marker geometry.
- Group headings are quieter than destination labels but remain readable.
- No decorative counters or invented notification totals are added.

### Top bar

- The top bar shows the active organization and authenticated user without duplicating the page title.
- Organization switching remains available when more than one organization exists.
- Logout remains secondary.
- Mobile navigation retains Escape/backdrop behavior, focus restoration and scroll locking.

### Page header

- One customer-facing H1 names the task.
- Supporting copy is limited to one useful sentence and does not restate the H1.
- A contextual primary action may sit at the right when the screen has one clear creation action.
- Repeated all-caps eyebrows are removed. Location is communicated by navigation and the page title.

## 7. Dashboard composition

The dashboard is reorganized around decisions, not a grid of equal cards.

1. `Сводка по отзывам и вопросам` introduces the selected organization and the period represented by the data.
2. A dominant `Нужно сделать` panel shows unanswered messages, answers awaiting review, failed sends and connection problems. Rows include a clear label, count and destination.
3. Four key measures form one continuous summary band rather than four isolated cards: received messages, automatic replies, waiting for an answer and AI-prepared drafts.
4. A lower evidence area shows response volume, negative reviews and response time with lower visual priority.
5. Tariff information is reduced to a compact contextual status and link. It must not compete with operational work.

The dashboard must also support loading, clear, partial-error and first-run states without layout collapse.

## 8. Core workspace compositions

### Rules for automatic replies

- The list/detail editor remains operational and tenant-scoped.
- The first layer explains when MPReply sends automatically and when it requests review.
- Technical evaluation order is expressed as plain-language priority, not architecture documentation.
- Destructive and status-changing actions name their consequences.

### Reply style

- `Стиль ответов` replaces `Наборы AI` throughout navigation, headings and supporting copy.
- The list shows saved styles and the organization default.
- Detail shows tone, company rules, signature and prohibited phrases.
- Marketplace assignments use `Какой стиль используется в кабинете` rather than technical assignment terminology.

### Data for replies

- `Данные для ответов` replaces `База знаний` in primary navigation and H1 copy.
- The screen explains that MPReply uses only active, verified text as factual context.
- Search, category and status filters remain visible.
- Detail clearly shows scope, content status and last update.
- File and PDF upload controls remain absent because ingestion and verification are not implemented.

### Inbox and review

- Inbox language consistently uses `отзыв`, `вопрос`, `чат` and `ответ`.
- The review screen uses `Ответы на проверке`, not `Review Queue`.
- Filters remain encoded in the URL.
- Status labels describe the customer-visible condition rather than internal state constants.

### Marketplace accounts

- Integration screens use `Подключённые кабинеты`, `Доступ`, `Права`, `Синхронизация` and `Состояние подключения`.
- API keys are described only where users manage them.
- Unsupported production claims remain prohibited.

### Reports, tariff and management

- Analytics headings use customer terms such as `Обращения и ответы`, `По маркетплейсам`, `По товарам` and `Использование AI`.
- Billing uses `Тариф и использование`; internal provider readiness copy is removed.
- Team uses `Сотрудники и доступ`.
- Audit uses `История изменений` and customer-readable action names.

## 9. Product marketing and SEO-informed language inside the workspace

Private application routes are not optimized for organic ranking. They use search-informed terminology to reduce the gap between what visitors read before signup and what they see after signup.

Approved vocabulary includes:

- automatic replies to marketplace reviews;
- replies to buyer questions;
- marketplace chats;
- rules for automatic replies;
- reply style and company tone;
- verified product and company information;
- answers awaiting review;
- connected marketplace accounts;
- response statistics.

Copy must not repeat keywords unnaturally. Benefits appear only where they explain an action or consequence. No fabricated savings, automation rates, customer metrics, prices, testimonials or unsupported marketplace readiness claims are added.

Public acquisition pages retain their separate SEO architecture. The workspace keeps `noindex` behavior and must not be added to the sitemap.

## 10. Responsive behavior

- Desktop keeps the contrast sidebar and dense work area.
- Tablet collapses the sidebar into the existing controlled drawer and reduces secondary content before primary work.
- Mobile uses one deliberate column, full-width primary actions where needed and compact summary rows.
- List/detail workspaces show the list first and the selected detail below or as a navigable state; no squeezed two-column layout remains.
- Long Russian labels must wrap without clipping.
- Horizontal page overflow is prohibited at 375, 390, 430, 768, 1024, 1280 and 1440 pixels.

## 11. Interaction and accessibility

- Existing semantic focus, contrast and state tokens remain authoritative.
- Controls expose default, hover, focus-visible, active, disabled, loading and error states where applicable.
- State is never communicated by color alone.
- Loading copy names the data being loaded.
- Empty states explain the next useful action.
- Errors explain what failed and offer a recoverable action when one exists.
- Motion is limited to short state feedback and respects reduced motion.
- No new icon system or UI dependency is introduced during this redesign.

## 12. Engineering boundaries

- Backend contracts, RBAC and marketplace execution behavior are not changed by the visual redesign unless a verified frontend defect requires a separately tested fix.
- Routes and API paths remain stable.
- Real marketplace APIs are not called during visual development or tests.
- Mock data used in screenshots must be visibly demonstrative and must never be presented as business evidence.
- Existing user changes are preserved; only intended workspace files are staged.

## 13. Verification

Implementation is not complete until the affected package passes one grouped final gate:

- focused frontend unit tests for navigation, headings, states and responsive contracts;
- `npm run design:detect`;
- `npm run typecheck`;
- `npm run lint`;
- `npm run build`;
- relevant Playwright E2E;
- relevant accessibility tests;
- visual comparison and manual browser review at the required widths;
- `git diff --check`.

Visual snapshots are updated only after rendered review confirms an intentional design change. A technical pass does not replace user review of the final PNGs.

## 14. Acceptance criteria

The redesign is accepted when:

- the workspace no longer reads as a wireframe or uniform card grid;
- the first three navigation destinations need no abstract group heading;
- a seller can understand every primary menu label without internal product knowledge;
- every screen uses one consistent customer vocabulary;
- dashboard work requiring a decision is visually dominant;
- English and engineering-facing labels are absent from customer surfaces;
- the layout is visually mature, responsive and accessible;
- no new product capability or business claim is invented;
- final desktop and mobile PNGs are reviewed by the user.
