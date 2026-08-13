import { expect, test, type Route } from "@playwright/test";

import { resolvePlaywrightBaseURL } from "./helpers/playwright-runtime";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-08-13T06:00:00Z";

test("owner can open the new customer-management workspaces", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-origin": resolvePlaywrightBaseURL(),
    "content-type": "application/json",
  };
  const fulfill = (route: Route, body: unknown) => route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
  const organization = { id: organizationId, name: "Seller Group", slug: "seller-group", owner_user_id: userId, plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner", created_at: timestamp, updated_at: timestamp };
  const instructionSet = { id: "33333333-3333-4333-8333-333333333333", organization_id: organizationId, name: "Основной стиль", response_tone: "friendly", brand_rules: "Обращаться на Вы.", reply_signature: null, prohibited_phrases: [], status: "active", is_default: true, created_by: null, updated_by: null, created_at: timestamp, updated_at: timestamp };
  const account = { id: "44444444-4444-4444-8444-444444444444", organization_id: organizationId, marketplace: "wildberries", display_name: "Основной WB", seller_id: null, status: "active", credentials_masked: "***1234", credentials_status: "valid", scopes_json: {}, default_response_mode: "auto", ai_instruction_set_id: instructionSet.id, last_success_sync_at: timestamp, last_error_sync_at: null, error_count: 0, created_at: timestamp, updated_at: timestamp };

  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return fulfill(route, { id: userId, email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: timestamp, updated_at: timestamp });
    if (path === "/api/organizations") return fulfill(route, [organization]);
    if (path === `/api/organizations/${organizationId}`) return fulfill(route, organization);
    if (path.endsWith("/instruction-sets")) return fulfill(route, [instructionSet]);
    if (path === "/api/marketplace-accounts") return fulfill(route, [account]);
    if (path.endsWith("/knowledge-entries")) return fulfill(route, [{ id: "55555555-5555-4555-8555-555555555555", organization_id: organizationId, marketplace_account_id: null, product_id: null, category: "delivery", title: "Сроки доставки", content: "Срок зависит от региона покупателя.", status: "active", created_by: null, updated_by: null, created_at: timestamp, updated_at: timestamp }]);
    if (path.endsWith("/members")) return fulfill(route, [{ membership_id: "66666666-6666-4666-8666-666666666666", user_id: userId, email: "owner@example.com", name: "Owner", role: "owner", status: "active", created_at: timestamp, updated_at: timestamp }]);
    if (path.endsWith("/invitations")) return fulfill(route, []);
    if (path === "/api/audit-logs") return fulfill(route, { items: [], next_cursor: null, has_more: false, limit: 50 });
    return fulfill(route, { detail: "Unexpected test route" });
  });

  await page.goto("/app/instruction-sets", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Основной стиль" })).toBeVisible();
  await page.goto("/app/knowledge-base", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Сроки доставки" })).toBeVisible();
  await page.goto("/app/team", { waitUntil: "networkidle" });
  await expect(page.getByRole("article").getByText("owner@example.com")).toBeVisible();
  await page.goto("/app/settings", { waitUntil: "networkidle" });
  await expect(page.getByLabel("Название организации")).toHaveValue("Seller Group");
  await page.goto("/app/audit-log", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Действий пока нет" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/instruction-sets", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Основной стиль" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
