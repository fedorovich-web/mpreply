# Sprint 10 — manual review and semi-automatic reply workflow

## Scope

Sprint 10 closes the optional human-approval path without changing the product default: Respio remains auto-first.

Implemented workflow:

1. create a semi-automatic reply draft from an AI draft or manual text;
2. edit the draft with optimistic revision control;
3. re-run SafetyGate on edited text;
4. submit for review;
5. approve or reject back to draft;
6. queue an approved reply with the same idempotency key used by automatic execution;
7. execute through the existing worker and marketplace adapter pipeline;
8. persist audit events for every human decision.

## API contract

- `POST /api/replies/manual`
- `PATCH /api/replies/{reply_id}/draft`
- `POST /api/replies/{reply_id}/submit-review`
- `POST /api/replies/{reply_id}/approve`
- `POST /api/replies/{reply_id}/reject`
- `POST /api/replies/{reply_id}/send`

## Safety properties

- manual text is evaluated by deterministic SafetyGate;
- edited text is evaluated again before review submission;
- approved text is evaluated again at the approval/send boundary;
- replies exposing personal contact data are blocked;
- stale editor updates are rejected using `expected_revision`;
- only `owner`, `admin` and `manager` roles can modify, approve or send replies;
- one initial marketplace reply per message is protected by the existing unique idempotency key.

## State model

Message path:

`needs_reply / ai_draft_ready / needs_manual_check → waiting_review → approved → sending → answered`

Reply path:

`draft → waiting_review → approved → queued → sending → sent`

Rejecting a review returns the reply to `draft` and the message to `needs_manual_check`.

## Verification target

- repository integrity;
- Ruff;
- Pyright strict;
- pytest;
- compileall;
- single Alembic head `20260710_0008`;
- frontend typecheck;
- ESLint;
- production build;
- patch/full-tree SHA-256 parity.
