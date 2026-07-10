# Sprint 7 QA checklist

## Admission control

- [ ] Auto mode is the default path when no override requires semi-auto.
- [ ] SafetyGate `block` prevents queue creation.
- [ ] SafetyGate `manual_review` prevents queue creation.
- [ ] Semi-auto mode does not enqueue an automatic send.
- [ ] Missing draft returns a safe 404.
- [ ] Duplicate enqueue for the same marketplace message is suppressed.
- [ ] Organization and rule quotas route the message to manual review.

## Worker execution

- [ ] Worker can start with Redis broker.
- [ ] `queued -> sending -> sent` works.
- [ ] Retryable network/rate-limit/5xx failures become `retry_pending`.
- [ ] Invalid credentials/scope become `blocked` and `blocked_by_marketplace`.
- [ ] Retry exhaustion becomes terminal `failed`.
- [ ] Attempt counters are persisted.
- [ ] Worker message id is persisted.

## Wildberries

- [ ] Preflight GET by external question id is performed.
- [ ] Preflight GET by external feedback id is performed.
- [ ] Existing marketplace answer suppresses duplicate POST/PATCH.
- [ ] Review reply uses `POST /api/v1/feedbacks/answer`.
- [ ] Question reply uses `PATCH /api/v1/questions`.

## Security and observability

- [ ] Marketplace credentials remain encrypted at rest.
- [ ] Decrypted credentials exist only in backend process memory during adapter calls.
- [ ] No credential is written to audit, integration or usage events.
- [ ] Successful sends create usage events.
- [ ] Send outcomes create integration events.
- [ ] Queue, retry, success, failure and quota decisions create audit records.

## Tooling

- [ ] `ruff check app`
- [ ] `pyright app`
- [ ] `pytest -q`
- [ ] `python -m compileall app alembic`
- [ ] `alembic heads`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
