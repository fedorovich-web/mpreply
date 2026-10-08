# Public pricing and allowance calculation — 2026-09-27

## Status

The product owner requested **1,290 / 3,490 / 6,990 ₽** per month for **300 / 800 / 1,600 AI replies**, a 14-day trial with **350 replies**, and non-expiring unused monthly replies. Optional add-on packs now span **50 to 20,000 replies** in ten denominations, priced from **299 to 86,900 ₽**; see `PRODUCT.md` for the exact catalog. These are approved or proposed public commercial terms, **not implemented billing behavior**. Do not publish them as a working purchase or credit promise before the backend and release dependencies below are complete.

The running backend uses Groq with `qwen/qwen3.8-27b` for testing. The intended production gateway is OpenRouter, with four model families under consideration: GPT-6 Luna, Claude Sonnet 5, Gemini 3.8 Flash, and DeepSeek. The final model IDs, routing policy, reasoning settings, and number of model calls per reply have not been approved or implemented. The product owner clarified that participation of the four models will depend on the scenario. The current public homepage says `GPT-5.6`, `Claude Sonnet 5`, `Gemini 3.8`, and `DeepSeek V4.1 Flash`; its OpenAI label does not match the newly stated GPT-6 Luna candidate. Exact model marketing claims require deployment verification under `PRODUCT.md`.

## OpenRouter catalogue check

OpenRouter listed these model IDs and **displayed input/output prices per million tokens** on 2026-09-27. Catalogue and provider-specific rates can change, so use the actual routed provider price when finalizing margins.

| Candidate | OpenRouter model ID | Input USD / 1M | Output USD / 1M | Source |
| --- | --- | ---: | ---: | --- |
| GPT-6 Luna | `openai/gpt-6-luna` | 0.10 | 0.50 | <https://openrouter.ai/openai/gpt-6-luna> |
| Claude Sonnet 5 | `anthropic/claude-sonnet-5` | 2.00 | 10.00 | <https://openrouter.ai/anthropic/claude-sonnet-5> |
| Gemini 3.8 Flash | `google/gemini-3.8-flash` | 0.75 | 3.75 | <https://openrouter.ai/google/gemini-3.8-flash> |
| DeepSeek V4.1 Flash | `deepseek/deepseek-v4.1-flash` | 0.035 | 0.29 | <https://openrouter.ai/deepseek/deepseek-v4.1-flash> |

DeepSeek V4.1 Flash is a current candidate, not a finding that it is the best model for Russian marketplace replies. DeepSeek V4 Pro 0813 also exists at `deepseek/deepseek-v4-pro-0813`; compare reply quality and the provider actually routed before choosing between them: <https://openrouter.ai/deepseek/deepseek-v4-pro-0813>. Avoid mutable `latest` aliases in a fixed-price calculation.

## Inference cost scenarios

