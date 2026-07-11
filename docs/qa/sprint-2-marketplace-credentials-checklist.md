# Sprint 2 QA checklist — Marketplace credentials

## Backend

- [ ] `POST /api/marketplace-accounts` requires authenticated user.
- [ ] Only owner/admin can create a marketplace account.
- [ ] Raw credentials are never returned in the response.
- [ ] Response includes `credentials_masked` only.
- [ ] `GET /api/marketplace-accounts?organization_id=...` is tenant-scoped.
- [ ] User from another organization cannot read accounts.
- [ ] Manager/viewer cannot rotate credentials.
- [ ] `POST /validate` decrypts credential only inside service/adapter call.
- [ ] `POST /rotate-credentials` stores a new encrypted credential.
- [ ] `POST /revoke-credentials` disables the account.
- [ ] Audit events are written for create/validate/rotate/revoke.
- [ ] Integration events are written for validation success/failure.

## Security

- [ ] `.env` is not committed.
- [ ] `CREDENTIALS_ENCRYPTION_KEY` is not exposed to frontend.
- [ ] Raw WB token fixture is not found in app logs.
- [ ] Raw WB token fixture is not found in API responses.
- [ ] Secret scrubbing keeps credentials out of Sentry/log output.

## Frontend

- [ ] `/app/integrations` lists marketplace cards.
- [ ] Wildberries is marked as MVP/available.
- [ ] Ozon/Yandex/Avito are not represented as production-ready send adapters.
- [ ] `/app/integrations/wildberries` explains encrypted credential storage.
- [ ] No hardcoded colors/spacing outside CSS variables.

## Out of scope for Sprint 2

- WB sync jobs.
- Importing reviews/questions.
- Sending replies.
- OpenRouter AI generation.
