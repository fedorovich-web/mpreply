import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AutomationRulesWorkspace } from "../../components/automation-rules/AutomationRulesWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: "2026-07-12T06:00:00Z",
  updated_at: "2026-07-12T06:00:00Z",
};

const rule = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
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
  created_by: null,
  updated_by: null,
  created_at: "2026-07-12T06:00:00Z",
  updated_at: "2026-07-12T06:00:00Z",
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockWorkspace(role: "owner" | "admin" | "manager" | "viewer") {
  const activeOrganization = { ...organization, current_user_role: role };
  mockedUseWorkspace.mockReturnValue({
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "owner@example.com",
      name: "Owner",
      status: "active",
      is_superadmin: false,
      created_at: "2026-07-12T06:00:00Z",
      updated_at: "2026-07-12T06:00:00Z",
    },
    organizations: [activeOrganization],
    activeOrganization,
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });
}

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AutomationRulesWorkspace />
    </QueryClientProvider>,
  );
}

describe("AutomationRulesWorkspace", () => {
  it("loads live rules and lets an owner create a tenant-scoped rule", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...rule, ...payload, id: "44444444-4444-4444-8444-444444444444" }), {
          status: 201,
        });
      }
      return new Response(JSON.stringify({ items: [rule], total: 1 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Balanced auto" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Создать правило" }));

    const editor = screen.getByRole("form", { name: "Редактор правила автоматизации" });
    fireEvent.change(within(editor).getByLabelText("Название"), { target: { value: "Отзывы 1–3" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Создать правило" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      organization_id: organization.id,
      name: "Отзывы 1–3",
      mode: "auto",
      require_manual_review_on_flags: true,
      stop_on_missing_product_context: true,
      stop_on_low_confidence: true,
    });
  });

  it("shows a read-only state for viewer membership and hides write controls", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [rule], total: 1 }), { status: 200 })),
    );

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Balanced auto" })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Создать правило" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
  });
});
