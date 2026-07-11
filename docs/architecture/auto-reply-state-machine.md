# Reply execution state machine

## Automatic customer-message path

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

## Semi-automatic customer-message path

```text
needs_reply / ai_draft_ready / needs_manual_check / safety_blocked
    |
    +--> waiting_review
              |
              +--> approved
              |      |
              |      +--> sending
              |               |
              |               +--> answered
              |               +--> approved            retryable failure
              |               +--> failed              terminal failure
              |               +--> blocked_by_marketplace
              |
              +--> needs_manual_check                  rejected for editing
```

## Reply path

```text
auto:
queued -> sending -> sent
            |
            +--> retry_pending -> sending
            +--> failed
            +--> blocked

semi-auto:
draft -> waiting_review -> approved -> queued -> sending -> sent
  ^             |
  |             +--> draft                         rejected for editing
  |
  +---- manual_review_required                     SafetyGate block
```

## Invariants

- Auto mode remains the default response mode.
- `sent` is terminal for replies.
- `auto_reply_sent` is terminal for the automatic-send message path.
- `answered` is terminal for the semi-automatic/manual-send message path.
- A unique idempotency key suppresses duplicate durable reply jobs.
- Runtime auto-reply quota is applied only to automatic sends; approved human-reviewed replies are not blocked by the auto quota.
- Edited manual replies use optimistic revision checks to reject stale updates.
- SafetyGate is re-run after editing and before review/approval/send boundaries.
- Decrypted marketplace credentials are never persisted or returned to the frontend.
