# Respio Sprint 6 patch

Apply this patch over the project after Sprint 5 and the Sprint 5 RUF001 lint fix.

## Sprint 6 scope

- Deterministic SafetyGate with `allow`, `manual_review`, and `block` decisions.
- SafetyGate integrated into AI draft generation.
- Message status mapping to `ai_draft_ready`, `needs_manual_check`, and `safety_blocked`.
- Automation Rules CRUD API.
- Automation Rules evaluation API.
- Auto-first precedence: organization default -> marketplace override -> highest-priority matching rule -> context/confidence/sensitive-topic checks.
- Strict Pydantic v2 schemas with `extra="forbid"`.
- Migration `20260710_0006_automation_rules_engine.py`.
- `/app/automation-rules` UI foundation.
- Strict typing cleanup in touched backend modules so `pyright app` passes with zero errors.
- Frontend package version raised to `0.1.6`.
- Backend package version raised to `0.1.6`.

## Verification performed before packaging

Backend:

```text
ruff check app       -> All checks passed
pyright app          -> 0 errors, 0 warnings
pytest -q            -> 24 passed
python -m compileall -> passed
alembic heads        -> 20260710_0006 (head)
```

Frontend:

```text
npm run typecheck -> passed
npm run lint      -> passed
npm run build     -> passed
```

Production Next.js build completed successfully on Next.js 16.2.9.

## Important boundary

Sprint 6 evaluates rules and safety decisions. It does not send marketplace replies or enforce real hourly/daily counters. Worker-backed auto-send execution and runtime quota enforcement are Sprint 7 scope.
