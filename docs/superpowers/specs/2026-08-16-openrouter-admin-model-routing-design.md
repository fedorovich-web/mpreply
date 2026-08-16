# OpenRouter Admin Configuration and Model Routing Design

**Date:** 2026-08-16
**Status:** Approved for implementation planning
**Scope:** MPReply `0.1.104` development branch

## Context

MPReply currently constructs `OpenRouterProvider` directly from deployment settings. One global `OPENROUTER_API_KEY`, one default model and one fallback model are configured through the environment. The authenticated AI assistant calls the backend only, but the internal superadmin workspace exposes metrics rather than provider configuration.

The requested product behavior is one platform-wide OpenRouter account managed by MPReply superadmins. It is not organization BYOK. Superadmins must be able to add or rotate the key, load the current model catalog and assign models to message scenarios without exposing the credential to customers or returning it to the browser.

This is the first closure increment in the broader `0.1.104` release-candidate work. Marketplace live runtime certification remains a separate, credential-dependent gate and is not implied by this design.

## Goals

- Store an OpenRouter inference key encrypted at rest and manage it from the internal superadmin workspace.
- Preserve the existing environment key as a bootstrap source until a database key is saved.
- Make an explicit admin disable state authoritative over every environment fallback.
- Validate a new key and load only models available to that authenticated OpenRouter account.
- Configure separate models for ordinary reviews, negative reviews, buyer questions, Avito chats, quality retry and provider fallback.
- Make backend routing authoritative; organization users cannot choose an arbitrary model.
- Bound every draft generation to at most two OpenRouter completion attempts.
- Preserve accurate usage, safety, audit and failure behavior without storing provider payloads or secrets.

## Non-goals

- Per-organization keys or customer BYOK.
- Creating, rotating, disabling or deleting keys in the OpenRouter account itself. MPReply manages only its local copy of an existing inference key.
- OpenRouter management keys.
- Automatic model benchmarking or automatic cost-based model selection.
- Marketplace runtime certification, deployment, merge, tag or version bump.
- Webhooks, media or other marketplace feature expansion.

## Considered approaches

### 1. Encrypted database configuration with environment bootstrap

This is the selected approach. The database owns admin changes and scenario routes. The current environment key remains available only when no database key is stored and the provider has not been explicitly disabled.

Advantages:

- no deployment restart for key or routing changes;
- atomic validation and rotation;
- an explicit disabled state cannot accidentally resurrect an environment key;
- follows the existing `CredentialService` encryption and fingerprint pattern.

Trade-off: it adds one migration and an operational configuration service.

### 2. Admin UI that edits deployment environment variables

Rejected. It couples the application to a deployment provider, requires restart orchestration and gives the web application broader infrastructure authority than the feature needs.

### 3. Per-organization BYOK

Rejected. It conflicts with the approved platform-wide provider account and creates organization billing, quota, support and credential-lifecycle requirements outside this release.

## Official provider contracts

The implementation uses the documented OpenRouter endpoints under the existing configurable base URL:

- `GET /key` with `Authorization: Bearer <key>` validates the current inference key and returns key metadata;
- `GET /models/user` with the same authorization returns models filtered by that user's provider preferences, privacy settings and guardrails;
- `POST /chat/completions` remains the generation endpoint.

MPReply does not depend on undocumented fields. Provider responses are parsed through explicit schemas and projected to a small internal contract.

## Data model

Add a singleton-capable `llm_provider_settings` table. The provider column is unique and the first supported provider is `openrouter`.

Required fields:

- `id` and `provider`;
- `enabled`;
- nullable `api_key_encrypted`;
- nullable `credential_fingerprint`;
- six nullable routing fields: `review_model`, `negative_review_model`, `question_model`, `chat_model`, `safety_retry_model`, `fallback_model`;
- nullable `validated_at`;
- nullable `updated_by` superadmin id;
- created and updated timestamps.

The raw key is never stored outside `api_key_encrypted`. A row may use the environment key by keeping `api_key_encrypted` null while storing complete routing settings. A database constraint enforces that the six route columns are either all null or all populated. Routing updates are all-or-nothing.

No provider catalog or provider response body is persisted. Catalog data is fetched on demand. Selected model ids remain stored even if a model later disappears so the admin can see and replace the stale assignment instead of silently losing configuration.

