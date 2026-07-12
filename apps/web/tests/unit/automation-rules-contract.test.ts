import { describe, expect, it } from "vitest";

import { createAutomationRulesMockState } from "../../e2e/helpers/automation-rules-api";
import {
  automationRuleListSchema,
  organizationSchema,
} from "../../lib/api/schemas";

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "admin",
  created_at: "2026-07-12T06:00:00Z",
  updated_at: "2026-07-12T06:00:00Z",
};

const rule = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: null,
  name: "Негативные отзывы",
  priority: 500,
  is_enabled: true,
  mode: "semi_auto",
  applies_to: "review",
  marketplace: "wildberries",
  min_rating: 1,
  max_rating: 3,
  product_ids: [],
  category_ids: [],
  include_keywords: ["качество"],
  exclude_keywords: [],
  sensitive_topics: ["возврат"],
  daily_limit: 100,
  hourly_limit: 20,
  require_manual_review_on_flags: true,
  stop_on_missing_product_context: true,
  stop_on_low_confidence: true,
  confidence_threshold: 0.82,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-12T06:00:00Z",
  updated_at: "2026-07-12T06:00:00Z",
};

describe("Automation Rules API contracts", () => {
  it("parses the current organization membership role and automation-rule list", () => {
    expect(organizationSchema.parse(organization).current_user_role).toBe("admin");
    expect(automationRuleListSchema.parse({ items: [rule], total: 1 }).items[0]?.name).toBe(
      "Негативные отзывы",
    );
  });

  it("keeps a newly created rule in the E2E mock list after the POST response", () => {
    const state = createAutomationRulesMockState();

    const createdRule = state.create({
      organization_id: organization.id,
      name: "Отзывы 1–3",
    });

    expect(createdRule.name).toBe("Отзывы 1–3");
    expect(state.list()).toMatchObject({
      total: 2,
      items: expect.arrayContaining([
        expect.objectContaining({ id: createdRule.id, name: "Отзывы 1–3" }),
      ]),
    });
  });

  it("rejects unknown organization roles and unsupported marketplaces", () => {
    expect(organizationSchema.safeParse({ ...organization, current_user_role: "editor" }).success).toBe(false);
    expect(
      automationRuleListSchema.safeParse({
        items: [{ ...rule, marketplace: "megamarket" }],
        total: 1,
      }).success,
    ).toBe(false);
  });
});
