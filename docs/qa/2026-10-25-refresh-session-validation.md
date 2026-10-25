# Refresh-session validation — 25 October 2026

## Defect and correction

Refresh rotation used the request's clock before either database query. A token could expire while waiting for the session row lock or user lookup and still receive a replacement. Rotation now checks expiration against the clock after both reads.

Both authorization reads now refresh existing ORM instances from their query results. A previously loaded session or user can no longer hide committed session revocation or an authentication-version change. The existing session row lock, rotated-token replay detection, family revocation, account-status checks, email verification and cookie behavior are preserved.

## Verification

Four regression cases failed against the old implementation: expiration during either database read, committed revocation of a cached session, and an authentication-version change to a cached user. After the correction, all 34 tests across `test_auth_sessions.py`, `test_auth_routes.py`, `test_auth_cookies.py` and `test_auth_email_flows.py` passed. Rejected attempts do not create replacement sessions.

Ruff, strict Pyright for the two changed Python files and `git diff --check` passed. An independent source reviewer reported no blocking P1/P2 findings in the implementation and regression diff.

The regressions use real SQLite queries, a controlled clock and a separate session for committed invalidation. They establish expiration and ORM identity-map behavior, not PostgreSQL lock contention between simultaneous transactions. No locking strategy or schema is changed.

## Delivery boundary

GitHub Actions, Git delivery and deployment are separate evidence. The account's zero-dollar Actions budget remains unchanged. Worker/scheduler remain paused; this change requires only an API deployment with `--no-deps`. No real token, marketplace reply, AI generation, payment or outbound email is used by these regressions. No UI, visual baseline or product copy is changed.
