# Configured reply model routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Integrate all four advertised reply models through explicit server-side OpenRouter routing.

**Architecture:** A bounded OpenRouter adapter returns the same provider-neutral completion DTO as Groq. AIService selects an exact model using the current message, preserving research, credits and post-request revalidation. Activation is explicit in backend settings and effective Compose.

**Tech Stack:** Python, FastAPI, httpx, Pydantic Settings, pytest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-llm-routing.md`

## Global Constraints

- Preserve Groq defaults, approved UI and protected `.handoff/` and `apps/cms/`.
- No live paid calls, marketplace writes, local Docker, or background service resume during implementation.
- No automatic completion retry or provider/model fallback.
- Keys backend-only; do not include upstream error text in exceptions/logs.

## Review Focus

- Unsupported temperature and reasoning parameters must not break Claude/GPT requests.
- HTTP 200 with an error, missing usage, truncated output or a different model must fail closed.
- Upstream timeout must not cause a second billable call.
- A stale message or cancelled job still cannot persist a generated draft.
- Existing Groq-only installations must start and generate as before.

### Task 1: Provider contract and OpenRouter adapter

**Files:** Create `app/providers/llm.py`, `app/providers/openrouter.py`, `app/tests/test_openrouter_provider.py` under `apps/api`; adapt shared DTO imports and Groq schema access only.

**Interfaces:** `OpenRouterProvider(api_key: str, timeout_seconds: float = 45, transport: httpx.AsyncBaseTransport | None = None).complete(model: str, messages: list[dict[str,str]], temperature: float = .3, max_tokens: int = 600) -> LLMCompletion`. Expose `OpenRouterProviderError` and finite supported model IDs. Shared DTO fields unchanged.

- [x] Add and run failing MockTransport tests for four model payloads and malformed/error/timeout/cost responses.
- [x] Implement adapter and neutral DTO/schema module; preserve Groq research behavior.
- [x] Run focused provider/research tests and Ruff/Pyright for touched files.

### Task 2: Activation and service routing

**Files:** `core/config.py`, `services/ai_service.py`, new `services/llm_route_resolver.py`, new routing/service regression tests, `infra/docker/docker-compose.production.yml`, `.env.example`, `README.md`.

**Interfaces:** `select_reply_model(message_type: str, rating: int | None) -> str`; settings `ai_reply_provider`, `openrouter_api_key`, `openrouter_timeout_seconds`. AIService retains public generation signature.

Omitted API/service `max_tokens` becomes `None`, resolved to 2048 (OpenRouter) or 600 (Groq) before credit hashing. Explicit limits 120–4096 remain exact. Reject Claude limits <=1024 before research. This avoids an unusable 600-token default for mandatory reasoning while preserving an explicit caller cap.

- [x] Add failing tests for exact routing, provider validation, service provenance, credit failure/replay.
- [x] Add explicit provider activation and compose mapping; retain Groq for research.
- [x] Run relevant tests, then full API/static/integrity gates once on final tree.

### Task 3: Review, delivery and bounded live handoff

- [x] Independently review the complete diff and fix material findings.
- [x] Record source checks separately from CI/runtime/provider evidence.
- [x] Commit, push, open PR, merge and deploy API/web within existing authorization, preserving worker/scheduler pause. Delivered as PR32, main `3adf3ee0`.
- [x] Verify actual runtime source/settings and readiness. Imported module hashes matched main; API/web were healthy; the full-file Dokploy patch was updated to pass the new variables.

The owner subsequently chose to keep Groq active and defer OpenRouter activation. The optional four-model live smoke is deferred, not completed or awaiting a key. No paid/provider write or processing resume is authorized by this plan.
