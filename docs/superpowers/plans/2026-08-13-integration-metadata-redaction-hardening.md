# Integration Metadata Redaction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `client_id`, `seller_id`, and `provider_body` values recursively from marketplace integration overview metadata.

**Architecture:** Extend the existing case-insensitive substring denylist used by `sanitize_integration_metadata()`. Protect the behavior with the existing real-function contract test; do not add an Ozon branch or change response schemas.

**Tech Stack:** Python 3.14 dev runtime within the repository-supported `>=3.13,<3.15` range, pytest 9.0.2, Ruff 0.14.9, Pyright 1.1.411.

## Global Constraints

- Do not call Ozon or any marketplace provider.
- Do not change API schemas, database models, dependencies, visual tokens, or versions.
- Preserve safe integration metadata and current recursive behavior.
- Include the staging acceptance checklist from the audit in the final logical patch.
- Work only on `codex/0.1.104-backend`; do not merge, deploy, tag, or force-push.

---

### Task 1: Harden recursive integration metadata redaction

**Files:**
- Modify: `apps/api/app/tests/test_marketplace_account_overview_contract.py`
- Modify: `apps/api/app/services/marketplace_account_overview_service.py`
- Include: `docs/qa/ozon-staging-acceptance-checklist.md`
- Include: `docs/superpowers/specs/2026-08-13-integration-metadata-redaction-hardening-design.md`
- Include: `docs/superpowers/plans/2026-08-13-integration-metadata-redaction-hardening.md`

**Interfaces:**
- Consumes: `sanitize_integration_metadata(metadata: Mapping[str, object]) -> dict[str, object]`.
- Produces: the same function signature and response shape with three additional sensitive-key markers removed recursively.

- [ ] **Step 1: Write the failing regression test**

Extend `test_sensitive_integration_metadata_is_removed_recursively()` with literal canaries:

```python
sanitized = sanitize_integration_metadata(
    {
        "pages_processed": 2,
        "client_id": "must-not-expose-client-id",
        "nested": {
            "seller_id": "must-not-expose-seller-id",
            "provider_body": "must-not-expose-provider-body",
        },
        "items": ["reviews", 3],
    }
)

assert sanitized == {
    "pages_processed": 2,
    "items": ["reviews", 3],
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from `apps/api`:

```powershell
python -m pytest app/tests/test_marketplace_account_overview_contract.py::test_sensitive_integration_metadata_is_removed_recursively -q
```

Expected: one assertion failure because at least one new canary remains in the actual sanitized dictionary.

- [ ] **Step 3: Implement the minimal production change**

Change the existing tuple to:

```python
_SENSITIVE_METADATA_PARTS = (
    "credential",
    "secret",
    "token",
    "api_key",
    "authorization",
    "cursor",
    "client_id",
    "seller_id",
    "provider_body",
)
```

Do not change `sanitize_integration_metadata()` control flow.

- [ ] **Step 4: Run focused GREEN**

Run from `apps/api`:

```powershell
python -m pytest app/tests/test_marketplace_account_overview_contract.py -q
```

Expected: all tests in the module pass.

- [ ] **Step 5: Run the affected backend gate**

Run repository integrity/tooling tests, `python -m pip check`, `python -m ruff check app alembic`, strict Pyright for `app`, full `python -m pytest -q`, `python -m compileall -q app alembic`, and `python -m alembic heads` using the already installed dev runtime.

- [ ] **Step 6: Audit and publish the logical patch**

Run `git diff --check`, inspect the exact five-file scope, scan for secret-like literals, commit with:

```text
fix(security): harden integration metadata redaction
```

Push `codex/0.1.104-backend` normally and wait for one current-SHA GitHub Quality Gate. Do not merge or deploy.
