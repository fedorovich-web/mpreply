# AI reply credit contract — draft, 2026-09-27

## Why this is required

The public pricing draft grants 300 / 800 / 1,600 AI replies per month, plus a separate 350-reply grant during the 14-day trial. Paid replies carry over; trial replies expire. The billing migration seeds Start, Growth, Team, and Agency with `price_month_minor = NULL` and empty `limits_json`; it does not define the public commercial catalog. As of 2026-09-30, reply generation uses durable credit grants and reservations instead of a monthly draft-count check. The existing `UsageEvent` continues to record token usage separately from customer credits.

This document defines the contract needed before the public promise can be released. It does not activate pricing, grant credits, or change the current Groq test path.

## Customer-facing unit

- One successfully persisted **final AI draft** consumes one customer reply credit, including a deliberate regeneration that creates a new draft.
- A scenario may call one or several OpenRouter models internally. Model calls are provider cost events; they do not individually consume customer credits.
- Provider failures, invalid model output, and a request that fails before a draft is persisted consume zero customer credits. Any reserved credit must return to the available balance.
- A retry of the same client operation must return the original draft or its in-progress state. It must never create a second draft or a second debit for that operation.
- Paid grants have no expiry timestamp and require an active paid subscription for spending. New monthly grants add to the existing balance. Changing a billing period must not reset previously granted paid credits. Trial grants expire after 14 days.

## Durable records and invariants

1. Store per-organization grant lots with nonnegative quantities, changed only inside database transactions that lock the organization's stable row. The balance is derived from the lots.
2. Store immutable credit events for grants, reservations, final consumption, and reservation release. Each event has a tenant ID, source, amount, timestamp, and stable unique idempotency key. Never edit or delete an event to revise history; use a compensating event with a recorded reason.
3. Store one operation record per `(organization_id, client_idempotency_key)` with states `reserved`, `completed`, or `released`, a reservation timestamp, and the resulting `draft_id` when completed. Enforce uniqueness in the database.
4. A grant is unique for its entitlement source and source period. Replaying a confirmed billing, trial, or add-on purchase event must never add the same grant twice.
5. `available + reserved + consumed + expired` must equal total granted credits in each lot. A balance view must be derived from or reconcilable with the event ledger.
6. Every event and operation is scoped by `organization_id`. The existing backend membership/RBAC check remains the authorization boundary; no credit ID or balance may be queried across tenants.

## Generation transaction flow

1. Validate the organization membership, message ownership, current entitlement, and a client idempotency key **before** contacting OpenRouter.
2. In a short transaction, lock the credit account, replay an existing operation with the same key if present, otherwise require one available credit, move it to `reserved`, write the reservation operation, and commit. Do not hold the account lock during the external provider call.
3. Run the selected scenario. Count model token/cost telemetry separately from the customer credit. Never log credentials or sensitive prompt text.
4. On a valid final draft, in one transaction: lock the operation and account; persist `AIDraft`, message status, normal token usage and audit; move one reserved credit to consumed; append the consumption event; set operation `completed` with the draft ID; commit. The draft and debit must succeed or fail together.
5. On provider/validation failure, release the reservation in a short transaction with a reason. A failed release must be retried or reconciled; it must not silently leave the credit unavailable.
6. A crashed worker or lost response may leave a reservation. Reconciliation may release only a reservation whose owner is no longer active and whose final draft is absent. It must use the same account lock and idempotency checks. An operation completed after the client disconnects remains replayable from its key.

The generate endpoint now requires a UUID `operation_key`. The client preserves that key after an ambiguous failure and starts a new attempt only when the previous attempt is confirmed released. Reservations commit before provider I/O; draft persistence and consumption share the next transaction. A 240-second generation deadline is shorter than the 300-second reservation lease, and bounded scheduler maintenance recovers abandoned reservations.

## Additional reply purchases

The product owner requested optional add-on packs alongside monthly plans. The proposed catalog has 50 / 100 / 250 / 500 / 1 000 / 2 000 / 5 000 / 10 000 / 15 000 / 20 000 replies at 299 / 549 / 1 290 / 2 490 / 4 790 / 9 290 / 22 490 / 43 900 / 65 400 / 86 900 ₽. Multiple packs may be purchased to meet an exact quantity in 50-reply steps. Packs add to the same non-expiring reply balance and do not change the plan, billing period, or user and marketplace limits.

At purchase request creation, persist an immutable order with organization, actor, pack code, reply quantity, price in minor currency units, currency, status, and a unique client idempotency key. Authorize purchase creation for organization owner/admin. Resolve quantity and price from a server-owned catalog; never accept a client-supplied amount. Return a checkout URL only after the configured provider has created a real payment for that order. If the provider is unavailable, fail closed without a payable URL or credit grant.

Only a verified provider payment event may mark an order paid. Verify event authenticity and match provider payment ID, order ID, amount, currency, and terminal paid status. In one transaction, mark the order paid and issue a credit grant with a unique key derived from the order ID. Duplicate and out-of-order webhooks must never issue another grant. Cancelled, failed, or pending orders do not issue credits; refunds after consumption need an explicit compensating policy. Never grant credits from a browser redirect, an unverified webhook, or the current synthetic `active` subscription.

The repository now has the credit ledger and internal idempotent grant service, but no checkout, invoice or verified payment webhook. Payment-provider connection is deferred until the production domain exists; therefore the public page shows pack prices for calculation but no working purchase action. The provider and grant path must be implemented and verified together before enabling purchase.

## Entitlement and balance visibility

New monthly grants need a confirmed paid subscription period. Trial activation creates a durable owner claim, grant and `trialing` subscription in one transaction. The working assumption is one trial per owner account, issued to the first workspace; a later workspace starts inactive. Legacy `active` subscriptions with no provider are not paid entitlements. Do not infer payment from public prices, and do not automatically grant credits to every existing organization after a migration.

The billing overview should expose granted, consumed, reserved, and available replies, the current period's grant, and the plan/period that produced it. The UI should explain whether a generation is unavailable because no credits remain or because the account has no active entitlement. Existing credits must not disappear when a new period begins.

## Product decisions still required

- Confirm or adjust the working assumption of one trial per owner account rather than one per workspace. The owner already confirmed that unused trial replies expire after 14 days.
- The owner already confirmed that paid carryover requires an active paid tariff; cancelled, expired and `past_due` subscriptions do not enable spending.
- Whether a plan upgrade grants only the difference for the current period or a full new allowance, and how a downgrade affects already granted credits.
- Whether a safety-blocked but successfully generated and persisted draft consumes one credit. The public wording says each created AI draft does; the product owner should confirm this edge case.
- The scenario routing and model mix through OpenRouter, plus measured input/output/reasoning tokens and provider costs. Without them, the proposed monthly quantities remain provisional.

## Implementation order and release evidence

1. Settle the product decisions above and the final plan quantities after scenario-cost measurement.
2. Add the account, operation, and immutable event schema with tenant constraints, uniqueness, and a migration that does not create unearned balances.
3. Add grant issuance from real entitlement events and reservation/finalization/release logic. Wire generation only when grant issuance and idempotent retry are ready together.
4. Align public plan codes, prices, limits, trial contract, billing overview, and admin UX without adding payment-provider checkout before the production domain stage.
5. Review migration behavior, concurrent reservations, duplicate grant/retry handling, failure recovery, plan changes, tenant isolation, and balance reconciliation on the exact release tree. Run the repository gates only after the user reauthorizes tests; static inspection cannot certify these runtime properties.
