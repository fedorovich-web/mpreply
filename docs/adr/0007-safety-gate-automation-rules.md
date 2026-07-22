# ADR-0007: SafetyGate and Automation Rules Engine

Status: accepted for Sprint 6 foundation.

## Decision

MPReply remains auto-first. Organization-level `default_response_mode=auto` is the baseline. A marketplace account may override that mode. Enabled automation rules are evaluated by descending priority and can switch a matching message to `auto` or `semi_auto`.

Every AI-generated draft must pass a deterministic SafetyGate before it becomes eligible for future auto-send.

SafetyGate decisions:

- `allow` — draft can continue to the auto-send pipeline;
- `manual_review` — draft moves to `needs_manual_check`;
- `block` — draft moves to `safety_blocked`.

## Rule precedence

1. Organization default mode.
2. Marketplace account override when not `inherit`.
3. Highest-priority enabled matching rule.
4. Missing product context / low confidence / sensitive-topic checks.
5. SafetyGate after generation.
6. Marketplace policy checks before future send operation.

## Security and tenant isolation

Rules are organization-scoped. Read access requires active organization membership. Create, update and disable actions require `owner` or `admin`. Cross-tenant marketplace account references are rejected.

## Current limitation

Hourly and daily limits are represented in rule configuration and evaluation output, but runtime counters are intentionally deferred to the auto-reply workflow sprint. The engine returns `requires_limit_check=true` instead of pretending quotas were enforced.
