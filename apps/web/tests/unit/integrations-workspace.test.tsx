import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvitoIntegrationWorkspace } from "../../components/integrations/AvitoIntegrationWorkspace";
import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { OzonIntegrationWorkspace } from "../../components/integrations/OzonIntegrationWorkspace";
import {
  MarketplaceIntegrationWorkspace,
  WildberriesIntegrationWorkspace,
} from "../../components/integrations/WildberriesIntegrationWorkspace";
import { YandexMarketIntegrationWorkspace } from "../../components/integrations/YandexMarketIntegrationWorkspace";
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
    locale: "ru",
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
    logoutError: null,
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
    expect(screen.getAllByText("Подключение доступно")).toHaveLength(4);
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

  it("keeps marketplace cards visible when a manual refresh fails", async () => {
    mockWorkspace("owner");
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      requests += 1;
      if (requests === 1) {
        return new Response(JSON.stringify([account]), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "connection_pool_timeout" }), { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByRole("heading", { name: "Wildberries" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Обновить подключения" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не удалось обновить подключения");
    expect(alert).not.toHaveTextContent("connection_pool_timeout");
    expect(screen.getByRole("heading", { name: "Wildberries" })).toBeInTheDocument();
  });

  it("keeps a recovered account healthy even when its cumulative error count is nonzero", async () => {
    mockWorkspace("owner");
    const recoveredAccount = {
      ...account,
      error_count: 3,
      last_error_sync_at: "2026-07-12T05:30:00Z",
      last_success_sync_at: "2026-07-12T06:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([recoveredAccount]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    const summary = await screen.findByLabelText("Сводка подключений");
    expect(within(summary).getByText("Работают нормально").parentElement).toHaveTextContent("1");
    expect(within(summary).getByText("Требуют внимания").parentElement).toHaveTextContent("0");
  });

  it("does not call an account healthy when its access is no longer valid", async () => {
    mockWorkspace("owner");
    const accountWithInvalidAccess = {
      ...account,
      credentials_status: "invalid",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([accountWithInvalidAccess]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    const summary = await screen.findByLabelText("Сводка подключений");
    expect(within(summary).getByText("Работают нормально").parentElement).toHaveTextContent("0");
    expect(within(summary).getByText("Требуют внимания").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Требует внимания")).toBeInTheDocument();
  });

  it("marks an active account as requiring attention when its latest sync failed", async () => {
    mockWorkspace("owner");
    const accountWithCurrentSyncError = {
      ...account,
      error_count: 1,
      last_success_sync_at: "2026-07-12T06:00:00Z",
      last_error_sync_at: "2026-07-12T06:30:00Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([accountWithCurrentSyncError]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    const summary = await screen.findByLabelText("Сводка подключений");
    expect(within(summary).getByText("Работают нормально").parentElement).toHaveTextContent("0");
    expect(within(summary).getByText("Требуют внимания").parentElement).toHaveTextContent("1");
    expect(screen.getByText("Требует внимания")).toBeInTheDocument();
  });
});

describe("MarketplaceIntegrationWorkspace", () => {
  it("uses the selected marketplace in labels, filtering and create payload", async () => {
    mockWorkspace("owner");
    const ozonAccount = { ...account, id: "55555555-5555-4555-8555-555555555555", marketplace: "ozon", display_name: "Ozon основной" };
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...ozonAccount, ...payload }), { status: 200 });
      }
      return new Response(JSON.stringify([account, ozonAccount]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(
      <MarketplaceIntegrationWorkspace
        credentialLabel="Данные доступа Ozon"
        marketplace="ozon"
        marketplaceName="Ozon"
        placeholder="Например, Ozon — основной магазин"
      />,
    );

    expect(await screen.findByText("Кабинеты Ozon")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ozon основной" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Основной кабинет" })).not.toBeInTheDocument();

    const form = screen.getByRole("form", { name: "Новое подключение Ozon" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Новый Ozon" } });
    fireEvent.change(within(form).getByLabelText("Данные доступа Ozon"), { target: { value: "secret-token" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.marketplace).toBe("ozon");
    expect(body.organization_id).toBe(organization.id);
  });
});

describe("Specialized marketplace connection forms", () => {
  function mockEmptyAccounts() {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            id: "66666666-6666-4666-8666-666666666666",
            marketplace: payload.marketplace,
            display_name: payload.display_name,
            seller_id: null,
            default_response_mode: payload.default_response_mode,
            status: "pending_validation",
            credentials_status: "pending_validation",
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("requires Ozon Client ID and sends it with the API key", async () => {
    mockWorkspace("owner");
    const fetchMock = mockEmptyAccounts();
    renderWithQueryClient(<OzonIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Ozon" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Ozon основной" } });
    fireEvent.change(within(form).getByLabelText("API-ключ Ozon"), { target: { value: "ozon-api-key" } });
    expect(within(form).getByRole("button", { name: "Добавить кабинет" })).toBeDisabled();

    fireEvent.change(within(form).getByLabelText("Client ID"), { target: { value: "client-123" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.marketplace).toBe("ozon");
    expect(body.seller_id).toBe("client-123");
    expect(body.credentials).toBe("ozon-api-key");
  });

  it("requires a positive Yandex Market Business ID", async () => {
    mockWorkspace("owner");
    const fetchMock = mockEmptyAccounts();
    renderWithQueryClient(<YandexMarketIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Яндекс Маркет" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Маркет" } });
    fireEvent.change(within(form).getByLabelText("API-ключ Яндекс Маркета"), { target: { value: "yandex-api-key" } });
    fireEvent.change(within(form).getByLabelText("Business ID"), { target: { value: "0" } });
    expect(within(form).getByRole("button", { name: "Добавить кабинет" })).toBeDisabled();

    fireEvent.change(within(form).getByLabelText("Business ID"), { target: { value: "42" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.marketplace).toBe("yandex_market");
    expect(body.seller_id).toBe("42");
  });

  it("encodes Avito Client ID and Client Secret without exposing them as separate API fields", async () => {
    mockWorkspace("owner");
    const fetchMock = mockEmptyAccounts();
    renderWithQueryClient(<AvitoIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Авито" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Авито основной" } });
    fireEvent.change(within(form).getByLabelText("Avito User ID"), { target: { value: "123456" } });
    fireEvent.change(within(form).getByLabelText("Client ID"), { target: { value: "avito-client" } });
    fireEvent.change(within(form).getByLabelText("Client Secret"), { target: { value: "avito-secret" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body.marketplace).toBe("avito");
    expect(body.seller_id).toBe("123456");
    expect(JSON.parse(String(body.credentials))).toEqual({
      client_id: "avito-client",
      client_secret: "avito-secret",
    });
    expect(body).not.toHaveProperty("client_id");
    expect(body).not.toHaveProperty("client_secret");
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
    fireEvent.change(within(form).getByLabelText("Ключ доступа Wildberries"), { target: { value: "secret-token" } });
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

  it("shows human connection labels instead of technical synchronization counters", async () => {
    mockWorkspace("owner");
    const accountWithHistory = {
      ...account,
      error_count: 7,
      last_error_sync_at: "2026-07-11T22:00:00Z",
      last_success_sync_at: "2026-07-12T06:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([accountWithHistory]), { status: 200 })));

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Основной кабинет" })).toBeInTheDocument();
    expect(screen.getByText("Последнее успешное обновление")).toBeInTheDocument();
    expect(screen.getByText("Последняя ошибка")).toBeInTheDocument();
    expect(screen.queryByText("Ошибки синхронизации")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить данные" })).toBeInTheDocument();
  });

  it("shows a current sync failure instead of calling an active account healthy", async () => {
    mockWorkspace("owner");
    const accountWithCurrentSyncError = {
      ...account,
      error_count: 1,
      last_success_sync_at: "2026-07-12T06:00:00Z",
      last_error_sync_at: "2026-07-12T06:30:00Z",
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([accountWithCurrentSyncError]), { status: 200 })));

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Основной кабинет" })).toBeInTheDocument();
    expect(screen.getAllByText("Требует внимания").length).toBeGreaterThan(0);
    expect(screen.queryByText("Активно")).not.toBeInTheDocument();
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