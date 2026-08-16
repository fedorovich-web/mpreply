import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminOverviewWorkspace } from "../../components/admin/AdminOverviewWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-08-16T12:00:00Z";
const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminOverviewWorkspace", () => {
  it("links the superadmin overview to model configuration", async () => {
    const organization = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Системный кабинет",
      slug: "system",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      plan_id: null,
      default_response_mode: "auto" as const,
      status: "active",
      current_user_role: "owner" as const,
      created_at: timestamp,
      updated_at: timestamp,
    };
    mockedUseWorkspace.mockReturnValue({
      user: {
        id: organization.owner_user_id,
        email: "admin@example.com",
        name: "Администратор",
        status: "active",
        is_superadmin: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
      organizations: [organization],
      activeOrganization: organization,
      setActiveOrganizationId: vi.fn(),
      logout: vi.fn(async () => undefined),
      isLoggingOut: false,
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      generated_at: timestamp,
      organizations_total: 4,
      organizations_active: 3,
      users_total: 8,
      subscriptions_active: 2,
      usage_events_30d: 21,
      ai_cost_estimate_30d: 1.25,
      integration_failures_24h: 0,
      replies_failed_24h: 0,
    }), { status: 200 })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminOverviewWorkspace />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("link", { name: "Настроить модели AI" }))
      .toHaveAttribute("href", "/app/admin/llm");
  });
});
