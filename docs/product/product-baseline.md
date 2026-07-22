# Product baseline

## Positioning

MPReply automatically answers marketplace reviews and questions through connected marketplace APIs. The default mode is automatic replies with safety checks. Users may switch to semi-automatic mode where AI prepares a draft and a manager confirms sending.

## Default flow

```text
Connect marketplace API key
→ Validate credentials
→ Sync reviews/questions
→ Match automation rules
→ Generate AI reply
→ SafetyGate
→ Send through marketplace adapter
→ Audit + usage logging
```

## Safety fallback

If an answer is risky, unsupported, low-confidence or missing product context, MPReply does not send it automatically and moves the message to manual review.
