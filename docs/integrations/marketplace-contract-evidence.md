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

## Avito API

- Inspected: 2026-09-24.
- Sources: user-supplied OpenAPI exports for authorization (`swagger.json`, SHA-256 `BFD91C70C45D1B3A741637DB7F7F3A847828A2F0F04B59B850A3B1CDBC0B36AC`), listings (`swagger (1).json`, `4D1E729C6BA89A4DC253DACC6591742BF702EBADE8EE03BCB95ABF23D9BD3018`), Messenger (`swagger (2).json`, `EAD5E70CB19E658AD42887A678648A3A6EC8DA0F7A1B76F4EC0CDE0D198352AC`), and ratings/reviews (`swagger (3).json`, `A623A2B6D3C920151ECCC995C514CA669F30B835CA9D85B3D526C436E9C4FB63`). The exports' provenance and freshness were not independently verified. Catalog references: [authorization](https://developers.avito.ru/api-catalog/auth/documentation), [Messenger](https://developers.avito.ru/api-catalog/messenger/documentation).
- Implemented chat scope: client-credentials token exchange at fixed `https://api.avito.ru/token`, Messenger chat/message/read/send paths, numeric account IDs, opaque chat IDs, bounded limit/offset pagination, and text-only outbound messages up to 1000 characters.
- Customer-chat ingestion requests `u2i` and `u2u`; `a2u` means Avito-to-user and is excluded. Chat `users[*].id` is hashed, so it cannot be compared with the raw account ID to identify the buyer. Inbound `direction` identifies customer messages; the display name is used only when `author_id` matches a chat participant. A successful chat-list read does not independently prove permission to send; write capability still needs runtime verification with an authorized account.
- Implemented ratings scope: `GET /ratings/v1/reviews` uses bounded 50-record offset pages against the provider's `total`; only reviews with `canAnswer=true` and no answer enter the actionable inbox. Nullable items and empty review text remain unchanged, without synthetic product or content. Previously imported, untouched reviews can be reconciled when Avito later reports a published, moderated, rejected, or unanswerable state.
- `POST /ratings/v1/answers` sends one bounded text answer after a fresh review lookup. A valid `id`/`createdAt` receipt records API acceptance as publication-unverified; only a later provider `published` state confirms publication. Ambiguous writes are not retried blindly, and provider bodies/credentials are excluded from safe errors and audit metadata.
- Credential validation checks Messenger and ratings reads independently using one client-credentials token. An account may expose only the stream actually read; the optional Messenger account ID is not required for ratings-only access. Write access is marked `not_probed`, because a read probe and the supplied OpenAPI do not prove that an account can publish an answer.
- Export inconsistencies: the Messenger send request schema marks an undefined `url` field as required, and its 200-response example conflicts with the schema's outbound `direction`. The adapter uses the documented `message.text`/`type` request properties and requires an outbound receipt; these contradictions prevent claiming provider-confirmed sending from the export alone.
- Evidence boundary: user-supplied exports and synthetic transports only; no live Avito token, Messenger, ratings, or answer request was made. The exports' freshness and the seller account's write entitlement are unverified. Avito remains contract-implemented but runtime-unverified until a separately authorized live probe succeeds; no production sending claim follows from this evidence.
