# Avito Messenger vertical design

## Status and source

This design was approved on 2026-08-12 for the first MPReply Avito conversation slice. Provider facts come only from the attached official OpenAPI 3.0.0 document titled `Мессенджер`, version `1`, with server `https://api.avito.ru/`. No Avito credential, runtime request, webhook registration, read mutation, or message send was used during research.

The source documents both OAuth 2 authorization-code access with `messenger:read` and `messenger:write` scopes and OAuth 2 client-credentials access. It names `https://api.avito.ru/token` as the token URL but does not define token request/refresh schemas. MPReply therefore accepts a pre-obtained Bearer access token in this slice and does not claim OAuth token lifecycle support.

## Product boundary

The first Avito slice supports text conversations through the existing marketplace account, customer-message, reply, scheduler, audit, entitlement, and durable dispatch layers. It provides:

- read-only account validation;
- polling of unread `u2i`, `u2u`, and `a2u` chats;
- bounded retrieval and normalization of chat messages;
- one actionable inbound text turn per chat;
- conservative read-state updates after durable ingestion;
- exact text-message sends with fail-closed duplicate and ambiguity protection.

It does not support webhook delivery, OAuth token acquisition or refresh, image upload/send, voice retrieval, deletion, blacklist operations, or attachment replies. Those capabilities remain disabled and must not be claimed in product copy.

## Credentials and account identity

Use the existing marketplace account schema:

- `MarketplaceAccount.credentials_encrypted` stores a pre-obtained Bearer access token;
- `MarketplaceAccount.seller_id` stores Avito `user_id` as a normalized positive decimal integer string;
- neither value is returned raw, logged, copied into audit metadata, integration events, exception text, URLs, or request bodies;
- every provider request sends `Authorization: Bearer <access token>`;
- account creation requires a valid positive Avito `user_id`.

Validation is a read-only `GET /messenger/v2/accounts/{user_id}/chats` request with `limit=1`, `offset=0`, `unread_only=false`, and explicit `chat_types=u2i,u2u,a2u`. A structurally valid `200` response proves read access for that account. It does not prove `messenger:write`; the supplied OpenAPI has no non-mutating write-scope introspection endpoint. A later send returning `401` or `403` fails closed and never causes a blind retry.

MPReply stores only safe validation metadata: `validated`, `checked_at`, and normalized `fetch_chats` scope. It does not infer or persist `send_chat_message` as a validated token scope.

## Official provider contracts used

All calls use `https://api.avito.ru/` and the Bearer authorization header.

### Chat polling

`GET /messenger/v2/accounts/{user_id}/chats` accepts:

- `item_ids`: optional integer array;
- `unread_only`: boolean, default `false`;
- `chat_types`: array containing `u2i`, `u2u`, and/or `a2u`, default `u2i`;
- `limit`: integer from 1 to 100, default 100;
- `offset`: integer from 0 to 1000, default 0.

The response is an object containing a `chats` array. Each chat may contain `id`, `created`, `updated`, users, item context, and `last_message`. MPReply requires a non-empty chat ID and valid integer timestamps for an actionable chat. Missing or malformed root/list/item structure fails the page; malformed optional context is omitted rather than synthesized.

### Message polling

`GET /messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/` uses the same bounded `limit` and `offset` parameters. The trailing slash is part of the recorded path. The operation does not mark the chat read.

The response is an array. Supported message fields are:

- `id`: provider message ID;
- `author_id`: integer;
- `created`: Unix timestamp;
- `direction`: exact `in` or `out`;
- `is_read`: boolean;
- `read`: nullable Unix timestamp;
- `type`: one of the documented message kinds;
- `content.text`: text for `type=text`;
- optional quote/content metadata.

MPReply creates actionable records only from inbound unread text messages with a non-empty ID, non-empty text, valid timestamp, exact `direction=in`, exact `is_read=false`, and exact `type=text`. It does not coerce strings, booleans, floats, timestamps, IDs, or message kinds.

### Marking a chat read

`POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/read` returns an object containing boolean `ok`.

MPReply calls it only after the actionable inbound turn and its provider context are durably flushed. The read mutation is skipped when any unread inbound message in the fetched window has an unsupported type or malformed required fields. Provider failure leaves the chat unread and records a safe retryable sync error; it does not roll back already durable, idempotent ingestion.

### Sending text

`POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/messages` sends:

```json
{
  "message": {"text": "..."},
  "type": "text"
}
```

The official schema limits text to 1000 characters and the endpoint description states that only text messages can currently be sent. MPReply requires 1 to 1000 characters before network access.

The recorded success response contains `id`, `created`, `direction`, `type`, and `content.text`. MPReply requires a non-empty response `id`, exact `direction=out`, exact `type=text`, and matching response text before treating the write as proven. The provider ID is stored in `Reply.marketplace_reply_id`.

The source schema lists nonexistent `url` as a required request property while defining only `message` and `type`. This is an internal contradiction in the supplied OpenAPI. MPReply follows the endpoint description and defined properties, sends only the exact body above, and does not invent a `url` field.

## Conversation and ingestion policy

Add `chats` as a marketplace sync stream and enable it only for Avito. Existing review/question providers keep their current streams unchanged.

Polling uses `unread_only=true`, all three documented chat types, `limit=100`, and offsets `0..1000`. Each chat message traversal also uses `limit=100` and offsets `0..1000`. A page of exactly 100 entries advances by 100; a shorter page completes that traversal. Repeated offsets, excessive offsets, malformed success payloads, or page-limit exhaustion fail closed.

