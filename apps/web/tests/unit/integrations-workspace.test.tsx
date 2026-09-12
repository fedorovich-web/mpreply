import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { WildberriesIntegrationWorkspace } from "../../components/integrations/WildberriesIntegrationWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-07-12T06:00:00Z";
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

const account = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace: "wildberries",
  display_name: "Основной кабинет",
  seller_id: "seller-1",
  status: "active",
  credentials_masked: "••••••••abcd",
  credentials_status: "valid",
  scopes_json: {},
  default_response_mode: "auto",
  last_success_sync_at: timestamp,
  last_error_sync_at: null,
  error_count: 0,
  created_at: timestamp,
  updated_at: timestamp,
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockWorkspace(role: "owner" | "admin" | "manager" | "viewer") {
  const activeOrganization = { ...organization, current_user_role: role };
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
    organizations: [activeOrganization],
    activeOrganization,
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });
}

function renderWithQueryClient(component: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("IntegrationsWorkspace", () => {
  it("shows all four marketplace integrations as ready and distinguishes connection state", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([account]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByText("1 подключение")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Wildberries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ozon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Яндекс Маркет" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Авито" })).toBeInTheDocument();
    expect(screen.getAllByText("Интеграция готова")).toHaveLength(4);
    expect(screen.getAllByText("Не подключено")).toHaveLength(3);
    expect(screen.queryByText(/Planned|Пока недоступно|MVP adapter|production readiness/i)).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Управлять Wildberries" })).toHaveAttribute(
      "href",
      "/app/integrations/wildberries",
    );
    expect(screen.getByRole("link", { name: "Подключить Ozon" })).toHaveAttribute(
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

describe("WildberriesIntegrationWorkspace", () => {
  it("lets an owner create a tenant-scoped account and never puts organization id into a manual field", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...account, ...payload }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

    expect(await screen.findByText("Кабинеты Wildberries")).toBeInTheDocument();
    expect(screen.queryByLabelText(/organization/i)).not.toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Новое подключение Wildberries" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Новый WB" } });
    fireEvent.change(within(form).getByLabelText("API-ключ Wildberries"), { target: { value: "secret-token" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.organization_id).toBe(organization.id);
    expect(body.display_name).toBe("Новый WB");
    expect(body.credentials).toBe("secret-token");
  });

  it("keeps viewer membership read-only and hides credential actions", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([account]), { status: 200 })));

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Основной кабинет" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Новое подключение Wildberries" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Заменить ключ/i })).not.toBeInTheDocument();
    expect(screen.getByText("Только просмотр")).toBeInTheDocument();
  });
});