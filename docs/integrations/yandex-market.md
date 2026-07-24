# Yandex Market integration

## Official contract used

The adapter is based on the official `yandex-market/yandex-market-partner-api` OpenAPI repository.

- API base URL: `https://api.partner.market.yandex.ru`
- authentication: `Api-Key` header
- token inspection: `POST /v2/auth/token`
- required write scope: `COMMUNICATION` or `ALL_METHODS`
- list product feedback: `POST /v2/businesses/{businessId}/goods-feedback`
- list feedback comments: `POST /v2/businesses/{businessId}/goods-feedback/comments`
- create/update feedback comment: `POST /v2/businesses/{businessId}/goods-feedback/comments/update`
- list product questions: `POST /v1/businesses/{businessId}/goods-questions`
- list question answers: `POST /v1/businesses/{businessId}/goods-questions/answers`
- create/update/delete answer or comment: `POST /v1/businesses/{businessId}/goods-questions/update`
- pagination: `pageToken`, maximum page size 50 for the relevant list operations
- throttling response documented by the API: HTTP 420; HTTP 429 is also handled defensively

## Credentials

The existing encrypted marketplace credential lifecycle stores the Api-Key server-side. The account `seller_id` field carries the Yandex Market Business ID and must be a positive integer.

The frontend never receives the raw Api-Key after submission. It receives only the existing masked fingerprint representation.

## Runtime boundaries

The adapter uses a fixed allowlisted API host, bounded timeout and disabled redirects. Provider payloads are normalized before persistence. Raw provider errors are not returned directly to the user.

## External verification still required

Before release, validate with a real test seller account:

- token scope response;
- Business ID access;
- feedback and question pagination;
- create comment on a review;
- create answer on a question;
- provider moderation or publication delay;
- duplicate-send reconciliation after ambiguous timeout;
- actual resource-limit response headers.
