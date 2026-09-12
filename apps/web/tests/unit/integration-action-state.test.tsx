import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-09-12T08:00:00Z";
const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: timestamp,
  updated_at: timestamp,
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

function account(id: string, marketplace: string, displayName: string) {
  return {
    id,
    organization_id: organization.id,
    marketplace,
    display_name: displayName,
    seller_id: `seller-${id.slice(0, 4)}`,
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
}

function renderWithQueryClient(component: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("integration card actions", () => {
  it("shows manage actions for connected marketplaces and connect actions only when no account exists", async () => {
    mockedUseWorkspace.mockReturnValue({
      user: {
        id: organization.owner_user_id,
        email: "owner@example.com",
        name: "Owner",
        status: "active",
        is_superadmin: false,
        created_at: timestamp,
        updated_at: timestamp,
      },
      organizations: [organization],
      activeOrganization: organization,
      setActiveOrganizationId: vi.fn(),
      logout: vi.fn(async () => undefined),
      isLoggingOut: false,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            account("33333333-3333-4333-8333-333333333333", "wildberries", "WB основной"),
            account("44444444-4444-4444-8444-444444444444", "ozon", "Ozon основной"),
          ]),
          { status: 200 },
        ),
      ),
    );

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByRole("link", { name: "Управлять Wildberries" })).toHaveAttribute(
      "href",
      "/app/integrations/wildberries",
    );
    expect(screen.getByRole("link", { name: "Управлять Ozon" })).toHaveAttribute(
      "href",
      "/app/integrations/ozon",
    );
    expect(screen.getByRole("link", { name: "Подключить Яндекс Маркет" })).toHaveAttribute(
      "href",
      "/app/integrations/yandex-market",
    );
    expect(screen.getByRole("link", { name: "Подключить Авито" })).toHaveAttribute(
      "href",
      "/app/integrations/avito",
    );
  });
});
