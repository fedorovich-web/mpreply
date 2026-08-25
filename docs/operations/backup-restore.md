# PostgreSQL backup and restore runbook

## Scope

This runbook covers the MPReply application PostgreSQL database, the separate CMS PostgreSQL database and the CMS media volume. Redis is treated as transient queue/cache infrastructure and must not be considered the system of record for marketplace credentials, messages, replies, billing state or audit records.

## Minimum production policy

- Automated PostgreSQL backups must run outside the application containers.
- Backups must be encrypted at rest and access-controlled separately from application credentials.
- Retention must be defined before launch.
- A restore test must be performed on staging before production launch and repeated on a schedule.
- A backup is not considered valid until restore succeeds and application smoke tests pass.
- CMS database and media backups must be captured as one recoverable content set and restored together.

## Pre-backup checks

1. Confirm the target environment and database identity.
2. Confirm adequate free storage.
3. Record the current application version, Alembic head and Payload migration status.
4. Avoid exposing `DATABASE_URL` or `CMS_DATABASE_URL` in shell history or logs.

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

Create a separate custom-format dump for the CMS database using `CMS_DATABASE_URL`. Never substitute the application database URL or store either URL in a committed script.

Back up the persistent `cms-media` volume with the storage provider's snapshot/export mechanism. Record the media snapshot identifier beside the CMS database backup identifier.

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

Restore the CMS dump into a disposable CMS staging database, restore its matching media snapshot into a disposable volume, and run `npm run migrate:status` from the CMS image before starting the staging CMS.

Verify:

- API `/health/ready` returns HTTP 200;
- authentication works;
- tenant isolation smoke tests pass;
- representative marketplace accounts, messages, replies and audit rows exist;
- encrypted marketplace credentials can be decrypted only with the expected production key;
- worker can connect to PostgreSQL and Redis without executing unintended sends.
- CMS `/api/health` returns HTTP 200;
- an editor can open restored published content and its media;
- the CMS service user can read published content but cannot access drafts or mutate records;
- web receives the restored content through its server-side CMS client.

## Recovery warning

Do not rotate or lose `CREDENTIALS_ENCRYPTION_KEY` without a controlled re-encryption procedure. Database backups alone are insufficient to recover encrypted marketplace credentials if that key is lost.
