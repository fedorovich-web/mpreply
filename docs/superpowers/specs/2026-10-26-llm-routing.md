# Configured reply model routing

## Outcome and scope

Connect the four models named on the approved homepage to the existing reply generation pipeline. Do not change the seller UI, product research, credit reservation, tenant authorization, review gates or background-processing pause. Preserve Groq as the default for installations that have not explicitly activated OpenRouter.

## Design decisions

Use OpenRouter's existing chat-completions protocol via httpx, with no new dependencies or database migration. Activation is explicit through `AI_REPLY_PROVIDER=groq|openrouter`; OpenRouter requires a non-placeholder backend-only `OPENROUTER_API_KEY`. There is no automatic provider/model fallback. A failed or ambiguous completion is not retried by this adapter.

Route positive/ordinary reviews to `deepseek/deepseek-v4.1-flash`, reviews rated 1–2 to `anthropic/claude-sonnet-5.5`, questions to `openai/gpt-6-luna`, and supported buyer chats to `google/gemini-3.8-flash`. Keep this finite mapping in code, with explicit configuration selecting the provider rather than arbitrary endpoint/model configuration. Unknown message types fail closed. The mapping is an implementation decision, not a claim of comparative model quality.

Use strict structured output with the existing reply schema. Do not send temperature to models that do not support it. Bound all output including reasoning by the requested token limit; request low reasoning effort and exclude reasoning text from output. Reject incomplete, refused, malformed or wrong-model completions. Use authenticated official HTTPS endpoint only, with redirects disabled. Never log API keys or upstream response text.

When `max_tokens` is omitted, resolve it before the credit request hash to 600 for Groq and 2048 for OpenRouter. Explicit limits remain exact (120–4096). Claude's mandatory reasoning requires more than 1024 total tokens; reject smaller explicit limits before research or completion, without silently increasing them. Public catalog reasoning metadata inspected on 2026-10-26 confirms mandatory reasoning for Claude/Gemini and low effort support for all four models. No real provider acceptance is inferred from that metadata.

Move provider-neutral completion/usage DTOs and reply schema to a small neutral module. Keep Groq-specific research and parsing behavior intact. Record actual completion provider/model, token usage, latency and finite nonnegative cost in the current draft/usage/audit flow. Product research continues through Groq and remains separately labelled in audit metadata.

## Acceptance

MockTransport tests prove all four exact requests, schema support, token bounds, one-attempt behavior, response validation, costs and safe error messages. Service tests prove routing and actual draft/audit provenance, idempotent replay and credit release on failure. Existing Groq, automatic-draft and research regressions remain green. No real generation, email, marketplace send or worker restart is part of local verification.

Deployment includes effective Compose environment passthrough. Completion of source integration and deployment is distinct from live model certification. Prepare a synthetic one-request-per-model smoke with a concrete cost/token cap before any paid call; keep worker and scheduler off. A marketplace send requires a separately identified message and user-approved reply.

## Primary protocol evidence

Public catalog inspected 2026-10-26: https://openrouter.ai/api/v1/models
API contract: https://openrouter.ai/docs/api_reference/overview
Parameter enforcement: https://openrouter.ai/docs/guides/routing/provider-selection
