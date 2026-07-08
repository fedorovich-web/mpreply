# Sprint 3 QA checklist — Wildberries sync and Inbox API

## Backend

- [ ] `POST /api/marketplace-accounts/{id}/sync` requires authentication.
- [ ] Only owner/admin/manager can run sync.
- [ ] Viewer cannot run sync.
- [ ] WB credentials are decrypted only inside sync service.
- [ ] Sync creates a `sync_jobs` row.
- [ ] Successful feedback sync writes `integration_events`.
- [ ] Successful question sync writes `integration_events`.
- [ ] 401 maps to `invalid_credentials`.
- [ ] 403 maps to `insufficient_scope`.
- [ ] 429 maps to `rate_limited`.
- [ ] Duplicate marketplace messages are updated, not duplicated.
- [ ] Imported messages are visible via `GET /api/messages`.
- [ ] `GET /api/messages/{id}` enforces tenant membership.

## Frontend

- [ ] `/app/inbox` renders.
- [ ] Inbox page uses CSS variables only.
- [ ] Message status labels are understandable.
- [ ] Placeholder copy does not claim AI/auto-send is implemented yet.

## Security

- [ ] No API key appears in API response.
- [ ] No API key appears in logs.
- [ ] Audit log records `credentials.used_for_sync` without secret values.
