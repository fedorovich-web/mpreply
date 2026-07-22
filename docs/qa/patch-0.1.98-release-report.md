# Respio 0.1.98 — Answer ledger foundation

## Scope

Backend-only patch. Public pages, public components, visual styles, spacing contracts, Hero Canvas and pricing range CSS are unchanged.

## Root cause

The public product contract had already moved to non-expiring answer packages, but the backend still relied on monthly subscription counters.
`UsageEvent` was analytical and could not guarantee idempotent balance changes, concurrent reservations, successful-publish-only debit,
release after failure, trial expiry or zero-balance autopublish blocking.

## Implemented

- backend answer-package catalog: trial 400, paid 500 / 5,000 / 10,000 / 15,000 and enterprise/custom;
- 7-day trial with a two-marketplace limit;
- tenant-scoped credit grants with database idempotency constraints;
- reply reservations with expiry and revisioned reserve/release ledger keys;
- append-only answer ledger with separate total-balance and available-balance deltas;
- debit only after successful marketplace publish;
- reservation release after retryable/terminal failure and when the marketplace already has an answer;
- zero-balance stop before the marketplace network request, including valid manual-review transitions from retry and stale-sending states;
- automatic trial grant for newly created organizations;
- migration-time 7-day/400-answer trial bootstrap for existing organizations, avoiding an immediate zero-balance cut-off after upgrade;
- read-only billing API for active answer packages and organization balance;
- answer-balance projection in the existing billing overview;
- trial marketplace connection enforcement;
- synchronized release version `0.1.98` and Alembic head `20260722_0010`.

## Deliberately not included

- public UI or CSS changes;
- payment provider and webhook processing;
- purchase/refund endpoints;
- Ozon, Yandex Market or Avito adapters;
- scheduler/reconciliation for ambiguous marketplace timeouts;
- removal of legacy subscription/monthly-usage tables.

## Verification

See the patch README and final delivery summary for commands actually executed, passed checks and environment-blocked checks.
