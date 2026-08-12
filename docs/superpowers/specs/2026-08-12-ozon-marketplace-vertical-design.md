# Ozon marketplace vertical design

## Status and source

Approved implementation scope comes from the 2026-08-12 autonomous backend assignment. Provider contracts below were verified on 2026-08-12 against the current official [Ozon Seller API documentation](https://docs.ozon.ru/api/seller/), version 2.1 as rendered by the documentation site. No seller credentials or provider requests were used during research.

## Product boundary

The first production Ozon slice supports product reviews and product questions through the existing marketplace-neutral account, sync, message, reply, scheduler, audit, and entitlement layers. It does not claim Ozon chat support or OAuth support.

Ozon access is subscription-gated by the provider:

- review methods require `Управление отзывами` or `Premium Pro`;
- question and answer methods require `Premium Plus`.

An account may therefore support only one of the two streams. Validation and scheduling must preserve that per-account distinction instead of repeatedly running an unavailable stream.

## Credentials and validation

Use the existing account schema without a migration:

- `MarketplaceAccount.seller_id` stores the Ozon `Client-Id`;
- the encrypted credential stores the Ozon `Api-Key`;
- neither value is logged or returned raw;
- account creation requires a non-empty `Client-Id` for Ozon.

Validate with `POST /v1/roles`. The response contains `expires_at` and role objects with allowed `methods`. Normalize only methods needed by MPReply into account scopes and retain the key expiry as non-secret validation metadata. A valid key with neither review nor question methods is not enough to enable an MPReply Ozon account.

Official OAuth bearer authentication is outside this slice because the current account request contract accepts one encrypted credential plus a seller identifier. Adding OAuth refresh-token lifecycle would be a separate credential design, not an implicit fallback.

## Current provider contracts

All calls use `https://api-seller.ozon.ru`, JSON, and headers `Client-Id` and `Api-Key`.

Reviews:

- list: `POST /v2/review/list`; request has optional `filters`, `last_id`, required `limit` from 20 to 100, and `sort_dir`; response has `reviews`, `has_next`, `last_id`;
- detail: `POST /v2/review/info` with `review_id`;
- create seller comment: `POST /v1/review/comment/create` with `review_id`, `text`, optional `parent_comment_id`, and `mark_review_as_processed`; response has `comment_id`;
- seller-comment preflight: `POST /v1/review/comment/list` with `review_id`, `limit`, `offset`, and `sort_dir`; comments expose `is_owner`, `is_published`, and `is_rejected`.

Questions:

- list: `POST /v1/question/list`; request has `filter`, `last_id`, `limit <= 100`, and `sort_dir`; response has `questions`, `has_next`, `last_id`;
- create answer: `POST /v1/question/answer/create` with `question_id`, numeric `sku`, and `text` between 2 and 3000 characters; response has `answer_id`;
- answer preflight: `POST /v1/question/answer/list` with `question_id`, numeric `sku`, and `last_id`; response has `answers` and `last_id`.

The provider-wide documented ceiling is 50 requests per second per Client ID. HTTP 429 and the documented per-second rate-limit error normalize to `rate_limited`; retry timing uses `Retry-After` when present and otherwise the bounded MPReply retry policy.

## Sync and normalization

Use the existing two scheduler streams and cursor-cycle/page-count protection.

- review fetch uses `limit=100`, ascending order, and the provider `last_id` only while `has_next=true`; normalize only reviews that the response identifies as unprocessed;
- question fetch uses `limit=100`, ascending order, and `last_id` only while `has_next=true`; request the documented `ALL` filter and normalize only records whose returned state shows no existing answer (`answers_count == 0` and not processed);
- persist provider IDs as `CustomerMessage.external_id`;
- persist Ozon SKU in message/product metadata as a validated decimal value because question send and preflight require it;
- malformed required IDs, dates, or SKU values are skipped or fail the page safely; they are never synthesized.

No new database entity is needed for review/question sync.

## Outbound safety

Before every Ozon review comment or question answer, execute a read-only provider preflight:

- review is already answered only when a returned comment is seller-owned and published;
- question is already answered when the answer-list contract returns an existing answer for the exact question and SKU;
- provider error, malformed payload, pagination cycle, or inability to prove the state blocks the write.

The generic adapter send/preflight contract must accept typed provider context so Ozon can receive the persisted SKU without encoding it into an external ID.

Successful review comments set `mark_review_as_processed=true`. Successful provider reply IDs are stored in the existing reply row.

Transport timeout/network failure after an outbound request is ambiguous. It must not trigger a blind resend. Persist an ambiguity/manual-review marker through the existing reply metadata and audit/event paths. Deterministic rejections remain terminal or retryable according to the normalized error model.

## Verification

Implementation is test-driven and split into small commits:

1. account validation, exact headers, roles/method scopes, safe error mapping;
2. review/question list pagination, extraction, normalization, and scheduled/manual sync dispatch;
3. exact preflight, context-aware sends, ambiguity handling, audit/idempotency regressions;
4. focused tests, strict Pyright, Ruff, full backend gate, Alembic head, and production container builds.

No live Ozon account validation or provider write is part of automated verification.
