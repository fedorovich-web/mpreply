# Respio patch 0.1.16

## Scope

Public-shell and interaction polish after the `0.1.14` hero foundation and `0.1.15` secondary-route redesign.

## Changed

- Replaced the passive `<details>` mobile navigation with a controlled accessible menu that supports explicit open/close state, Escape closing, backdrop closing and link-close behavior.
- Added current-page states to desktop and mobile navigation where a single route can be identified unambiguously.
- Improved the theme switch so its accessible name always describes the next action and `aria-pressed` reflects the active dark theme.
- Strengthened the public footer with a clearer brand statement, conversion CTA, marketplace readiness links and grouped product/resources/legal navigation.
- Converted homepage FAQ items into keyboard-accessible disclosure controls.
- Rewrote remaining homepage implementation jargon into natural Russian product language where possible.
- Kept the approved `#6F33AB` violet + `#79D6B0` mint palette and the existing Handhold-inspired hero canvas unchanged in core composition.
- Synchronized project version to `0.1.16`.

## Not changed

- Backend business logic, database models, Alembic migrations, worker behavior or marketplace send flow.
- Dashboard/SaaS application UI.
- Marketplace readiness truth: Wildberries remains the current MVP path; Ozon, Yandex Market and Avito remain planned.
- Megamarket is not presented as supported because a complete official review/question receive-and-reply API contract is still unconfirmed.

## Validation

See the final delivery note for the exact checks that were actually executed in this environment.
