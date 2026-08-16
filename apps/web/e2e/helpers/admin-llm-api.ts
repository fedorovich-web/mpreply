import type { Page, Route } from "@playwright/test";

import { resolvePlaywrightBaseURL } from "./playwright-runtime";

const timestamp = "2026-08-16T12:00:00Z";
const userId = "22222222-2222-4222-8222-222222222222";
const organizationId = "11111111-1111-4111-8111-111111111111";

const routes = {
  review_model: "openai/review",
  negative_review_model: "anthropic/negative",
  question_model: "google/question",
  chat_model: "openai/chat",
  safety_retry_model: "anthropic/safety",
  fallback_model: "google/fallback",
};

const catalog = {
  provider: "openrouter",
  validated_at: timestamp,
  items: Object.values(routes).map((id) => ({
    id,
    name: id,
    input_modalities: ["text"],
    output_modalities: ["text"],
    context_length: 128000,
    prompt_price: "0.000001",
    completion_price: "0.000002",
    expiration_date: null,
  })),
};

type ConfigurationFixture = {
  provider: string;
  state: "active" | "disabled" | "unconfigured";
  source: "database" | "environment" | "none";
  enabled: boolean;
  credential_fingerprint_masked: string | null;
  validated_at: string | null;
  updated_at: string | null;
  routes: typeof routes;
};

export async function mockAdminLLMApi(page: Page): Promise<void> {
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type,x-csrf-token",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-origin": resolvePlaywrightBaseURL(),
    "content-type": "application/json",
  };
  const user = {
    id: userId,
    email: "admin@example.com",
    name: "Системный администратор",
    status: "active",
    is_superadmin: true,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const organization = {
    id: organizationId,
    name: "Системный кабинет",
    slug: "system",
    owner_user_id: userId,
    plan_id: null,
    default_response_mode: "auto",
    status: "active",
    current_user_role: "owner",
    created_at: timestamp,
    updated_at: timestamp,
  };
  let configuration: ConfigurationFixture = {
    provider: "openrouter",
    state: "active",
    source: "database",
    enabled: true,
    credential_fingerprint_masked: "••••••••A1B2",
    validated_at: timestamp,
    updated_at: timestamp,
    routes,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;

    if (method === "GET" && path === "/api/auth/me") return fulfillJson(route, user, headers);
    if (method === "GET" && path === "/api/organizations") return fulfillJson(route, [organization], headers);
    if (method === "GET" && path === "/api/admin/llm/openrouter") {
      return fulfillJson(route, configuration, headers);
    }
    if (method === "POST" && path === "/api/admin/llm/openrouter/validate") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      if (typeof payload.api_key !== "string" || payload.api_key.length < 16) {
        return fulfillJson(route, { detail: "Invalid synthetic key" }, headers, 400);
      }
      return fulfillJson(route, catalog, headers);
    }
    if (method === "POST" && path === "/api/admin/llm/openrouter/models/refresh") {
      return fulfillJson(route, catalog, headers);
    }
    if (method === "PUT" && path === "/api/admin/llm/openrouter") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      configuration = {
        ...configuration,
        state: "active",
        source: "database",
        enabled: true,
        routes: payload.routes as typeof routes,
      };
      return fulfillJson(route, configuration, headers);
    }
    if (method === "POST" && path === "/api/admin/llm/openrouter/disable") {
      configuration = { ...configuration, state: "disabled", enabled: false };
      return fulfillJson(route, configuration, headers);
    }
    if (method === "DELETE" && path === "/api/admin/llm/openrouter/key") {
      configuration = {
        ...configuration,
        state: "disabled",
        source: "none",
        enabled: false,
        credential_fingerprint_masked: null,
      };
      return fulfillJson(route, configuration, headers);
    }
    return fulfillJson(route, { detail: `Unexpected admin LLM test route: ${method} ${path}` }, headers, 500);
  });
}

function fulfillJson(route: Route, body: unknown, headers: Record<string, string>, status = 200) {
  return route.fulfill({ status, headers, body: JSON.stringify(body) });
}
