import type { Page, Route } from "@playwright/test";

import { resolvePlaywrightBaseURL } from "./playwright-runtime";

export type ClientWorkspaceRole = "owner" | "viewer";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const instructionSetId = "33333333-3333-4333-8333-333333333333";
const accountId = "44444444-4444-4444-8444-444444444444";
const ozonAccountId = "88888888-8888-4888-8888-888888888888";
const avitoAccountId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const createdAvitoAccountId = "34343434-3434-4434-8434-343434343434";
const timestamp = "2026-08-13T06:00:00Z";
const period = { start: "2026-07-15T00:00:00Z", end: "2026-08-13T23:59:59Z", days: 30 };

const userFixture = {
  id: userId,
  email: "owner@example.com",
  name: "Владелец",
  status: "active",
  is_superadmin: false,
  created_at: timestamp,
  updated_at: timestamp,
};

const instructionSetFixture = {
  id: instructionSetId,
  organization_id: organizationId,
  name: "Основной стиль",
  response_tone: "friendly",
  brand_rules: "Обращаться на Вы и отвечать по существу.",
  reply_signature: null,
  prohibited_phrases: [],
  status: "active",
  is_default: true,
  created_by: null,
  updated_by: null,
  created_at: timestamp,
  updated_at: timestamp,
};

const accountFixture = {
  id: accountId,
  organization_id: organizationId,
  marketplace: "wildberries",
  display_name: "Основной Wildberries",
  seller_id: null,
  status: "active",
  credentials_masked: "***1234",
  credentials_status: "valid",
  scopes_json: {},
  default_response_mode: "auto",
  ai_instruction_set_id: instructionSetId,
  last_success_sync_at: timestamp,
  last_error_sync_at: null,
  error_count: 0,
  created_at: timestamp,
  updated_at: timestamp,
};

const ozonAccountFixture = {
  id: ozonAccountId,
  organization_id: organizationId,
  marketplace: "ozon",
  display_name: "Основной Ozon",
  seller_id: null,
  status: "active",
  credentials_masked: "sha256:ozon…safe",
  credentials_status: "valid",
  scopes_json: {
    validated: true,
    checked_at: timestamp,
    scopes: ["fetch_reviews", "send_review_reply", "fetch_questions", "send_question_reply"],
    expires_at: "2026-12-01T00:00:00Z",
  },
  default_response_mode: "auto",
  ai_instruction_set_id: instructionSetId,
  last_success_sync_at: timestamp,
  last_error_sync_at: "2026-08-13T07:00:00Z",
  error_count: 1,
  created_at: timestamp,
  updated_at: timestamp,
};

const ozonOverviewFixture = {
  account: ozonAccountFixture,
  health_status: "error",
  health_reasons: ["Последняя ручная синхронизация завершилась ошибкой."],
  scopes: ["fetch_reviews", "send_review_reply", "fetch_questions", "send_question_reply"],
  sync_states: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      marketplace_account_id: ozonAccountId,
      stream: "reviews",
      status: "error",
      next_run_at: "2026-08-13T08:00:00Z",
      last_attempt_at: "2026-08-13T07:00:00Z",
      last_success_at: timestamp,
      last_error_at: "2026-08-13T07:00:00Z",
      last_cycle_completed_at: timestamp,
      consecutive_failures: 1,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      marketplace_account_id: ozonAccountId,
      stream: "questions",
      status: "idle",
      next_run_at: "2026-08-13T08:05:00Z",
      last_attempt_at: timestamp,
      last_success_at: timestamp,
      last_error_at: null,
      last_cycle_completed_at: timestamp,
      consecutive_failures: 0,
    },
  ],
  recent_jobs: [{
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    job_type: "manual_sync",
    status: "failed",
    started_at: "2026-08-13T07:00:00Z",
    finished_at: "2026-08-13T07:01:00Z",
    error_message_safe: "Не удалось завершить синхронизацию Ozon.",
    stats: { imported_reviews: 2, skipped: 1 },
    created_at: "2026-08-13T07:00:00Z",
  }],
  recent_events: [{
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    event_type: "sync.feedbacks",
    status: "failed",
    error_code: "rate_limited",
    error_message_safe: "Ozon Seller API rate limit exceeded",
    details: { pages_processed: 2 },
    created_at: "2026-08-13T07:01:00Z",
  }],
};

