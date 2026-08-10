import type { Page } from "@playwright/test";

import { fulfillMockApiJson as fulfillJson } from "./mock-api-cors";

export type OrganizationRole = "owner" | "admin" | "manager" | "viewer";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const ruleId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-07-12T06:00:00Z";

const user = {
  id: userId,
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  is_superadmin: false,
  created_at: timestamp,
  updated_at: timestamp,
};

const baseRule = {
  id: ruleId,
  organization_id: organizationId,
  marketplace_account_id: null,
  name: "Balanced auto",
  priority: 100,
  is_enabled: true,
  mode: "auto",
  applies_to: "all",
  marketplace: null,
  min_rating: null,
  max_rating: null,
  product_ids: [],
  category_ids: [],
  include_keywords: [],
  exclude_keywords: [],
  sensitive_topics: [],
  daily_limit: null,
  hourly_limit: null,
  require_manual_review_on_flags: true,
  stop_on_missing_product_context: true,
  stop_on_low_confidence: true,
  confidence_threshold: 0.8,
  created_by: userId,
  updated_by: userId,
  created_at: timestamp,
  updated_at: timestamp,
};

export function createAutomationRulesMockState() {
  let rules = [baseRule];

  return {
    create(payload: Record<string, unknown>) {
      const createdRule = {
        ...baseRule,
        ...payload,
        id: "44444444-4444-4444-8444-444444444444",
      };
      rules = [...rules, createdRule];
      return createdRule;
    },
    list() {
      return { items: rules, total: rules.length };
    },
  };
}

export async function mockAutomationRulesApi(
  page: Page,
  role: OrganizationRole = "owner",
) {
  const state = createAutomationRulesMockState();

  await page.route("**/api/auth/me", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    return fulfillJson(route, user);
  });

  await page.route("**/api/organizations", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    return fulfillJson(route, [
      {
        id: organizationId,
        name: "Seller Group",
        slug: "seller-group",
        owner_user_id: userId,
        plan_id: null,
        default_response_mode: "auto",
        status: "active",
        current_user_role: role,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);
  });

  await page.route("**/api/automation-rules**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return fulfillJson(route, null, 204);
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      return fulfillJson(route, state.create(payload), 201);
    }
    return fulfillJson(route, state.list());
  });
}
