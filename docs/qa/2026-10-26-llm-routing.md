# Reply model routing: source verification

Date: 2026-10-26. Base: `main` at `9cf258b5`.

## Implemented behavior

Explicit OpenRouter activation adds the four exact model routes described in `docs/ops/llm-routing.md`. Existing Groq installations retain their default provider and 600-token default. OpenRouter defaults to 2048 total output/reasoning tokens, keeps explicit caller limits and rejects insufficient Claude limits before research. No frontend design, dependencies or migrations changed.

The adapter sends one completion request, requires structured output support, disables redirects/provider fallback, validates returned model, finish reason, reply shape, token accounting and finite cost, and excludes upstream response/error text from exceptions. Credits, idempotency, authorization, message/job revalidation and safety decisions remain in the existing AIService flow. Generated audits preserve separate completion and research usage, including known completion cost when research cost is unknown.

## Gates on the final source tree

- Full API: **892 passed, 58 skipped**. Skips are tests requiring explicit local PostgreSQL configuration.
- Native PostgreSQL 18.6: **26 passed, 0 skipped**, covering reply credits, automatic drafts and product research. Fresh isolated database upgraded to migration `20261010_0021`; Alembic metadata check passed. Owned server stopped and loopback test port closed after the run.
- Ruff: passed across `app`.
- Strict Pyright: **0 errors, 0 warnings** across `app`.
- Repository integrity and `git diff --check`: passed.
- New tests: 58 provider contract cases, 22 routing/service cases, 8 configuration cases. Expected failures were captured before implementing routing, cap behavior and separate cost provenance.
- Independent review found one P2 (known completion cost lost under unknown aggregate research cost). The fix and regressions were reviewed again; **no remaining actionable P1/P2 findings**.

The two suite warnings come from upstream Starlette TestClient/httpx and anyio deprecations. They were not suppressed. No visual snapshot checks were run: this change contains no frontend edits.

Evidence artifacts are in the local `llm-routing-20261026` directory under the task's visualization artifact root: final API JUnit/log, PostgreSQL JUnit/log and migration checks.

## Release and provider boundaries

Before this change, the live API had a configured Groq key and no OpenRouter key. Worker/scheduler were absent from the running container inventory. The saved Dokploy command targeted only API/web with `--no-deps`.

No paid generation, research, email, marketplace send, customer-data transmission or background queue resume was executed for these source checks. The public OpenRouter catalog confirmed model IDs and parameters; it does not prove key-scoped access or successful live completions. Live activation and its bounded acceptance procedure are documented separately in the operations guide.