const avitoAccountFixture = {
  id: avitoAccountId,
  organization_id: organizationId,
  marketplace: "avito",
  display_name: "Основной Авито",
  seller_id: null,
  status: "active",
  credentials_masked: "sha256:avito…safe",
  credentials_status: "valid",
  scopes_json: {
    validated: true,
    checked_at: timestamp,
    scopes: ["fetch_chats"],
    authentication: "client_credentials",
  },
  default_response_mode: "auto",
  ai_instruction_set_id: instructionSetId,
  last_success_sync_at: timestamp,
  last_error_sync_at: "2026-08-13T07:00:00Z",
  error_count: 1,
  created_at: timestamp,
  updated_at: timestamp,
};

const avitoOverviewFixture = {
  account: avitoAccountFixture,
  health_status: "error",
  health_reasons: ["Последняя синхронизация чатов завершилась ошибкой."],
  scopes: ["fetch_chats"],
  sync_states: [{
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    marketplace_account_id: avitoAccountId,
    stream: "chats",
    status: "error",
    next_run_at: "2026-08-13T08:00:00Z",
    last_attempt_at: "2026-08-13T07:00:00Z",
    last_success_at: timestamp,
    last_error_at: "2026-08-13T07:00:00Z",
    last_cycle_completed_at: timestamp,
    consecutive_failures: 1,
  }],
  recent_jobs: [{
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    job_type: "manual_sync",
    status: "failed",
    started_at: "2026-08-13T07:00:00Z",
    finished_at: "2026-08-13T07:01:00Z",
    error_message_safe: "Не удалось завершить синхронизацию чатов.",
    stats: { imported_chats: 2 },
    created_at: "2026-08-13T07:00:00Z",
  }],
  recent_events: [{
    id: "12121212-1212-4212-8212-121212121212",
    event_type: "sync.chats",
    status: "failed",
    error_code: "rate_limited",
    error_message_safe: "must-not-render-avito-provider-error",
    details: {
      pages_processed: 2,
      provider_body: "must-not-render-avito-provider-body",
      client_id: "must-not-render-avito-client-id",
      seller_id: "must-not-render-avito-user-id",
    },
    created_at: "2026-08-13T07:01:00Z",
  }],
};

const analyticsFixture = {
  period,
  total_messages: 1842,
  new_messages: 46,
  unanswered_messages: 18,
  answered_messages: 1778,
  negative_reviews: 31,
  replies_sent: 1760,
  auto_replies_sent: 1504,
  manual_replies_sent: 256,
  ai_drafts_generated: 1690,
  average_response_seconds: 248,
  ai_acceptance_rate: 0.91,
};

const billingFixture = {
  organization_id: organizationId,
  plan: {
    id: "77777777-7777-4777-8777-777777777777",
    code: "demo",
    name: "Демонстрационный",
    price_month_minor: null,
    currency: "RUB",
    limits_json: {},
    features_json: {},
    is_active: true,
    is_default: true,
  },
  subscription: null,
  usage_period_start: "2026-08-01T00:00:00Z",
  usage_period_end: "2026-09-01T00:00:00Z",
  usage: [
    { metric: "replies_sent_monthly", used: 1760, limit: 5000, remaining: 3240, allowed: true },
    { metric: "marketplace_accounts", used: 1, limit: 3, remaining: 2, allowed: true },
  ],
  pricing_finalized: false,
};

