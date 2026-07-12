import { describe, expect, it } from "vitest";

import { aiDraftHistoryRoutePattern } from "../../e2e/helpers/ai-assistant-api";

describe("AI Assistant E2E route contracts", () => {
  it("matches draft history requests but never shadows the generation endpoint", () => {
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts?organization_id=org-1")).toBe(true);
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts")).toBe(true);
    expect(aiDraftHistoryRoutePattern.test("http://localhost:3000/api/ai/drafts/generate")).toBe(false);
  });
});
