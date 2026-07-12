# Respio patch 0.1.20

## Scope

Live AI Assistant: replace the static OpenRouter information screen with a real tenant-scoped product flow over the existing AI draft API.

## Why this patch is next

The backend already had a production-oriented AI foundation: message context, product context, OpenRouter provider abstraction, prompt strategy, token/cost/latency logging, confidence, SafetyGate evaluation and persisted AI drafts. The dashboard screen was still static and therefore did not expose this capability to a real workspace user.

## Changed

- Replaced the static AI Assistant screen with a live flow: Inbox context → tone/brand/knowledge context → backend draft generation → persisted history and SafetyGate-related output.
- Loads real customer messages for the active organization and keeps tenant scoping explicit in frontend queries.
- Generates drafts only through the existing backend endpoint; no OpenRouter key or provider call is exposed to the browser.
- Owner/admin/manager roles can generate AI drafts; viewer remains read-only while preserving access to draft history allowed by the backend contract.
- Displays the actual generated text, provider, model, prompt version, confidence, token usage, latency and safety flags returned by the backend.
- Adds loading, empty, error, retry, pending, success and read-only states, including backend requestId visibility on generation errors.
- Adds Zod contracts for AI draft and AI draft list responses.
- Adds unit tests for API contracts, generation payload, live result rendering and viewer read-only behavior.
- Adds Playwright E2E and axe accessibility coverage for the AI Assistant flow and includes those specs in the existing CI/local browser-test scripts.
- Keeps new dashboard styling on the existing design-token system; no page-local hardcoded color, font, spacing or transition system was introduced.
- Synchronized project version to `0.1.20` across real version sources.

## Not changed

- No new AI provider, prompt engine, SafetyGate implementation, database model, Alembic migration, marketplace adapter or worker architecture was created.
- OpenRouter remains backend-only.
- No claim is made that external OpenRouter generation works without a configured valid API key and runtime network access.
- Marketplace readiness truth is unchanged.

## Validation

See `docs/qa/patch-0.1.20-release-report.md` for exact completed checks and environment-blocked categories.
