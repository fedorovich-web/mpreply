# Respio patch 0.1.24

Targeted CI hotfix for the remaining Automation Rules Chromium E2E failure.

## What changed

- Fixed the Automation Rules E2E mock so POST-created rules persist in subsequent GET list responses.
- Added a unit regression test protecting the exact create-then-refetch contract.
- Synchronized all real project version sources to `0.1.24`.

## Scope

No production UI, backend business logic, database schema, marketplace adapter, or public-site design was changed.
