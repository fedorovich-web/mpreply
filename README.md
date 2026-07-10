# Respio — Sprint 6 SafetyGate + Automation Rules Engine

Sprint 6 adds deterministic SafetyGate enforcement, automation rules CRUD/evaluation, auto-first precedence and the dashboard foundation for automation rules.

## Added in Sprint 6

- Deterministic SafetyGate with `allow`, `manual_review`, and `block` decisions.
- SafetyGate integrated into AI draft generation.
- Automatic message status transition to `ai_draft_ready`, `needs_manual_check`, or `safety_blocked`.
- Automation Rules CRUD API.
- Rule evaluation API for marketplace messages.
- Auto-first precedence: organization default → marketplace override → highest-priority matching rule → context/confidence/sensitive-topic checks.
- Strict Pydantic v2 request schemas with `extra="forbid"`.
- Database migration for rule priority and rule lookup indexes.
- `/app/automation-rules` dashboard foundation.
- Backend test coverage for SafetyGate, rule engine and rule schemas.

## Important Sprint 6 boundary

Sprint 6 evaluates rules and determines whether a message may proceed automatically, but it does not send replies or enforce runtime hourly/daily counters. Worker-backed auto-send execution and real quota enforcement belong to Sprint 7.

## Verification performed

- `ruff check app` — passed.
- `pyright app` — 0 errors, 0 warnings.
- `pytest -q` — 24 passed.
- `python -m compileall app` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed on Next.js 16.2.9.
- `alembic heads` — `20260710_0006 (head)`.
