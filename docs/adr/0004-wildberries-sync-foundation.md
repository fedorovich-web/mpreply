# ADR-0004: Wildberries sync foundation

## Status
Accepted.

## Context
Sprint 3 must turn marketplace credentials into actual data ingestion. Wildberries remains the first production adapter because it is the best verified MVP target from Phase 0 analysis.

## Decision
Implement a synchronous backend sync path first:

- `POST /api/marketplace-accounts/{id}/sync` runs WB feedback/question ingestion.
- The API creates a `sync_jobs` row.
- The adapter fetches unanswered feedbacks and questions.
- Raw marketplace payloads are normalized before storage.
- Products are upserted before customer messages.
- Customer messages are deduplicated by existing unique key.
- Sync/send credentials are decrypted only in backend memory.
- Sync actions are written to `audit_logs` and `integration_events`.

## Consequences
This is enough for local MVP testing and first WB smoke tests. A background worker queue will replace the synchronous path when the auto-reply pipeline is introduced.

## Non-goals
- No auto-reply send yet.
- No AI generation yet.
- No Ozon/Yandex/Avito production adapters yet.