## Effective configuration precedence

The resolver applies this exact order:

1. If a database row exists with `enabled = false`, OpenRouter is disabled. No environment fallback is allowed.
2. If an enabled row contains an encrypted key, use the decrypted database key.
3. Otherwise use a valid configured environment key.
4. If neither source contains a usable key, report `unconfigured` and fail generation safely.

For models, a complete saved database routing configuration wins. With no saved routing, ordinary scenarios use the existing environment default and quality retry/provider fallback use the existing environment fallback model.

The safe admin response exposes only `source = database | environment | none`, `state = active | disabled | unconfigured`, a masked fingerprint when available, validation timestamps and selected model ids.

## Superadmin API

All endpoints live under `/api/admin/llm/openrouter` and require `require_superadmin` before credential decryption or provider access.

### Read configuration

`GET /api/admin/llm/openrouter`

Returns the safe effective state, configured routes and timestamps. It never returns raw or encrypted key material.

### Validate a candidate key and load models

`POST /api/admin/llm/openrouter/validate`

Accepts a candidate key, calls `/key`, then `/models/user`, and returns normalized catalog entries. Management and provisioning keys are rejected; MPReply accepts an inference key only. The operation does not persist the key. The browser keeps the password field only until a successful save or navigation away.

### Refresh models

`POST /api/admin/llm/openrouter/models/refresh`

Uses the current effective server-side key and returns the same safe catalog projection.

Each catalog entry contains only:

- `id`;
- `name`;
- supported input and output modalities;
- context length;
- prompt and completion pricing when both values parse safely;
- expiration date when valid.

Descriptions, links, provider payloads, benchmark objects and unknown fields are discarded. Only models that can produce text are offered for reply routing.

### Save or rotate configuration

`PUT /api/admin/llm/openrouter`

Accepts all six route ids and an optional new key. A key is required when there is no effective configured key. The backend validates a supplied key again, loads its current user catalog and verifies every selected route id before one database transaction replaces the old configuration.

A route-only update validates the ids against a fresh catalog loaded with the current effective key. If validation or catalog retrieval fails, the previous key and routes remain unchanged.

### Disable or remove the local key

`POST /api/admin/llm/openrouter/disable` sets the authoritative disabled state. `DELETE /api/admin/llm/openrouter/key` clears the local ciphertext and fingerprint and leaves the provider disabled. The UI must say that this does not revoke the key at OpenRouter.

Both operations require an explicit confirmation UI and write a safe audit event.

## Runtime model routing

Introduce an `LLMConfigurationService` for persistence, provider validation and safe admin contracts, plus a small `LLMRouteResolver` used by `AIService`.

The initial route is selected deterministically:

- review with rating `1` or `2`: `negative_review_model`;
- any other review: `review_model`;
- question: `question_model`;
- chat: `chat_model`.

The negative threshold matches the existing analytics definition. Missing review ratings follow the ordinary review route.

The public draft-generation request no longer accepts an arbitrary `model`. Backend configuration is authoritative. Temperature, maximum tokens, tone and seller context remain within their existing validated bounds.

## Two-attempt execution policy

One draft generation can make at most two completion requests in total.

1. Call the scenario model.
2. If that request fails with an existing transient class (`rate_limited`, `unavailable`, `timeout` or network error), call `fallback_model` once. Do not perform a quality retry afterward.
3. If the first completion succeeds but SafetyGate does not allow it, call `safety_retry_model` once unless the only reason is missing product context. Do not then call the provider fallback.
4. Authentication, malformed-request and configuration errors fail immediately without retry.

If a quality-retry request fails, retain the first valid completion and its SafetyGate state rather than losing an already generated draft. The retry failure is recorded only as a safe error code. If a transient fallback request fails, generation returns the existing safe provider error because no valid completion exists.

When two valid completions exist, evaluate both through the same SafetyGate and choose deterministically by:

1. `ALLOW` over `MANUAL_REVIEW` over `BLOCK`;
2. higher confidence when decisions are equal;
3. the first completion when the result is still tied.

The persisted draft records the selected output model and text. Token counts, latency and cost cover all attempts so billing and operations do not undercount retries. The safe audit metadata records the routing key, attempted model ids, attempt count, retry class and final SafetyGate decision. It does not contain prompts, customer text, completion text, keys or provider bodies.

