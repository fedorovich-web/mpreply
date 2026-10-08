# FAQ and contact form — local verification, 30 September 2026

This report covers the dirty local checkout on `feat/auth-email-resend`, based on HEAD `42e5810`. It is not a production deployment certificate.

## Changes

- FAQ uses the supplied AVIF assets, desktop categories and accordion layout. On mobile, the illustration is below the full-width hero text, shortcuts precede the questions and the support card follows them.
- The page uses the shared header and footer. Hero typography and geometry use shared tokens.
- Public sections use equal top and bottom padding: 96 px on desktop, 80 px at tablet widths and 64 px on mobile.
- Removed 55 labels above public headings in both languages, including their unused style selectors. Form labels remain visible.
- Contact submission posts to the backend. Name, email, topic, message and consent are validated. Failed input is preserved; unchanged retries reuse the request key; concurrent duplicate submissions are blocked.
- Contact mail uses the existing Resend client: from `no-reply@mpreply.ru`, to the user's separately hosted `support@mpreply.ru` mailbox, with the visitor in Reply-To.
- API configuration is checked before requests rather than during module import. A missing production API address cannot cause the contacts page to return HTTP 500. Requests still reject missing or invalid configuration before sending any data.

## Passing checks

- TypeScript, ESLint and CSS syntax checks.
- Design tokens: 59 tests.
- API client, contact form and FAQ focused unit tests: 18 tests.
- Contact routes and authentication email content: 8 backend tests; Ruff for contact files.
- Full configured browser suite: 65 tests.
- Accessibility suite: 22 tests. FAQ is also tested with axe at 320, 390, 768 and 1440 px.
- Browser assertions verify AVIF delivery, minimum 14 px text, 18 px hero descriptions, accordion behavior, keyboard categories, localized links, mobile image geometry, absence of overlines and shared section padding across routes.

The production build passed. W3C/Nu passed for 49 stylesheet sources and 62 rendered routes.

Lighthouse passed the configured assertions for the homepage, features, marketplaces, pricing, FAQ and contacts. The local desktop runs scored 100 for accessibility, best practices and SEO on all six routes; performance was 100 on five routes and 99 on contacts. These are local laboratory measurements, not production field data.

## Remaining project checks

The full unit suite currently has **367 passed, 143 failed** across 120 files. Failures include missing old files such as `HomeApprovedShell.tsx` and `marketplaces-approved.css`, source assertions about earlier layouts/brand colors and cross-app contracts. These require individual review; this report does not classify every failure as obsolete or harmless.

Visual checks: **9 passed, 10 failed**. All ten saved desktop/mobile baselines differ from the requested spacing, hero and label changes. They must be reviewed against the approved sources; snapshots have not been regenerated to suppress failures.

API delivery tests replace the mail provider. Actual mailbox receipt, real seller account actions, domain/TLS operation, payment processing and production runtime remain separate checks.
