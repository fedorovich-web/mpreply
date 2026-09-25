# Incident runbook

## Severity guide

### SEV-1

- cross-tenant data exposure;
- leaked marketplace/Groq credentials;
- duplicate or uncontrolled automatic replies at scale;
- inability to stop outbound sends;
- destructive data loss.

### SEV-2

- API unavailable;
- worker unavailable with growing queue;
- PostgreSQL or Redis unavailable;
- widespread reply failures;
- authentication outage.

### SEV-3

- isolated integration failure;
- degraded non-critical UI;
- delayed sync for a subset of organizations.

## First actions

1. Establish incident owner and timestamp.
2. Preserve logs and deployment identifiers.
3. For outbound-reply incidents, stop or pause worker/auto-reply execution before debugging.
4. Do not paste secrets into chat, tickets or logs.
5. Check API `/health/ready`, container status, PostgreSQL, Redis and worker logs.
6. Correlate requests using `X-Request-ID`.

## Automatic-reply containment

For suspected duplicate, unsafe or runaway replies:

1. Stop the worker.
2. Disable automatic enqueueing or set affected rules inactive.
3. Identify impacted organization, account, message and reply IDs.
4. Check marketplace-side state before retrying anything.
5. Preserve idempotency records.
6. Resume in semi-automatic/manual review mode where appropriate.

## Credential incident

1. Revoke the affected external credential at the provider/marketplace.
2. Rotate the credential in MPReply.
3. Review audit and integration events.
4. Rotate application secrets when exposure scope is uncertain.
5. Document affected tenants, systems and time window.

## Exit criteria

An incident is not closed until:

- service is stable;
- containment is verified;
- impacted customers/data are identified;
- retries and queued jobs are reconciled;
- root cause and corrective actions are documented.