Assume **1,500 input + 250 output tokens** per model invocation in the base scenario; **3,000 input + 600 output** in the stress scenario. These are unmeasured assumptions, not observed MPReply traffic. Output must include billable reasoning tokens where the chosen provider reports them. Use the Bank of Russia rate **84.3414 ₽/$** used in the prior draft (<https://cbr.ru/eng/currency_base/daily/>), and add an illustrative **5.5% Standard credit-purchase fee** from <https://openrouter.ai/pricing/>. OpenRouter says inference itself has no markup, while credit purchases have a fee: <https://openrouter.ai/support/>. The fee is modelled as a simple 1.055 multiplier; actual credit purchases and taxes can differ.

`RUB per invocation = (input_tokens × input_USD_per_M + output_tokens × output_USD_per_M) / 1,000,000 × 84.3414 × 1.055`.

| Candidate | Base ₽ / invocation | Stress ₽ / invocation | Base cost for 300 / 800 / 1,600 replies | Stress cost for 300 / 800 / 1,600 replies |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 0.0245 | 0.0534 | 7 / 20 / 39 ₽ | 16 / 43 / 85 ₽ |
| Claude Sonnet 5 | 0.4894 | 1.0678 | 147 / 392 / 783 ₽ | 320 / 854 / 1,708 ₽ |
| Gemini 3.8 Flash | 0.1835 | 0.4004 | 55 / 147 / 294 ₽ | 120 / 320 / 641 ₽ |
| DeepSeek V4.1 Flash | 0.0111 | 0.0248 | 3 / 9 / 18 ₽ | 7 / 20 / 40 ₽ |

The actual policy is **scenario-dependent**. If one model creates a reply, the per-reply cost depends on the eventual mix and routing policy. At the stated token assumptions, an all-Sonnet stress case costs about **1,708 ₽** for 1,600 Business replies. If all four models are invoked for every reply, their costs add: approximately **0.7085 ₽ base** or **1.5464 ₽ stress** per reply. For 300 / 800 / 1,600 replies this is **213 / 567 / 1,134 ₽ base** or **464 / 1,237 / 2,474 ₽ stress**. These stress costs take about **36.0% / 35.4% / 35.4%** of monthly tariff revenue, or **45.0% / 44.3% / 44.2%** after the advertised 20% annual-payment discount. The trial's 350 replies cost about **541 ₽** in the same four-model stress case and are a separate acquisition expense. This example assumes the same input token count for each call; passing previous model outputs to later calls would increase usage. One final reply consumes one customer credit even if several models are called internally.

At full use of monthly grants, revenue is **4.30 / 4.36 / 4.37 ₽ per granted reply** for Start / Team / Business before all costs. Add-on revenue ranges from **5.98 ₽** per reply for the 50-pack to **4.345 ₽** for the 20,000-pack. At the illustrative four-model stress cost of **1.5464 ₽** per reply, model cost consumes about **25.9–35.6%** of add-on revenue. These figures leave room above the model-cost scenarios, but **net profitability is unverified** until scenario frequencies, failed calls, token distributions, payment costs, taxes, infrastructure, support, conversion from the 350-reply trial, and carried-balance obligations are measured.

The estimates exclude taxes, payment fees, infrastructure, support, failed/duplicate requests, prompt growth, exchange-rate movement, routed-provider price changes, and obligations from non-expiring carried balances. Actual MPReply `AIDraft` rows record input and output tokens for successful Groq calls, but those measurements would not establish OpenRouter model usage without a production-model evaluation. No provider calls were made for this estimate.

## Competitor context

- [Owl Reviews](https://owl-reviews.ru/tarrif/): 499 ₽ monthly for 300 review replies plus 10 question replies; 1,299 ₽ for 1,000 plus 20; 2,199 ₽ for 2,000 plus 30. It also offers non-expiring pay-as-you-go credits.
- [Otveto](https://otveto.ru/prices/): purchased credits do not expire; published volume pricing ranges from 5.98 ₽ to 0.5 ₽ per answer.
- [Comenta](https://www.comenta-ai.ru/): monthly tiers start at 8,000 ₽ for up to 3,000 generations, with differing service and onboarding.
- [Spix](https://spix.ru/tarify/): 5,200 ₽ monthly for 500 answer tokens; 13,000 ₽ for 2,000.

These are different bundles. Do not claim a tenfold advantage over all competitors or treat equal reply counts as equal service.

## Release dependency

`apps/api/app/services/plan_limit_service.py` counts `ai_drafts_monthly` and `replies_sent_monthly` inside a billing period. It has no durable grant/consumption ledger or carried balance. Migration `20260710_0009_analytics_billing_foundation.py` seeds Start, Growth, Team, and Agency with **NULL monthly prices and empty limit objects**, rather than the public Start, Team, and Business commercial matrix. `BillingService.overview` reports `pricing_finalized` from the presence of a seeded price; it cannot certify the public tariff. The subscription schema has a `trial_ends_at` field, but that field alone does not verify the advertised trial activation or expiration behavior.

Before publishing the promise, define what counts as one credit (including regeneration, multi-model scenarios, and failed generations), implement durable grants and idempotent consumption, handle plan changes and cancellation, expose the balance in customer billing UI, align plan seeds, and verify the release with measured token usage across the selected models. The plan-specific user counts, marketplace counts, support tiers, SLA, and dedicated-manager claims also need a matching product contract and release verification. The approved pricing render says Team can connect up to five marketplaces and Business can connect any marketplace, while the current product UI supports four named integrations; clarify those capacity claims before release. The homepage's `до 70%` time-saving metric likewise needs measurement before it can be published as fact. Payment-provider wiring remains a separate launch-stage task under `AGENTS.md`.

The transaction, idempotency, and entitlement requirements are detailed in [AI reply credit contract](ai-reply-credit-contract-2026-09-27.md). That contract is a draft; it does not authorize automatic grants from the current default `active` subscription.
