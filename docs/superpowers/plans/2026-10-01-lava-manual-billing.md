# Lava.top Manual Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Proposed execution: native in this session, with one final independent review; no task-by-task delegation.

**Goal:** Owners/admins buy a tariff period or reply packs through Lava.top; verified payments activate access and grant credits exactly once, without automatic charges.

**Architecture:** Durable local orders precede HTTP requests. Authenticated webhook events enter a durable inbox, then invoice verification precedes one atomic order/period/credit transaction. A scheduler processes retries and prepaid monthly grants using the existing credit ledger.

**Tech Stack:** Existing FastAPI, SQLAlchemy, PostgreSQL, Alembic, httpx, pytest; Next.js, Zod, TanStack Query, Vitest, Playwright. No payment SDK.

**Spec:** `docs/superpowers/specs/2026-10-01-lava-yandex-integration-design.md`, approved 01.10.2026. This plan implements its Lava section. The Yandex section has a separate plan.

## Global Constraints

- Base: feat/auth-email-resend at 417add5257b9f5d896ba6d4aca88b39a0d743a19; preserve `.handoff/` and `apps/cms/`.
- ONE_TIME only; RUB; server prices: Start 129000 / Team 349000 / Business 699000 minor units, allowances 300 / 800 / 1600; annual total is monthly price × 12 × 80%.
- Packs from approved PRODUCT.md and existing pricing calculator; trial stays 350 replies / 14 days. No public price or design changes.
- Renewal follows the paid-through date, including queued periods. A different tariff starts at its purchased future boundary; no proration. Annual credits are monthly; paid credits never expire.
- Only owner/admin can purchase; demo cannot mutate. Reads and status polling remain tenant-scoped.
- Provider credentials stay SecretStr/backend-only. No raw secrets, provider tokens, buyer details, or payment URL query strings in logs.
- No local Docker, actual charges, marketplace sends, commits/push/deploy/main merge as part of local implementation. Commit/push/deploy require the prepared diff and checks for approval.

## Review Focus

1. A webhook arrives before the invoice POST response: one order binds to one invoice; late POST cannot overwrite paid state (Task 2/3).
2. January 31 or leap-day payment: period boundaries use the original calendar anchor rather than accumulating short-month drift (Task 4).
3. Annual payment plus queued different tariff: current limits/plan remain current until the exact boundary; scheduler outage does not delay verified entitlement (Task 4).
4. Successful invoice creation followed by timeout: repeat clicks never create another invoice automatically; authenticated correlation can recover it (Task 2/3).
5. User changes organization during checkout polling: old queries cannot display another organization's order or enable actions using a stale role (Task 5).

## Task 1: Price contracts and durable orders

**Files:** Create `apps/api/app/models/billing_order.py`, `apps/api/app/models/billing_period.py`, `apps/api/app/models/billing_webhook.py`, `apps/api/app/services/billing_catalog.py`, `apps/api/app/tests/test_billing_catalog.py`, `apps/api/app/tests/test_billing_orders_postgres.py`; modify `apps/api/app/models/__init__.py`, `apps/api/app/schemas/billing.py`; create `apps/api/alembic/versions/20261001_0019_lava_billing.py` after 0018.

**Interfaces:** `quote_purchase(*, kind: str, plan_code: str | None, months: int | None, packs: list[tuple[int, int]]) -> PurchaseQuote`; immutable dataclass PurchaseQuote contains `amount_minor: int`, `currency: str`, `monthly_credits: int`, `addon_credits: int`, `snapshot: dict[str, object]`. Server catalog response supplies purchasable plans/packs and actor capability.

- [ ] Write assertions: monthly Start = 129000/300, annual Start = 1238400/12 monthly grants; pack 50 = 29900, pack 100 = 54900; arbitrary price, negative count, unsupported quantity, inactive/custom plan, and fractional money are rejected.
- [ ] Run `apps/api/.venv/Scripts/python.exe -m pytest app/tests/test_billing_catalog.py -q` from apps/api (use `.venv/Scripts/python.exe` there); confirm failure because catalog is absent.
- [ ] Implement the server quote and schemas. Persist order actor/org, request hash, immutable snapshot, server correlation, provider invoice ID/payment URL, state, timestamps, verification error. Unique `(organization_id, idempotency_key)`, provider invoice ID, correlation. Order state: creating/pending/review_required/paid/failed; paid is terminal.
- [ ] Add paid periods with order/org/plan identity, calendar anchor, UTC start/end, monthly allowance and next grant index; unique order, positive amount, valid interval. Add durable webhook inbox keyed by digest of bounded canonical event, receipt/lease/retry state; no credentials in payload. Add due indexes.
- [ ] Run unit checks and isolated PostgreSQL migration upgrade/downgrade-to-0018/upgrade; test duplicate key/invoice and same-org period/order FK constraints. Downgrade never runs on a production or user database.

