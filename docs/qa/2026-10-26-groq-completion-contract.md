# Groq completion contract and automatic regeneration

Date: 2026-10-26. Base: `main` at `3adf3ee0`.

## Confirmed defects and changes

The Groq reply and product-research parsers accepted HTTP 200 envelopes without checking completion status, refusal, pending tool calls or embedded errors. An otherwise valid reply JSON could therefore be saved and consume an MPReply credit after a truncated/refused completion. A shared completed-message gate now requires one assistant choice, `finish_reason=stop`, and no refusal, pending client tool/function call or explicit error. Completed server `executed_tools` remain available for product research. Provider error messages exclude upstream body details.

The automatic-draft service previously retried all HTTP 502 failures. Known Groq response-contract errors now finish the owned job as failed, release its lease, preserve the diagnostic code and route the pending message to manual checking through the existing finish path. They do not automatically regenerate. Other retry behavior is unchanged. The owner can still explicitly request a new generation after reviewing the failure.

Removed `ai_daily_cost_limit_default` and its example environment variable. Repository-wide usage checks found only their own declarations; no runtime/dynamic consumer or implemented cost gate used them. MPReply reply credits and actual provider-side spending controls remain the implemented safeguards; the deleted setting did not enforce a dollar budget.

## Verification

- 26 provider cases initially demonstrated incorrect acceptance for reply and research envelopes before the guard.
- Three service cases exercise the actual Groq adapter with MockTransport and a real SQLite credit flow: HTTP 502, restored balance, no draft, unchanged manual message status and an error audit. The prior acceptance behavior was reproduced in a separate process using the legacy message-extraction semantics.
- Four automatic-job regressions first failed because the job remained pending. They now prove one provider request, terminal failed job, manual-check message status, cleared lease, restored credits, no draft/reply, no future claim and no rediscovery.
- Full API suite: **925 passed, 58 skipped** (PostgreSQL-dependent tests). A final added manual-check status assertion was exercised by the four targeted cases after the full suite.
- Ruff across `app`: passed. Strict Pyright across `app`: **0 errors, 0 warnings**.
- Repository integrity and diff whitespace checks passed. No frontend, dependency, schema or migration changes.
- Independent review covered provider compatibility, credit release, automatic retries and ownership. No remaining actionable P1/P2 findings. Current Groq API/SDK require one assistant choice and expose completion status; server search results are distinct from pending client tool calls.

The two full-suite warnings are upstream TestClient/httpx and anyio deprecations; none were suppressed. Evidence logs/JUnit are saved in the local task artifact directory `groq-contract-20261026`.

## Release boundaries

Before delivery, Dokploy autodeploy was off; only API/web were running and healthy. The saved command targeted `--no-deps api web`. The owner explicitly chose to retain Groq and defer OpenRouter activation; the prior routing plan and operations guide now record that decision.

These checks made no real generation, product-research, email, marketplace write or payment calls. No worker/scheduler resume or backlog processing is authorized by this change. Production deployment and a pure synthetic runtime parser probe are recorded separately from external-provider acceptance.

Primary protocol references: [Groq API](https://console.groq.com/docs/api-reference), [official completion types](https://github.com/groq/groq-python/blob/main/src/groq/types/chat/chat_completion.py), [browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search).
