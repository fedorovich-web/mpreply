# Respio 0.1.92 — public hero spacing, inner hero panels and pricing recovery

## Scope

0.1.92 fixes the visual regressions reported after 0.1.91 across the public site hero system, pricing hero, calculator, marketplace cards and shared heading rhythm.

## Changes

- Restored a compact SEO/marketing homepage H1 with three controlled lines: automatic answers for reviews, questions and marketplace chats.
- Restored pricing H1 to the accepted package-based direction: `Пакеты автоответов без подписки`.
- Added a shared public hero spacing contract for label → H1/H2 → subtitle across homepage and inner pages.
- Restored H2 scale through shared selectors for section headings and two-column public sections: 48px desktop.
- Kept lead/subtitle copy on the shared 18px token.
- Fixed homepage hero copy/canvas spacing to reduce overlap risk on compact desktop widths.
- Reworked inner hero right panels: compact height, 32px panel headline, consistent label styling and smaller list rows.
- Changed pricing trial card headline to a single `400 ответов для проверки работы сервиса` heading instead of a detached 400 value and a second heading.
- Improved trial-card copy so the free test checks the service on real reviews, questions and chats rather than repeating autopublish-check phrasing.
- Tightened marketplace and feature cards to remove oversized gaps between icon, title and description.
- Kept pricing package volume padding at zero and left-aligned with price.
- Improved calculator copy and result-card compactness while keeping the blue CTA on the light result card.
- Added unit/design contracts for the updated public hero and pricing visual behavior.

## Non-goals

- No visual snapshots were approved.
- No pricing values were changed.
- No backend entitlement or marketplace adapter logic was changed.
- No broad CSS cleanup was attempted beyond targeted recovery rules and tokens.

## Validation

- npm ci
- npm ls inflight rimraf glob --all
- npm run test:unit
- npm run test:design-tokens
- npm run typecheck
- npm run lint
- npm run validate:css-syntax
- npm run build
- npm run validate:w3c
- npm run design:detect
- python scripts/check_integrity.py