## Task 2: Lava HTTP client and purchase API

**Files:** Create `apps/api/app/providers/lava.py`, `apps/api/app/services/billing_order_service.py`, `apps/api/app/tests/test_lava_client.py`, `apps/api/app/tests/test_billing_order_routes.py`; modify `apps/api/app/api/billing.py`, `apps/api/app/core/config.py`, `apps/api/app/schemas/billing.py`, `infra/docker/docker-compose.production.yml` for backend env passthrough only.

**Interfaces:** `LavaClient.create_invoice(*, email: str, offer_id: UUID, amount_minor: int, correlation: str, return_urls: dict[str, str]) -> CreatedInvoice`; `get_invoice(invoice_id: UUID) -> VerifiedInvoice`. Dataclasses expose ID, normalized minor-unit amount/currency/status/correlation; CreatedInvoice also HTTPS payment URL. `BillingOrderService.create(*, actor: User, organization_id: UUID, idempotency_key: UUID, purchase: PurchaseRequest) -> BillingOrder`.

- [ ] Write HTTP mock assertions for POST `/api/v3/invoice`, `periodicity=ONE_TIME`, server offer, RUB, Decimal conversion, clientUtm.utm_content, HTTPS return URLs; GET `/api/v1/invoices/{id}` parses receipt.amount in major units without float rounding. Malformed/negative/unpaid/mismatched invoice is rejected; no automatic POST retries.
- [ ] Write route tests: missing/disabled config, demo/viewer/other tenant, same-key replay, same-key changed body (409), provider timeout and late response. No HTTP is called for forbidden purchase or replay.
- [ ] Run those files, confirm failures; implement flags and complete enabled-config validation. LAVA_API_KEY and LAVA_WEBHOOK_SECRET are distinct. Config variables: LAVA_ENABLED, LAVA_API_KEY, LAVA_OFFER_ID, LAVA_PRODUCT_ID, LAVA_WEBHOOK_SECRET.
- [ ] Add GET `/api/billing/catalog`, POST `/api/billing/orders`, GET `/api/billing/orders` (bounded pagination), GET `/api/billing/orders/{order_id}`. Commit local creating order before I/O; guarded completion preserves a concurrently paid state. Unknown POST result becomes review_required; never fabricate a payment URL or create a new invoice on replay.
- [ ] Run `.venv/Scripts/python.exe -m pytest app/tests/test_lava_client.py app/tests/test_billing_order_routes.py -q`; concurrency checks also prove one POST for concurrent identical requests.

## Task 3: Webhook inbox and verified exactly-once settlement

**Files:** Create `apps/api/app/services/lava_webhook_service.py`, `apps/api/app/tests/test_lava_webhook.py`; extend `test_billing_orders_postgres.py`, `app/api/billing.py`, `billing_order_service.py`.

**Interfaces:** `LavaWebhookService.receive(*, api_key: str | None, payload: bytes) -> None` persists and acknowledges a bounded authenticated event; `process_due(*, now: datetime, limit: int) -> int` leases inbox rows and verifies provider state outside database row locks. `BillingOrderService.settle(*, order_id: UUID, invoice: VerifiedInvoice, event_product_id: UUID, now: datetime) -> BillingOrder` atomically updates the locked order and credits/period.

- [ ] Test wrong/missing header gives 401 and no inbox entry; malformed payload gives 400; duplicate success, failed→success, success→failed, recurring/unknown event, amount/currency/product/ID/correlation mismatch. Assert each mismatch grants zero, paid never regresses, known success grants once.
- [ ] Test POST-timeout recovery requires authenticated webhook product ID AND verified random UTM correlation AND exact amount/currency; buyer email/product names cannot choose an organization. GET response lacks product/offer IDs: never invent those fields.
- [ ] Run tests expecting failure; implement POST `/api/billing/lava/webhook`, constant-time X-Api-Key comparison, small body limit, durable receipt before 2xx. Do not use cookie auth/CSRF on this external route. Lease expires after 60 seconds; transient verification retries at 1/5/15/60 seconds then bounded hourly intervals, ambiguous events remain review_required.
- [ ] Verify completed GET invoice against local order and authenticated product ID; lock org/order with consistent lock ordering, enforce unique invoice binding, and settle in one transaction. Retain authenticated unsupported refund/chargeback for manual review without financial mutation or guessing an original order.
- [ ] Run unit + PostgreSQL tests with 20 duplicate concurrent success events, webhook-before-POST response and rollback injection. Assert one paid period/grant and ledger conservation.

