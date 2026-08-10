import type { Page } from "@playwright/test";

import { fulfillMockApiJson as fulfillJson } from "./mock-api-cors";

export type OrganizationRole = "owner" | "admin" | "manager" | "viewer";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-07-12T06:00:00Z";

const account = {
  id: accountId,
  organization_id: organizationId,
  marketplace: "wildberries",
  display_name: "WB основной кабинет",
  seller_id: "seller-42",
  status: "active",
  credentials_masked: "sha256:ab12…90ef",
  credentials_status: "valid",
  scopes_json: { validated: true },
  default_response_mode: "inherit",
  last_success_sync_at: timestamp,
  last_error_sync_at: null,
  error_count: 0,
  created_at: timestamp,
  updated_at: timestamp,
};

export async function mockIntegrationsApi(
  page: Page,
  role: OrganizationRole = "owner",
) {
  await page.route("**/api/auth/me", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    return fulfillJson(route, {
      id: userId,
      email: "owner@example.com",
      name: "Owner",
      status: "active",
      is_superadmin: false,
      created_at: timestamp,
      updated_at: timestamp,
    });
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

  await page.route("**/api/marketplace-accounts**", async (route) => {
    if (route.request().method() === "OPTIONS") return fulfillJson(route, null, 204);
    const method = route.request().method();
    const url = route.request().url();
    if (url.endsWith("/validate")) {
      return fulfillJson(route, {
        id: accountId,
        status: "active",
        credentials_status: "valid",
        scopes: ["validated"],
        checked_at: timestamp,
        error_code: null,
        error_message_safe: null,
      });
    }
    if (url.endsWith("/sync")) {
      return fulfillJson(
        route,
        {
          account_id: accountId,
          marketplace: "wildberries",
          status: "success",
          imported_reviews: 4,
          imported_questions: 2,
          updated_reviews: 1,
          updated_questions: 0,
          skipped: 0,
          error_code: null,
          error_message_safe: null,
        },
        202,
      );
    }
    if (
      method === "POST" &&
      !url.includes("rotate-credentials") &&
      !url.includes("revoke-credentials")
    ) {
      return fulfillJson(route, account, 201);
    }
    if (method === "GET") return fulfillJson(route, [account]);
    return fulfillJson(route, account);
  });
}
