# Reply model activation and bounded verification

## Current operational decision — 2026-10-26

The owner chose to keep Groq active and defer OpenRouter activation. Do not request an OpenRouter key or run the four-model smoke unless the owner reopens that work. Worker/scheduler remain paused; this decision does not authorize paid Groq generation or marketplace writes. The optional OpenRouter adapter remains available in source.

## Configuration

`AI_REPLY_PROVIDER=groq` preserves existing reply generation. Groq is required for product research in either mode.

To activate OpenRouter, add a dedicated inference key as `OPENROUTER_API_KEY` in Dokploy's MPReply Environment, then set `AI_REPLY_PROVIDER=openrouter`. Set a small spending limit on that key in OpenRouter before enabling live verification. Do not paste the key into Git, terminal commands, logs or chat. `OPENROUTER_TIMEOUT_SECONDS` defaults to 45 and is bounded to 120 seconds. The official endpoint is fixed in code.

The production and local Compose files pass these variables into backend containers. A saved Environment value alone does not prove that the running API received it. Deploy API/web using the existing `--no-deps api web` command, then verify the running API settings without printing the key. Keep worker and scheduler stopped during the acceptance procedure.

| Message | Exact route |
| --- | --- |
| Review rated 1 or 2 | `anthropic/claude-sonnet-5.5` |
| Other review | `deepseek/deepseek-v4.1-flash` |
| Question | `openai/gpt-6-luna` |
| Supported buyer chat | `google/gemini-3.8-flash` |

Omitted output budgets resolve to 2048 total tokens in OpenRouter mode, including reasoning; Groq retains 600. An explicitly supplied budget is never increased. Claude requires more than 1024 total tokens; smaller explicit caps are rejected before any research request. Reasoning effort is low; neither reasoning text nor provider error bodies enter seller responses. Truncated/refused/wrong-model responses fail closed. No automatic OpenRouter completion retry or alternate model is used.

## Acceptance sequence

1. Read-only preflight: verify key presence, explicit provider selection, key permissions/balance and exact model IDs in the key-scoped catalog. Verify all four endpoints support structured output. Do not treat the public catalog as proof of access for the key.
2. Controlled synthetic provider check, after the user authorizes its concrete spending limit: one request per model, sequentially, 2048 total output tokens per request, no research/search tools, no database writes, no customer data and no marketplace API call. Stop at the first error; do not automatically rerun an ambiguous request. Use the same reply schema and adapter as the application. Record requested/returned model, status, token counts, finite cost and parsed safe reply. Do not record the key or reasoning.
3. Based on public prices inspected 2026-10-26, the output portion of four 2048-token requests is approximately $0.032 at their listed rates, plus short synthetic prompt input. This is an estimate, not a provider billing cap. A dedicated key spending limit of $0.10 protects the entire smoke. Recheck rates before approval/execution.
4. Real cabinet acceptance is separate: identify one existing unprocessed message owned by the user, capture its current status and available credits, then generate one draft with a new operation key and replay that same key to prove no second generation. Read back the actual draft, provider/model and usage ledger. Product research, if needed, is an additional Groq request and requires a separately stated spend allowance.
5. Review the exact draft before requesting permission to send it to that marketplace. Keep normal preflight, rate limits, cooldown and idempotency. Record the send receipt and provider readback; an accepted API request is not proof of buyer-visible publication. Never run the backlog to verify one message.

Source, tests, deployment and live-provider outcomes must be reported separately. Do not label all four models live-certified until all four controlled requests succeeded and their structured replies were validated.

Primary references: [model catalog](https://openrouter.ai/api/v1/models), [API contract](https://openrouter.ai/docs/api_reference/overview), [reasoning budgets](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).
