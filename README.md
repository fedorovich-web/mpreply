# Respio Sprint 2 patch — Marketplace credentials

This patch must be applied on top of Sprint 1.

## Includes

- Marketplace accounts API:
  - `POST /api/marketplace-accounts`
  - `GET /api/marketplace-accounts?organization_id=...`
  - `GET /api/marketplace-accounts/{id}`
  - `PATCH /api/marketplace-accounts/{id}`
  - `POST /api/marketplace-accounts/{id}/validate`
  - `POST /api/marketplace-accounts/{id}/rotate-credentials`
  - `POST /api/marketplace-accounts/{id}/revoke-credentials`
  - `POST /api/marketplace-accounts/{id}/sync` placeholder for Sprint 3
- Backend-only encrypted marketplace credentials lifecycle.
- Owner/admin-only credential management.
- Masked credentials in API responses.
- Validation through Wildberries adapter.
- Audit and integration events for credential operations.
- Alembic migration `20260708_0003_marketplace_account_management.py`.
- Frontend integration screens:
  - `/app/integrations`
  - `/app/integrations/wildberries`
- QA and security docs.

## Apply

```powershell
cd C:\Projects\respio
git checkout develop
git checkout -b sprint-2-marketplace-credentials
Expand-Archive C:\Users\<USER>\Downloads\respio-sprint2-marketplace-credentials-patch.zip -DestinationPath . -Force
git status
git add .
git commit -m "add marketplace credentials management"
```

## Notes

- Sync job execution remains out of scope until Sprint 3.
- Ozon/Yandex/Avito remain non-production adapters until endpoint-level verification is complete.
- Do not commit real `.env` files or marketplace API keys.
