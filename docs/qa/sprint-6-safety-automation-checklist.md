# Sprint 6 QA checklist

## Backend

- [ ] `python -m compileall app` passes.
- [ ] `ruff check app` passes.
- [ ] `pytest` passes.
- [ ] Automation rule schemas reject extra fields.
- [ ] Rating ranges reject `min_rating > max_rating`.
- [ ] Keyword lists are normalized and deduplicated.
- [ ] Highest-priority matching rule wins.
- [ ] Organization `auto` default is preserved when no override matches.
- [ ] Marketplace account override is honored when not `inherit`.
- [ ] Missing product context can require manual review.
- [ ] Low confidence can require manual review.
- [ ] Risky promises trigger manual review.
- [ ] Personal contact data triggers block.
- [ ] AI service maps SafetyGate decisions to message statuses.
- [ ] Rule CRUD is tenant-isolated.
- [ ] Cross-organization marketplace account references are rejected.
- [ ] Create/update/disable requires owner/admin.
- [ ] Evaluate/read allows active workspace roles.
- [ ] Audit logs are written for create/update/disable/evaluate.

## Database

- [ ] `alembic upgrade head` applies revision `20260710_0006`.
- [ ] `priority` exists on `automation_rules`.
- [ ] Automation rule indexes are created.
- [ ] `alembic downgrade 20260708_0005` removes Sprint 6 schema changes in a disposable environment.

## Frontend

- [ ] `/app/automation-rules` renders.
- [ ] Sidebar contains Automation Rules.
- [ ] Mobile shell remains usable.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] New UI styles use CSS variables rather than inline hardcoded colors or spacing.