export async function mockClientWorkspaceApi(
  page: Page,
  role: ClientWorkspaceRole = "owner",
  options: { includeOzon?: boolean; includeAvito?: boolean; enableAvitoMutations?: boolean } = {},
): Promise<void> {
  const headers = {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-origin": resolvePlaywrightBaseURL(),
    "content-type": "application/json",
  };
  const organization = {
    id: organizationId,
    name: "Демо-магазин",
    slug: "demo-store",
    owner_user_id: userId,
    plan_id: null,
    default_response_mode: "auto",
    status: "active",
    current_user_role: role,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const marketplaceAccounts = [
    accountFixture,
    ...(options.includeOzon ? [ozonAccountFixture] : []),
    ...(options.includeAvito ? [avitoAccountFixture] : []),
  ];
  let createdAvitoAccount: Record<string, unknown> | null = null;
  const exactResponses = new Map<string, unknown>([
    ["/api/auth/me", userFixture],
    ["/api/organizations", [organization]],
    [`/api/organizations/${organizationId}`, organization],
    ["/api/marketplace-accounts", marketplaceAccounts],
    [`/api/marketplace-accounts/${ozonAccountId}/overview`, ozonOverviewFixture],
    [`/api/marketplace-accounts/${avitoAccountId}/overview`, avitoOverviewFixture],
    ["/api/messages", { items: [], total: 0, page: 1, page_size: 100 }],
    ["/api/dashboard/attention", {
      organization_id: organizationId,
      items: [{ key: "needs_reply", title: "Отзывы и вопросы без ответа", count: 18, href: "/app/inbox?status=needs_reply", severity: "info" }],
      integration_issues: 0,
    }],
    ["/api/analytics/overview", analyticsFixture],
    ["/api/billing/overview", billingFixture],
    ["/api/audit-logs", { items: [], next_cursor: null, has_more: false, limit: 50 }],
  ]);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    if (method !== "GET") {
      if (options.enableAvitoMutations && method === "POST" && path === "/api/marketplace-accounts") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        if (payload.marketplace === "avito") {
          createdAvitoAccount = {
            ...avitoAccountFixture,
            id: createdAvitoAccountId,
            display_name: String(payload.display_name),
            status: "pending_validation",
            credentials_status: "pending_validation",
            scopes_json: {},
            default_response_mode: String(payload.default_response_mode),
            last_success_sync_at: null,
            last_error_sync_at: null,
            error_count: 0,
          };
          return fulfillJson(route, createdAvitoAccount, headers, 201);
        }
      }
      return fulfillJson(route, { detail: "Unexpected client-workspace test mutation" }, headers, 500);
    }
    const body = path === "/api/marketplace-accounts"
      ? [...marketplaceAccounts, ...(createdAvitoAccount ? [createdAvitoAccount] : [])]
      : path === `/api/marketplace-accounts/${createdAvitoAccountId}/overview` && createdAvitoAccount
        ? {
            account: createdAvitoAccount,
            health_status: "attention",
            health_reasons: ["Подключение ожидает проверки."],
            scopes: [],
            sync_states: [],
            recent_jobs: [],
            recent_events: [],
          }
        : exactResponses.get(path)
      ?? (path.endsWith("/instruction-sets") ? [instructionSetFixture] : undefined)
      ?? (path.endsWith("/knowledge-entries") ? [{
        id: "55555555-5555-4555-8555-555555555555",
        organization_id: organizationId,
        marketplace_account_id: null,
        product_id: null,
        category: "delivery",
        title: "Сроки доставки",
        content: "Срок зависит от региона покупателя.",
        status: "active",
        created_by: null,
        updated_by: null,
        created_at: timestamp,
        updated_at: timestamp,
      }] : undefined)
      ?? (path.endsWith("/members") ? [{ membership_id: "66666666-6666-4666-8666-666666666666", user_id: userId, email: "owner@example.com", name: "Владелец", role: "owner", status: "active", created_at: timestamp, updated_at: timestamp }] : undefined)
      ?? (path.endsWith("/invitations") ? [] : undefined);
    if (body === undefined) return fulfillJson(route, { detail: "Unexpected client-workspace test route" }, headers, 500);
    return fulfillJson(route, body, headers);
  });
}

function fulfillJson(route: Route, body: unknown, headers: Record<string, string>, status = 200) {
  return route.fulfill({ status, headers, body: JSON.stringify(body) });
}
