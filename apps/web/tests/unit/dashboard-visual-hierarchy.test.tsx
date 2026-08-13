import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "../../app/app/dashboard/page";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Основной кабинет",
  slug: "main",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: "2026-08-13T08:00:00Z",
  updated_at: "2026-08-13T08:00:00Z",
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

beforeEach(() => {
  mockedUseWorkspace.mockReturnValue({
    user: {
      id: organization.owner_user_id,
      email: "owner@example.com",
      name: "Владелец",
      status: "active",
      is_superadmin: false,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    },
    organizations: [organization],
    activeOrganization: organization,
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function analyticsResponse() {
  return {
    period: { start: "2026-07-15T00:00:00Z", end: "2026-08-13T23:59:59Z", days: 30 },
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
}

function billingResponse() {
  return {
    organization_id: organization.id,
    plan: {
      id: "44444444-4444-4444-8444-444444444444",
      code: "pro",
      name: "Pro",
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
    usage: [],
    pricing_finalized: false,
  };
}

function installApi(attention: Response) {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes("/api/dashboard/attention")) return attention;
    if (url.includes("/api/analytics/overview")) return jsonResponse(analyticsResponse());
    if (url.includes("/api/billing/overview")) return jsonResponse(billingResponse());
    if (url.includes("/api/marketplace-accounts")) return jsonResponse([]);
    if (url.includes("/instruction-sets")) return jsonResponse([]);
    return jsonResponse({ detail: "Unexpected test request" }, 500);
  }));
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><DashboardPage /></QueryClientProvider>);
}

describe("dashboard visual hierarchy", () => {
  it("puts decisions before a continuous summary", async () => {
    installApi(jsonResponse({
      organization_id: organization.id,
      items: [{
        key: "needs_reply",
        title: "Отзывы и вопросы без ответа",
        count: 18,
        href: "/app/inbox?status=needs_reply",
        severity: "info",
      }],
      integration_issues: 2,
    }));

    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Нужно сделать" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Краткая сводка" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Отзывы и вопросы без ответа/ })).toHaveAttribute(
      "href",
      "/app/inbox?status=needs_reply",
    );
    expect(screen.queryByText("Операционный центр")).not.toBeInTheDocument();
    expect(screen.queryByText("Текущая нагрузка")).not.toBeInTheDocument();
  });

  it("shows a calm clear state when no decision is required", async () => {
    installApi(jsonResponse({
      organization_id: organization.id,
      items: [],
      integration_issues: 0,
    }));

    renderDashboard();

    expect(await screen.findByText("Сейчас ничего не требует вашего решения")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Краткая сводка" })).toBeInTheDocument();
  });

  it("keeps successful analytics visible when the action queue fails", async () => {
    installApi(jsonResponse({ detail: "Сервис временно недоступен" }, 503));

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить задачи");
    expect(await screen.findByText("1 842")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Краткая сводка" })).toBeInTheDocument();
  });
});