## Task 4: Paid access, renewal queue and monthly prepaid grants

**Files:** Create `apps/api/app/services/billing_period_service.py`, `apps/api/app/workers/billing_maintenance.py`, `apps/api/app/tests/test_billing_periods.py`; extend PostgreSQL tests; modify `reply_credit_service.py`, `plan_limit_service.py`, `billing_service.py`, `app/workers/marketplace_scheduler.py`.

**Interfaces:** `BillingPeriodService.materialize_current(*, organization_id: UUID, now: datetime) -> BillingPeriod | None`; `grant_due(*, now: datetime, limit: int) -> int`. Both use persisted payment proof and existing `ReplyCreditService.grant(organization_id=..., source_key=..., kind=..., quantity=..., expires_at=None)` within the caller's transaction.

- [ ] Test immediate paid start replacing trial access, renewal queue preserving current end, multiple prepaid renewals, next-period different plan, exact expiry, leap year, short months with original anchor, yearly 12 grants, restart/catch-up and simultaneous schedulers. No payment API call occurs during maintenance.
- [ ] Run tests expecting failure; implement calendar interval boundaries from anchor + month index. Store each paid period separately; use current paid period for entitlement and active plan without waiting for scheduler, update the existing Subscription projection consistently. Legacy provider subscription proof stays separate; never set provider_subscription_id to an invoice ID.
- [ ] Grant each due period/month via key `lava:order:{order_id}:month:{index}` and addon via `lava:order:{order_id}:addon`. Serialized org ledger plus existing source uniqueness prevents duplicate grants. Reply spending checks an actual active paid interval; retain trial and legacy provider tests.
- [ ] Run period/unit/concurrency suites and existing credit maintenance/AI generation tests. Assert credits cannot spend after expiry, retain paid balance, and become spendable again after renewed payment.

## Task 5: Existing billing UI and local validation

**Files:** Create `apps/web/components/billing/BillingCheckout.tsx`, `apps/web/components/billing/BillingOrders.tsx`, `apps/web/tests/unit/billing-checkout.test.tsx`, `apps/web/tests/unit/billing-orders.test.tsx`; modify `BillingWorkspace.tsx`, `apps/web/lib/api/schemas.ts`, existing billing styles only as needed, `billing-domain-defer-contract.test.ts`, PRODUCT.md launch-stage paragraph only. Add `scripts/check-local-billing.py` for an isolated native PostgreSQL test DB and `docs/ops/lava-yandex-setup.md` for configuration.

**Interfaces:** Catalog/orders/status use Task 2 routes, typed Zod schemas, current workspace organization and server capability. Checkout holds one idempotency key per unchanged cart, retains it after an ambiguous result; polling key includes org/order and stops on terminal state or unmount.

- [ ] Tests assert disabled state has no purchase action; owner/admin buy, demo/viewer cannot; double click/timeout retains key; organization switch drops old result; browser return status alone cannot show paid; pending/review-required offer refresh/support without a new automatic invoice. Preserve monthly price fallback `—`.
- [ ] Run targeted Vitest tests expecting failure; implement plan/month/year selection and packs, server quote, HTTPS payment navigation, bounded polling/history. Reuse existing tokens/layout and RU/EN patterns. Do not redesign public pages or invent prices/trials. Replace the old launch-deferral static assertion with meaningful current-stage capability/RBAC/fallback regression coverage.
- [ ] Build local PostgreSQL harness using existing native binaries and synthetic local credentials, guarded host/database prefix, with no Docker or remote connection. Run migrations and all payment/credit PostgreSQL tests; skips are reported as unverified, never as pass.
- [ ] Run backend pytest/ruff/pyright/security and applicable integrity/container static gates; apps/web: unit, design tokens, typecheck, lint, CSS syntax, build, W3C, E2E, a11y, visual, Lighthouse. Review relevant browser pages; never update visual snapshots just to pass.
- [ ] Prepare reviewable diff/results and provider setup. Real charge and production enablement remain a separate explicitly approved step after local checks. No implementation-stage commits until approval of the concrete change.
