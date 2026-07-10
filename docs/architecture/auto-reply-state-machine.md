# Auto-reply execution state machine

## Customer message path

```text
ai_draft_ready
    |
    +--> needs_manual_check      SafetyGate / rule / quota fallback
    |
    +--> safety_blocked          deterministic block
    |
    +--> waiting_review          semi-auto mode
    |
    +--> auto_reply_pending
              |
              +--> sending
                      |
                      +--> auto_reply_sent
                      +--> auto_reply_pending          retryable failure
                      +--> failed                      terminal failure
                      +--> blocked_by_marketplace      credentials/scope failure
```

## Reply path

```text
draft -> queued -> sending -> sent
                    |
                    +--> retry_pending -> sending
                    +--> failed
                    +--> blocked

queued -> manual_review_required
```

## Invariants

- `sent` is terminal for replies.
- `auto_reply_sent` is terminal for the automatic-send path.
- A unique idempotency key suppresses duplicate durable reply jobs.
- Runtime quota is checked both before enqueue and immediately before send.
- Decrypted marketplace credentials are never persisted or returned to the frontend.
