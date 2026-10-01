# Automatic drafts — local verification, 30 September 2026

Checkout: `feat/auth-email-resend`, HEAD `42e5810`, with preserved uncommitted work. This report covers the durable import → AI → rules → automatic reply queue / human review bridge. It does not certify a deployment or external provider delivery.

## Implemented behavior

The marketplace scheduler discovers persisted unhandled messages in bounded batches. Discovery requires an active organization, active owner with an active owner/admin membership, and an active marketplace account with valid credentials. Demo organizations, disabled accounts, empty messages and messages with an existing draft, reply or job are excluded.

`automatic_draft_jobs` records one job per message, a credit operation key, a delivery lease, bounded attempts and a terminal outcome. Composite foreign keys enforce message/draft tenant ownership. Migration `20260930_0018` follows the reply-credit maintenance migration `20260930_0017`.

The Dramatiq actor invokes the existing `AIService`. Generation uses the durable credit ledger, short database transactions and a 240-second generation deadline within a 300-second lease. Authorization, membership, account validity, message state and lease ownership are checked again after provider I/O. A changed message or product prompt cannot queue a stale response. No database row lock spans the provider request.

The existing automation and safety services decide routing. Eligible automatic replies enter the existing send queue with its idempotency, quota and marketplace checks. Other generated replies enter the ordinary human review queue as persisted `Reply` rows, with the reason retained in metadata. The generation worker does not directly send marketplace replies.

A human reply saved during provider I/O stops automatic completion and releases the generation reservation. A human reply saved after committed generation stops automatic routing; the completed draft and its single consumed credit remain. Human draft creation acquires the same message lock and refreshes its status before validation, so it cannot insert a draft from a stale pending status after automatic routing commits.

## Recovery limits

- Discovery/claim batches default to 25 and accept only 1–100 jobs.
- A delivery receives a fresh UUID lease token. Expired tokens cannot start or complete generation.
- A broker send failure returns the job to pending after 30 seconds without using a generation attempt.
- Generation is limited to four processing attempts. Expected temporary failures retry after one minute; insufficient credits retry after five minutes within the same bound.
- A still-reserved duplicate credit operation is retried without releasing a different attempt's reservation. A fresh operation key is permitted only after a confirmed released operation. Release is verified in the failure handler so the next processing attempt can generate directly instead of spending a separate attempt on HTTP 410.
- A crash after committed generation replays the completed credit operation and routes the original draft without a second provider request or credit charge. This routing recovery also works after the fourth attempt.
- Unexpected persistence/programming errors propagate. Lease recovery handles interrupted deliveries; the actor does not silently convert them into success.
- Terminal generation failures move still-unhandled messages to `needs_manual_check` and record an audit outcome. A terminal failed job does not automatically restart after a later credit purchase; a new manual generation remains available through the existing flow.

## Fresh verification

| Check | Result |
| --- | --- |
| Full API pytest | 475 passed, 15 isolated PostgreSQL tests skipped in the default invocation |
| Isolated native PostgreSQL suite | 15 passed separately: 8 credit tests and 7 automatic-draft tests |
| Migration 0018 | Head → 0017 → head passed on the isolated PostgreSQL test database |
| Ruff (`app`, `alembic`) | Passed |
| Strict Pyright | 0 errors, 0 warnings |
| Repository integrity | Passed with migration head 0018 |

The SQLite/service coverage includes automatic and semi-automatic routing, real review queue rows, duplicate delivery, broker failure, crash replay, exhausted attempts, failed-generation credit release, repeated provider-failure recovery, reserved-operation recovery, demo/account/role revocation during generation, changed input, safety-blocked drafts and human draft priority both during provider I/O and before routing.

Native PostgreSQL coverage verifies competing discover/claim/process calls, tenant foreign keys, expired leases, human draft priority in both response modes and absence of job/message locks during provider I/O. One test exercises persisted import → mocked AI completion → rules → existing Ozon send adapter with HTTP `MockTransport`, encrypted synthetic credentials, and repeated execution without a second HTTP write or credit charge. This is local adapter/service integration evidence, not an Ozon seller-account write.

Reproduce the isolated PostgreSQL checks from the repository root after starting the existing native local database:

```powershell
.\apps\api\.venv\Scripts\python.exe .\scripts\check-local-automatic-drafts.py --check-migration
```

The script uses only the dedicated `mpreply_credit_test_20260930` database and local generated secrets. It does not migrate the demo database, start a worker or use live provider keys.

## Remaining runtime and product boundaries

Redis, the continuous Dramatiq worker and the scheduler are not running in the local demo stack. Real broker delivery, process restart and repeated scheduler operation remain unverified. The worker image command includes `app.workers.automatic_drafts`; Docker was not run.

The configured local AI implementation remains Groq. OpenRouter/model routing, actual answer quality, seller-account scopes/writes, paid grant issuance and email delivery belong to the separately authorized domain-stage work. Public model labels are approved copy and do not prove provider availability.

The new pipeline closes automatic draft preparation after imports at the service/database level. It does not implement answer-template CRUD/application, a separate grammar checker, plan-specific history/analytics/support entitlements, or the configured monetary daily AI budget. Those capabilities require their own implementation and evidence; their approved public copy was preserved.
