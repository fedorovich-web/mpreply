# ADR-0001: Architecture baseline

## Status

Accepted.

## Context

Respio must be a production-grade multi-tenant SaaS for marketplace sellers. It must support auto-first replies to reviews and questions, while allowing semi-automatic approval mode. Customers connect their marketplace accounts through official or allowed API integrations.

## Decisions

1. Default response mode is `auto`.
2. `semi_auto` is an explicit user-selectable alternative.
3. Marketplace credentials are backend-only and encrypted at rest.
4. Groq is called only from the backend through a provider abstraction; the pinned MVP model is `qwen/qwen3.8-27b`.
5. Wildberries is the first MVP marketplace adapter.
6. Frontend uses CSS variables/design tokens from the first implementation step.
7. Backend starts on FastAPI.
8. Frontend starts on Next.js + TypeScript.
9. Deployment target is Docker Compose + Dokploy.
10. No production image may use floating `latest` tags.

## Consequences

- Auto-reply requires AutomationRulesEngine, SafetyGate, audit logs and usage tracking.
- Marketplace adapters must be isolated behind a common contract.
- Secrets must never be returned to client-side code.
- All UI components must consume semantic tokens, not hardcoded visual values.
