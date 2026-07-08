# Respio Sprint 3 patch — Wildberries sync + Inbox API

Apply this archive over the current project after Sprint 2 is merged into `develop`.

## Includes

- Wildberries adapter extraction and normalization for feedbacks/questions.
- Manual sync endpoint: `POST /api/marketplace-accounts/{id}/sync`.
- Product/message upsert with deduplication.
- Sync jobs and integration events updates.
- Inbox API: `GET /api/messages`, `GET /api/messages/{id}`, `PATCH /api/messages/{id}`.
- `/app/inbox` UI preview.
- ADR and QA checklist for Sprint 3.

## Suggested Git flow

```powershell
git checkout develop
git pull
git checkout -b sprint-3-wildberries-sync
# unpack patch into project root
git status
git add .
git commit -m "add wildberries sync and inbox api foundation"
git push -u origin sprint-3-wildberries-sync
```
