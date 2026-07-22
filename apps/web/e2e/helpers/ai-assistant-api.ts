import type { Page, Route } from "@playwright/test";

export type OrganizationRole = "owner" | "admin" | "manager" | "viewer";

export const aiDraftHistoryRoutePattern = /\/api\/ai\/drafts(?:\?.*)?$/;

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const accountId = "44444444-4444-4444-8444-444444444444";
const productId = "77777777-7777-4777-8777-777777777777";
const draftId = "55555555-5555-4555-8555-555555555555";
const timestamp = "2026-07-12T06:00:00Z";

const user = {
  id: userId,
  email: "manager@example.com",
  name: "Manager",
  status: "active",
  is_superadmin: false,
  created_at: timestamp,
  updated_at: timestamp,
};

const message = {
  id: messageId,
  organization_id: organizationId,
  marketplace_account_id: accountId,
  product_id: productId,
  marketplace: "wildberries",
  external_id: "wb-review-1",
  type: "review",
  status: "needs_reply",
  rating: 2,
  customer_display_name: "Покупатель",
  customer_text: "Коробка пришла повреждённой. Что делать?",
  customer_photos_json: [],
  marketplace_created_at: timestamp,
  imported_at: timestamp,
  last_synced_at: timestamp,
  assigned_to: null,
  priority: "normal",
  metadata_json: {},
  product: {
    id: productId,
    external_id: "wb-product-1",
    sku: "SKU-1",
    name: "Термокружка",
    brand: "MPReply Test",
    category: "Посуда",
    image_url: null,
    product_url: null,
  },
  created_at: timestamp,
  updated_at: timestamp,
};

const generatedDraft = {
  id: draftId,
  organization_id: organizationId,
  message_id: messageId,
  provider: "openrouter",
  model: "openai/gpt-5.2",
  prompt_version: "marketplace-reply-v1",
  draft_text: "Сожалеем, что коробка пришла повреждённой. Пожалуйста, оформите обращение через площадку.",
  tokens_input: 320,
  tokens_output: 54,
  latency_ms: 840,
  cost_estimate: 0.0042,
  confidence_score: 0.91,
  safety_flags_json: [],
  created_by: userId,
  created_at: timestamp,
  updated_at: timestamp,
};

export async function mockAIAssistantApi(page: Page, role: OrganizationRole = "manager") {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-origin": origin,
    "content-type": "application/json",
  };

  const fulfillJson = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, headers, body: JSON.stringify(body) });

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

  await page.route("**/api/messages**", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    return fulfillJson(route, { items: [message], total: 1, page: 1, page_size: 50 });
  });

  await page.route("**/api/ai/drafts/generate", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    return fulfillJson(route, generatedDraft);
  });

  await page.route(aiDraftHistoryRoutePattern, async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    const history = role === "viewer" ? [generatedDraft] : [];
    return fulfillJson(route, { items: history, total: history.length });
  });
}
