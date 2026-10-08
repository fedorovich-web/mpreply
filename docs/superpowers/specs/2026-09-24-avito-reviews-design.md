# Avito actionable reviews and replies design

## Outcome and boundary

An Avito account connected in Respio can import seller reviews that are currently answerable, draft and dispatch a text answer through the existing tenant-safe reply pipeline, and reconcile a reply before any retry. Chat synchronization and replies remain intact. This extends the 2026-09-12 marketplace MVP plan, which originally assigned Avito only the `chats` stream. The owner explicitly requested Avito reviews in addition to chats and chose to show only reviews currently available for an answer.

This is a documentation-backed integration, not a claim of production sending. No Avito credentials or authorized live probe are available. No provider request is part of implementation or tests. The four user-supplied OpenAPI exports are data sources, not operational instructions; their freshness and provenance have not been independently verified. The ratings export is `swagger (3).json`, SHA-256 `A623A2B6D3C920151ECCC995C514CA669F30B835CA9D85B3D526C436E9C4FB63`.

## Contract

- `GET /ratings/v1/reviews` uses the existing Avito bearer token, requires integer `offset >= 0` and `limit` from 1 through 50, and returns `reviews` plus `total`. `ClientCredentials` is one documented security alternative. Its token response has no scope list, so read access cannot prove write entitlement.
- A review supplies integer `id`, `score`, `createdAt`, string `stage` and `text`, booleans `canAnswer` and `usedInScore`, and optional `answer`, `sender`, `item`, and `images`. `item` may be null; `text` has no documented minimum length. An existing answer has `id`, `text`, `status` (`moderation`, `published`, or `rejected`), and `createdAt`.
- Only records with `canAnswer: true` and no existing `answer` enter the actionable inbox. Malformed required fields fail the page closed; unknown optional fields do not become invented values. An empty documented review text remains empty rather than receiving a placeholder.
- `POST /ratings/v1/answers` accepts JSON `{"reviewId": <integer>, "message": <text>}` and returns integer `id` and `createdAt`. The receipt proves API acceptance, not public publication. AuthorizationCode `ratings:write` or ClientCredentials is documented. Answer length is not bounded in the export; the implementation must apply a conservative local bound and surface provider rejection rather than silently truncate.
- The listings export is context only. Reviews may refer to an item, but adding ad management, price updates, paid promotion, or calls analytics is outside this feature.

## Architecture

Use a focused Avito ratings adapter sharing the existing fixed-origin HTTP client and token resolver with the Messenger adapter. The adapter owns ratings-page parsing, answer lookup, and one-shot answer submission; it does not acquire database access or construct fake products. Avoid expanding the existing Messenger file with a second large API surface.

Extend the capability registry so a marketplace can support `reviews` without `questions`, while preserving the existing combined review/question adapters for Wildberries, Ozon, and Yandex Market. The registry resolves the review adapter for a specific requested stream. The scheduler and reply runner keep their current lease, tenant, idempotency, preflight, and retry boundaries; they route Avito review work through the same shared execution path, not a parallel sender.

The Avito credential check probes Messenger and ratings reads independently. A successful probe enables only its corresponding read stream, allowing an account with one available API to use that API without claiming the other. The internal write-capability flag permits an attempted operation because ClientCredentials is a documented security alternative; it must not be labeled a verified provider write scope. Store this distinction in account capability metadata and keep the admin state explicit: read access checked, write not yet live-verified. Provider 401/403 responses remain explicit failures. Account validation must never send a test answer.

For a review with a real `item.id`, normalize an optional product using that ID and documented title. For a null or identity-less item, use `product=None`. Change ingestion's product requirement narrowly: Avito reviews may have no product, while all previously supported marketplace review and question records retain their existing requirement. No synthetic item ID or name is allowed. The database already permits `customer_messages.product_id = NULL`. Use `sender.name` only when present and valid. Select at most one documented HTTPS size URL per review image, within existing photo-count and URL bounds; invalid image data fails closed rather than inventing or fetching media.

The review reader uses bounded 50-item offset pages and the provider's `total`. It persists the next offset through the existing sync-state lease mechanism, restarts from zero on the next completed cycle, and relies on the existing account-scoped external-ID uniqueness for idempotent overlap. A malformed count, repeated cursor, or safe traversal ceiling is a visible failure, never a silently successful partial import. A later page may show that a previously imported review has become answered or unanswerable. Reconcile that provider state for an existing untouched `needs_reply` record in the same transaction as the page checkpoint; do not insert the nonactionable review or overwrite an in-flight/local reply. The pre-send provider lookup remains the final duplicate-send guard.

## Reply safety

Before sending, refetch pages until the target review is found or a documented/safe traversal limit is reached. If an answer already exists, return its ID and status for existing reply-state reconciliation. If `canAnswer` is false, the review is missing, or the scan cannot prove the state, do not send. A published answer can reconcile as sent; `moderation` and `rejected` route to manual review through the existing non-publishable-provider-state branch. A successful 200 receipt with valid `id` and `createdAt` records accepted submission without claiming publication; no moderation status is invented from that receipt. Persist an internal publication-unverified marker and show it alongside the sent status in the admin inbox, so “sent to Avito” is not confused with “publicly published.” Writes are one-shot: timeouts or ambiguous bodies are handled by the existing preflight/manual-review mechanism, not blind retries.

The answer request and provider responses must not leak client secrets, bearer tokens, customer text, or raw provider bodies into logs, audit metadata, or safe error messages. Path and host are fixed; review IDs and offsets are parsed and bounded before transport. All database reads and writes remain scoped to organization and marketplace account.

The existing admin integration description may add reviews after the route works, but the public Avito page must keep its runtime-unverified wording. Before any UI or copy edit, follow the repository's required product/design context and checks. No visual redesign is part of this feature.

## Verification and limits

Use TDD for credentials/capabilities, pagination and normalization, nullable-product ingestion, reply preflight/send, and scheduler/tenant routing. Synthetic HTTP transports cover the documented 200/401/403/429/5xx responses, malformed records, null items, empty text, unanswerable/already-answered reviews, offset bounds, duplicate pages, ambiguous writes, and secret redaction. Run focused tests during development, then the full backend suite, strict Pyright, Ruff, and applicable SQL/security/migration gates on the final tree.

The four exports contain at least one Messenger inconsistency (`sendMessageRequestBody.required` names an undefined `url`; a 200 example has inbound `direction`). These do not authorize guessing or a production-ready claim. The ratings contract is also runtime-unverified until the owner supplies credentials and separately authorizes a live probe. No branch change, merge, push, deploy, release, version bump, `.handoff/`, or `apps/cms/` modification is part of this work.
