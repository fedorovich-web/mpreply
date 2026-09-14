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

## Yandex Market Partner API

- Inspected: 2026-09-14.
- Sources: [token information](https://yandex.ru/dev/market/partner-api/doc/en/reference/auth/getAuthTokenInfo), [API-key access groups](https://yandex.ru/dev/market/partner-api/doc/en/concepts/access), [product reviews](https://yandex.ru/dev/market/partner-api/doc/en/step-by-step/goods-feedback), and [product questions](https://yandex.ru/dev/market/partner-api/doc/en/step-by-step/goods-questions).
- Scope: `Api-Key` authorization, `communication` and `all-methods` write scopes, `/v2/auth/token`, business-scoped goods-feedback and goods-questions reads, comment/answer reconciliation, `pageToken`, limits, and write receipt shapes.
- Contract corrections from the historical implementation: review creation returns the comment object under `result` with its `id` and moderation `status`; question creation returns `result.entity` and must identify an `ANSWER`. Invalid timestamps are rejected instead of being replaced with the local clock, and missing products are rejected instead of receiving synthetic names or IDs.
- Evidence boundary: official-documentation review with synthetic transports only; no seller-account request was made. Yandex Market remains runtime-unverified until a separately authorized live probe succeeds.
