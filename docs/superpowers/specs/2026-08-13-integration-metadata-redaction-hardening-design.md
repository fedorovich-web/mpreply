# Integration metadata redaction hardening design

## Status

Approved for implementation on 2026-08-13 when the user continued from the Ozon staging-readiness audit with «Далее».

## Goal

Prevent integration overview responses from exposing values stored under `client_id`, `seller_id`, or `provider_body`, including nested metadata, while preserving the existing safe counters and status details.

## Current boundary

`sanitize_integration_metadata()` already recursively removes keys containing credential, secret, token, API-key, authorization, or cursor markers. Current audited integration-event writers do not persist raw Ozon Client ID, seller ID, or provider bodies. The Ozon client workspace also filters those keys, but the API must remain the security boundary instead of relying on browser filtering.

## Considered approaches

1. **Extend the existing recursive denylist — selected.** Add `client_id`, `seller_id`, and `provider_body` to `_SENSITIVE_METADATA_PARTS`. This preserves the response shape, protects every marketplace, and is the smallest compatible change.
2. **Filter only in the Ozon workspace — rejected.** This leaves other API consumers and future integration screens exposed to unsafe metadata.
3. **Replace the sanitizer with a strict allowlist — deferred.** This gives a stronger long-term schema but would remove currently supported safe details and requires a separate cross-integration contract review.

## Behavior

- Matching remains case-insensitive because keys are normalized with `lower()` before comparison.
- Matching remains substring-based, consistent with the existing sanitizer.
- The three new markers are removed at the top level and at every recursively processed mapping level.
- Existing primitive list filtering and safe non-sensitive metadata remain unchanged.
- No provider request, credential lifecycle, database model, API schema, dependency, visual token, or version changes.

## Test contract

Extend the existing real-function test in `test_marketplace_account_overview_contract.py` with independent canary values under:

- top-level `client_id`;
- nested `seller_id`;
- nested `provider_body`.

The RED result must show at least one canary in the actual sanitized output. The GREEN result must equal the existing safe literal containing only `pages_processed` and primitive `items`.

## Verification

Run the focused overview contract for RED/GREEN, then the affected backend package gate: repository integrity, tooling tests, dependency consistency, Ruff, strict Pyright, full backend pytest, compileall, and Alembic heads. No live marketplace request is part of verification.
