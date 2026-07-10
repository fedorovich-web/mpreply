# Deployment rollback runbook

## Principle

Application rollback and database rollback are different operations. Do not downgrade database schema automatically merely because an application image is rolled back.

## Before deployment

Record:

- Git commit SHA;
- application version;
- image identifier;
- Alembic current revision;
- backup identifier;
- deployment timestamp.

## Application rollback

For a code-only regression where the previous application version is compatible with the current schema:

1. Stop further rollout.
2. Route traffic to the previous known-good API and web images.
3. Restart the worker on the same known-good application revision.
4. Verify `/health/live` and `/health/ready`.
5. Run auth, tenant isolation, Inbox and queue smoke tests.
6. Review failed/retrying reply executions before resuming automatic sending.

## Database changes

Never run `alembic downgrade` automatically in production.

A database rollback requires a migration-specific decision:

- forward-fix with a new migration;
- restore from backup;
- carefully reviewed downgrade when the migration explicitly supports it and data-loss impact is accepted.

## Automatic-reply safety after rollback

If a deployment fails after reply jobs were queued:

- pause automatic reply enqueueing;
- inspect `replies`, execution status and idempotency keys;
- do not delete queued or failed jobs blindly;
- confirm marketplace-side answer state before retries;
- resume only after duplicate-send risk is understood.