For each chat:

1. Strictly parse and sort the fetched provider messages by `(created, id)` without changing provider values.
2. Find the latest outbound message.
3. Select consecutive unread inbound text messages after that outbound boundary.
4. If the set is non-empty and contains no unsupported or malformed unread inbound message, create one actionable turn using the latest inbound message ID as `CustomerMessage.external_id`.
5. Join the selected text values with newline characters in chronological order. This is a deterministic representation of provider text, not generated copy.
6. Persist exact source message IDs, `chat_id`, author IDs, timestamps, chat type, item context, and latest inbound timestamp in `metadata_json`.
7. Archive older locally actionable Avito chat records for the same account/chat before exposing the new turn as `needs_reply`.
8. Mark the provider chat read only after the new turn is durable.

`CustomerMessage.type` is `chat`, rating is `null`, and product is optional. When valid `u2i` item context exists, MPReply may upsert the exact item ID/title/URL as a product. It must not create an `unknown` product or placeholder product name for `u2u`/`a2u` chats or malformed item context.

The generic ingestion service must gain an explicit product-optional path for chat messages; existing review/question behavior remains unchanged.

## Outbound safety

An Avito reply targets `metadata_json.chat_id`, not the inbound message ID in the URL.

Before every send, MPReply retrieves the exact chat message history using the bounded V3 traversal. The write is blocked when:

- any valid outbound message has `created >=` the target inbound message timestamp;
- the target chat ID or timestamp is missing/malformed;
- the read traversal returns an error or malformed success;
- pagination cannot complete within the documented bounds.

Only a valid completed traversal with no later outbound message authorizes the first send. This is a conservative MPReply policy derived from provider direction and timestamp fields; it is not represented as an Avito idempotency feature.

After the send request begins, `network_timeout`, `network_error`, or a malformed/non-verifiable `200` response is ambiguous. MPReply releases any entitlement reservation, moves the reply/message to manual review, persists an Avito outbound ambiguity marker, emits safe audit/integration records, and never broker-retries the write blindly.

Deterministic `400`, `401`, `402`, `403`, and `404` responses are terminal safe failures. `429`, `500`, and `503` are retryable only before a write or during read-only preflight/sync. Provider bodies are never returned or logged. `X-RateLimit-Limit` and `X-RateLimit-Remaining` are integer request-per-minute metadata; MPReply may record bounded numeric values in internal integration metadata but never treats them as authorization.

## Architecture changes

Keep the generic review/question adapter API stable. Add a separate typed conversation adapter contract rather than adding chat methods that every non-chat marketplace must implement.

The Avito slice consists of:

- `AvitoMessengerAdapter`: exact HTTP boundary, parsing, pagination, normalization, preflight, read mutation, and text send;
- conversation capability declarations: `fetch_chats` and `send_chat_message`;
- Avito chat sync service that traverses chats/messages and delegates durable target ingestion;
- chat-aware reply execution dispatch that preserves existing entitlement, audit, ambiguity, and durable broker semantics;
- one `chats` scheduler state per enabled Avito account;
- one Alembic migration updating the sync-state stream constraint from `reviews/questions` to `reviews/questions/chats`.

No webhook listener, webhook secret table, OAuth refresh table, media table, or Avito-only daemon is introduced.

## Error normalization

Normalize provider and transport failures without exposing bodies:

- `400` → `marketplace_validation_error`;
- `401` → `invalid_credentials`;
- `402` → `payment_required`;
- `403` → `insufficient_scope`;
- `404` → `marketplace_not_found`;
- `429` → `rate_limited`;
- `500` and `503`, plus other `5xx` → `marketplace_unavailable`;
- timeout → `network_timeout`;
- other `httpx` transport error → `network_error`;
- other HTTP rejection → `marketplace_error`;
- structurally invalid successful payload → `malformed_payload`.

Rate-limit header values are accepted only as non-negative bounded integers. The supplied OpenAPI does not define `Retry-After`, so MPReply uses its existing bounded retry policy when it is absent.

## Security and tenancy

- Existing owner/admin account-management authorization remains mandatory.
- Manual sync follows existing tenant membership checks.
- Scheduler and reply workers load account and message within their persisted tenant relationships.
- Avito `user_id`, chat IDs, provider message IDs, customer text, access tokens, and provider payloads are not written to logs or generic audit metadata.
- User-visible errors remain normalized and safe.
- No live provider call is part of automated verification.

## Verification

Implementation follows TDD with one targeted RED and one grouped GREEN per logical task. Tests use `httpx.MockTransport` and synthetic IDs/tokens only.

Required coverage:

1. exact validation, authorization header, user ID, paths, query parameters, status mapping, rate-limit headers, and malformed payload handling;
2. bounded chat/message pagination and strict parsing;
3. inbound-turn grouping, unsupported-message preservation, optional product handling, idempotent updates, and safe read timing;
4. exact outbound preflight and send contracts, 1000-character boundary, response verification, entitlement release, and no blind resend;
5. capability/registry, chat scheduler state, tenant/manual-sync behavior, durable dispatch recovery, and unchanged WB/Ozon/Yandex behavior;
6. touched Ruff and strict Pyright during implementation, followed once by the final backend/package gate and affected production container builds.

Version remains `0.1.103`. No live Avito validation, read mutation, message send, webhook registration, release, deployment, tag, force-push, or version bump is authorized by this design.
