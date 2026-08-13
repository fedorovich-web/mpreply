import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "../../app/app/dashboard/page";
import InboxPage from "../../app/app/inbox/page";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithWorkspace(node: React.ReactNode) {
  mockedUseWorkspace.mockReturnValue({
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "owner@example.com",
      name: "Владелец",
      status: "active",
      is_superadmin: false,
      created_at: "2026-08-13T08:00:00Z",
      updated_at: "2026-08-13T08:00:00Z",
    },
    organizations: [organization],
    activeOrganization: organization,
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("authenticated customer copy", () => {
  it("renders dashboard data without implementation terminology", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/api/analytics/overview")) {
        return new Response(JSON.stringify({
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
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
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
      }), { status: 200 });
    }));

    renderWithWorkspace(<DashboardPage />);
    expect(await screen.findByText("1 842")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Сводка по отзывам и вопросам" })).toBeInTheDocument();

    for (const copy of ["Операционный центр", "Dashboard", "Live workspace", "Current plan", "manual", "AI drafts", "Billing schema", "usage evaluation", "workspace"]) {
      expect(screen.queryByText(new RegExp(copy, "i"))).not.toBeInTheDocument();
    }
  });

  it("renders an empty Inbox without exposing transport details", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
    }), { status: 200 })));

    renderWithWorkspace(<InboxPage />);
    await waitFor(() => expect(screen.getByText("Нет обращений по выбранным фильтрам")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: "Отзывы, вопросы и чаты" })).toBeInTheDocument();

    expect(screen.queryByText(/GET \/api\/messages/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backend API/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/WB MVP/i)).not.toBeInTheDocument();
  });
});
