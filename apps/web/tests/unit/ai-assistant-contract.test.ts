import { describe, expect, it } from "vitest";

import { aiDraftListSchema, aiDraftSchema } from "../../lib/api/schemas";

const draft = {
  id: "55555555-5555-4555-8555-555555555555",
  organization_id: "11111111-1111-4111-8111-111111111111",
  message_id: "33333333-3333-4333-8333-333333333333",
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  prompt_version: "marketplace-reply-v1",
  draft_text: "Спасибо за отзыв. Проверим ситуацию и вернёмся с точным ответом.",
  tokens_input: 320,
  tokens_output: 54,
  latency_ms: 840,
  cost_estimate: 0.0042,
  confidence_score: 0.91,
  safety_flags_json: [],
  created_by: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-07-12T06:00:00Z",
  updated_at: "2026-07-12T06:00:00Z",
};

describe("AI Assistant API contracts", () => {
  it("parses generated drafts and draft history", () => {
    expect(aiDraftSchema.parse(draft).confidence_score).toBe(0.91);
    expect(aiDraftListSchema.parse({ items: [draft], total: 1 }).items[0]?.provider).toBe("groq");
  });

  it("rejects invalid confidence and empty draft text", () => {
    expect(aiDraftSchema.safeParse({ ...draft, confidence_score: 1.4 }).success).toBe(false);
    expect(aiDraftSchema.safeParse({ ...draft, draft_text: "" }).success).toBe(false);
  });
});
