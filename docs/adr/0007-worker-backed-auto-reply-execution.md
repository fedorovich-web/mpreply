# ADR-0007 — Worker-backed auto-reply execution

**Status:** Accepted
**Version:** 0.1.7
**Date:** 2026-07-10

## Decision

MPReply executes marketplace sends outside the request/response process through Dramatiq with Redis as the broker.

The API performs admission control before enqueueing:

1. tenant/RBAC check;
2. latest or explicitly selected AI draft lookup;
3. deterministic SafetyGate re-check;
4. Automation Rules Engine evaluation;
5. runtime quota check;
6. idempotency lookup;
7. creation of a durable `replies` row in `queued` state;
8. enqueue of the worker message.

The worker performs a second quota check immediately before send, transitions the message and reply through the state machine, decrypts the marketplace credential only in backend memory, performs a Wildberries preflight lookup, sends through the marketplace adapter, and persists audit/integration/usage events.

## Why Dramatiq

- already selected in the project ADR backlog;
- Redis broker support;
- per-actor retry controls;
- exponential retry middleware;
- simple operational model for the MVP.

## Delivery semantics

The workflow is designed as **at-least-once processing with application-level idempotency**.

The idempotency key is derived from organization, marketplace account, marketplace, message type, external message id, and the initial-reply operation. A unique database index prevents two durable reply jobs for the same marketplace message.

Before a Wildberries send, MPReply requests the current question/feedback by external id. If the marketplace already has an answer, the reply is marked `sent` locally without a second outbound send.

This materially reduces duplicate-send risk. It does not claim impossible exactly-once semantics across an external API and a local database transaction.

## Retry policy

Retryable conditions:

- network timeout;
- network transport error;
- marketplace rate limit;
- marketplace 5xx/unavailable response.

Terminal conditions:

- invalid credentials;
- insufficient API scope;
- unsupported message type;
- exhausted retry budget.

Dramatiq actor policy:

- max retries: 3;
- minimum backoff: 1 second;
- maximum backoff: 60 seconds.

Application policy defaults to four total send attempts, configurable through `AUTO_REPLY_MAX_ATTEMPTS`.

## Runtime quotas

Two quota layers are evaluated:

- organization-wide rolling 24-hour auto-reply limit;
- matching automation rule rolling one-hour and 24-hour limits.

Quota failure does not silently drop the customer message. The message moves to manual review.
