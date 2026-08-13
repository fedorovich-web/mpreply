# Ozon client integration design

## Status and sources

Approved for implementation on 2026-08-13 after the user selected the next marketplace-development stage. Product truth comes from `PRODUCT.md`, `DESIGN.md`, the existing Ozon backend vertical, and the official Ozon Seller API contract recorded in `2026-08-12-ozon-marketplace-vertical-design.md`. TanStack Query v5 invalidation behavior was checked through Context7. No marketplace credential or live provider request is used by this frontend stage.

## Goal

Make Ozon a real customer-manageable integration in the authenticated workspace without changing backend behavior or implying live production certification.

## Product boundary

The screen manages the backend capabilities that already exist:

- create an Ozon account with a display name, Client ID, API key and reply mode;
- validate provider permissions;
- show whether reviews, questions or both streams are available;
- show key expiry when the backend exposes it as validated metadata;
- edit the display name, reply mode and, when needed, replace Client ID;
- rotate or revoke the API key;
- request a manual synchronization;
- inspect safe health reasons, scheduler streams, recent sync jobs and integration events.

It does not add Ozon chats, OAuth, subscription purchase, provider billing, live API validation or a production-ready claim.

## Credential contract

`MarketplaceAccount.seller_id` stores Ozon Client ID internally and the encrypted credential stores the API key. Both fields are required when creating an Ozon connection. Neither raw value is returned by the account response.

The UI therefore follows these rules:

- both creation fields use non-autofilled credential inputs;
- the detail view says that Client ID is stored but not displayed;
- replacing Client ID is an explicit optional action, never a prefilled field;
- rotation accepts only a new API key;
- successful create/rotate clears the local secret state immediately;
- safe masks, normalized scopes and expiry metadata may be rendered;
- request IDs may be rendered on errors, but raw provider bodies and credentials may not.

## UX structure

The Ozon route is `/app/integrations/ozon`. It uses the existing operations-first integration layout:

1. security notice;
2. account list and create form;
3. selected account health and safe permissions;
4. scheduler stream state and recent history;
5. settings, validation, manual sync, key rotation and revocation.

Owner and admin roles can manage the account. Manager and viewer roles receive the existing read-only presentation and no credential or mutation controls.

Customer-facing scope labels are:

- `fetch_reviews` and `send_review_reply` → `Отзывы и ответы на отзывы`;
- `fetch_questions` and `send_question_reply` → `Вопросы и ответы на вопросы`.

Duplicate labels are collapsed. An empty validated scope set is shown as an account problem, matching the backend fail-closed behavior.

## Component architecture

The Yandex Market screen already contains the required account, observability and mutation behavior. Copying it would create a second large implementation with drifting RBAC and error handling. Instead:

- extract `ReviewQuestionIntegrationWorkspace`, parameterized by a typed provider configuration;
- keep `YandexMarketIntegrationWorkspace` as a thin configuration wrapper;
- add `OzonIntegrationWorkspace` as a thin configuration wrapper;
- keep Wildberries unchanged because its simpler screen is not currently equivalent;
- reuse existing API schemas, CSS classes and design tokens;
- return the invalidation promise from mutation success handlers so TanStack Query keeps the pending state until related account data is refreshed.

No new dependency, CSS token, database field or backend endpoint is introduced.

## Errors and state

The screen preserves generic safe errors and adds Ozon-specific customer wording for:

- invalid credentials;
- insufficient review/question permissions;
- provider rate limiting;
- unavailable provider;
- cursor cycles and page-budget stops;
- internal synchronization failure with request ID when available.

Loading, empty, error, read-only, pending-validation, valid, revoked and sync-failure states remain explicit.

## Verification

Implementation follows TDD:

1. one RED unit group for catalog availability, exact Ozon creation payload and read-only boundaries;
2. GREEN implementation with unchanged Yandex unit coverage;
3. unit coverage for permissions, expiry, stream health and secret absence;
4. Chromium interaction test, axe check and a desktop visual baseline;
5. one final affected frontend gate: unit/design, Impeccable, typecheck, lint, CSS/W3C, build, E2E, accessibility, visual and Lighthouse.

No visual snapshot is regenerated merely to hide an unexplained difference.
