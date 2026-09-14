# Marketplace contract evidence

This log records documentation checks for provider-facing contracts. It does not certify live seller-account access or production sending.

## Wildberries

- Inspected: 2026-09-13.
- Sources: [API information](https://dev.wildberries.ru/en/openapi/api-information), [API release notice](https://dev.wildberries.ru/news/278), and [official knowledge-base article](https://dev.wildberries.ru/knowledge-base/articles/019d49a4-0b26-7620-8d0b-e3050b7cd01d).
- Scope: token categories, feedback/question operations, request boundaries, and provider error behavior.
- Evidence boundary: documentation-only review with synthetic transports; no seller-account request was made.

## Ozon Seller API

- Inspected: 2026-09-14.
- Source: [official Seller API documentation](https://docs.ozon.ru/api/seller/).
- Scope: `/v1/roles`, `/v2/review/list`, `/v1/review/comment/list`, `/v1/review/comment/create`, `/v1/question/list`, `/v1/question/answer/list`, and `/v1/question/answer/create`; role `methods` and `expires_at`; documented string review SKU and numeric question SKU.
- Retrieval note: the official documentation entry point returned its anti-bot challenge to automated and direct browser retrieval. No bypass was attempted. The implementation therefore preserves the endpoint-level contract last verified against the official reference on 2026-08-12 and fails closed on unrecognized response shapes.
- Evidence boundary: documentation and repository contract-history review with synthetic transports; no seller-account request was made. Ozon remains contract-complete only after its static and test gates, and runtime-unverified until a separately authorized live probe succeeds.