## Admin workspace UX

Keep `/app/admin` as the superadmin overview and add `/app/admin/llm` as the operational provider page. Both remain backend-authorized; hiding navigation is not the security boundary.

The LLM page contains four flat sections using existing design tokens and form primitives:

1. Provider status: active/disabled/unconfigured, source, masked fingerprint and last successful validation.
2. Key action: blank password input, `Проверить и загрузить модели`, validation state and safe error.
3. Routing: six accessible searchable selectors populated from the authenticated catalog, with stale saved ids visibly flagged.
4. Guarded actions: save/activate, disable, and remove the local key.

The key input is never prefilled and is cleared after successful save. Provider errors are mapped to concise Russian categories: invalid key, rate limit, provider unavailable, timeout, malformed provider response and configuration conflict. Raw provider messages are never rendered.

The page supports loading, empty, validation-success, validation-error, save-error, stale-model, disabled and unconfigured states. It uses no new dependency, visual token, icon system or decorative pattern.

## Security and failure behavior

- `require_superadmin` executes before decryption or network access.
- `CredentialService` performs encryption, decryption and fingerprinting with the existing credentials encryption key.
- Secret values are never returned, logged, audited or included in exception text.
- Candidate keys are validated only in memory and are persisted only after all checks pass.
- Replacement is transactional; failed validation cannot overwrite a working key.
- Provider requests have the existing bounded timeout and no uncontrolled retry loop.
- Schemas reject extra fields, invalid route ids, oversized strings, non-finite pricing and malformed provider structures.
- Disabling fails closed and overrides the environment key.
- Removing a key is described as local removal, never provider revocation.
- Model names and ids are rendered as text only. Provider HTML is never accepted.

## Audit events

Add append-only safe events for:

- `admin.llm_key_validated`;
- `admin.llm_configuration_updated`;
- `admin.llm_provider_disabled`;
- `admin.llm_key_removed`;
- generation routing and retry outcome through the existing AI draft audit.

Metadata may include provider, masked fingerprint, model ids, source, attempt count and safe error code. It must not include any credential, provider body, prompt or message content.

## Testing strategy

Implementation follows test-driven development with synthetic transports only.

Backend coverage:

- migration and model constraints;
- resolver precedence for database, environment, disabled and unconfigured states;
- superadmin authorization before decryption/network access;
- key validation and catalog projection;
- atomic initial save, route update and rotation;
- failure preservation of the previous configuration;
- complete route validation and stale model rejection;
- no secret in schemas, logs, audits or safe errors;
- route selection for ordinary/negative reviews, questions and chats;
- removal of client model override;
- two-call hard limit, transient fallback, quality retry and deterministic candidate selection;
- aggregated usage and safe audit metadata.

Frontend coverage:

- safe schema parsing and exact mutation payloads;
- key is never rendered or prefilled and clears after success;
- environment/database/disabled/unconfigured states;
- catalog search, six route assignments and stale ids;
- provider error categories and preserved form state after failure;
- guarded disable and local key removal language;
- non-superadmin denial.

Browser coverage:

- superadmin loads the page, validates a synthetic key, selects all routes and saves;
- rotation failure preserves the displayed active configuration;
- disable state is explicit and generation is not implied to remain available;
- keyboard, focus, accessible names, mobile layout and visual regression checks.

No test or implementation step calls live OpenRouter or marketplace APIs.

## Verification and completion gates

During implementation, run focused backend/frontend tests for changed files. Before completion, run one fresh complete gate for affected packages:

- backend pytest, Ruff, strict Pyright, compileall, integrity checks and Alembic head verification;
- frontend `design:detect`, unit tests, typecheck, lint and build;
- E2E, accessibility, visual and Lighthouse gates required by the repository;
- container and remote GitHub Quality Gate for the exact pushed SHA;
- `git diff --check` and an intentional changed-file review.

The feature is complete when the encrypted admin lifecycle, authoritative routing, bounded retry behavior, safe UI and all stated tests pass. This does not certify OpenRouter billing or marketplace runtime without separately authorized real-account evidence.

## Release boundaries

Work stays on `codex/0.1.104-backend` and updates the existing draft PR. No new branch/worktree, merge, deployment, tag or version bump is part of this design. Project version remains `0.1.103` until the complete release closure is separately authorized.
