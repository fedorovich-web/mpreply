# PostgreSQL backup and restore runbook

## Scope

This runbook covers the MPReply PostgreSQL database. Redis is treated as transient queue/cache infrastructure and must not be considered the system of record for marketplace credentials, messages, replies, billing state or audit records.

## Minimum production policy

- Automated PostgreSQL backups must run outside the application containers.
- Backups must be encrypted at rest and access-controlled separately from application credentials.
- Retention must be defined before launch.
- A restore test must be performed on staging before production launch and repeated on a schedule.
- A backup is not considered valid until restore succeeds and application smoke tests pass.

## Pre-backup checks

1. Confirm the target environment and database identity.
2. Confirm adequate free storage.
3. Record the current application version and Alembic head.
4. Avoid exposing `DATABASE_URL` in shell history or logs.

## Logical backup example

Run with a PostgreSQL client version compatible with the server:

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="mpreply-$(date +%Y%m%d-%H%M%S).dump" \
  "$DATABASE_URL"
```

## Restore drill

Restore into a disposable staging database, never directly over production:

```bash
createdb "$RESTORE_DATABASE_NAME"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$RESTORE_DATABASE_URL" \
  mpreply-backup.dump
```

Then run:

```bash
alembic current
alembic heads
```

Verify:

- API `/health/ready` returns HTTP 200;
- authentication works;
- tenant isolation smoke tests pass;
- representative marketplace accounts, messages, replies and audit rows exist;
- encrypted marketplace credentials can be decrypted only with the expected production key;
- worker can connect to PostgreSQL and Redis without executing unintended sends.

## Recovery warning

Do not rotate or lose `CREDENTIALS_ENCRYPTION_KEY` without a controlled re-encryption procedure. Database backups alone are insufficient to recover encrypted marketplace credentials if that key is lost.
