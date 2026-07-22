# MPReply 0.1.99 — Seller settings and audit read foundation

Дата: 2026-07-22

## Scope

Backend-only batch. Публичные страницы, CSS, Hero Canvas, pricing layout и visual snapshots не изменяются.

## Реализовано

- one-to-one `seller_settings` для каждой организации;
- сохраняемые tone, brand rules, knowledge base, reply signature и prohibited phrases;
- owner/admin write boundary, member read boundary;
- применение сохранённых правил при генерации AI draft;
- deterministic manual-review gate при попадании запрещённой продавцом фразы в draft;
- tenant-scoped audit-log read API для owner/admin;
- keyset cursor и фильтры по action/entity/actor/time range;
- append-only PostgreSQL triggers для `audit_logs`;
- миграционный backfill default seller settings;
- версия web/API/deployment/integrity синхронизирована до `0.1.99`.

## API

- `GET /api/organizations/{organization_id}/seller-settings`
- `PATCH /api/organizations/{organization_id}/seller-settings`
- `GET /api/audit-logs?organization_id=...`

## Security / privacy

- содержимое brand rules и knowledge base не записывается в audit metadata;
- audit API не доступен manager/viewer;
- cursor не содержит server-side state и валидируется;
- audit table защищена от UPDATE, DELETE и TRUNCATE на уровне PostgreSQL.

## Tests

Patch-specific unit contract:

```text
20 passed
```

Полный backend/web gate должен быть повторён в локальном репозитории после ручного копирования patch payload.
