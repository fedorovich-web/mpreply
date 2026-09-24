import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { MarketplaceIntegrationWorkspace } from "../../components/integrations/MarketplaceIntegrationWorkspace";
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

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
  it("offers management routes for every registered marketplace", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([account]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByText("1 подключение")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Управлять подключениями" })).toHaveAttribute(
      "href",
      "/app/integrations/wildberries",
    );
    for (const [marketplace, name] of [["ozon", "Ozon"], ["yandex-market", "Яндекс Маркет"], ["avito", "Авито"]]) {
      expect(screen.getByRole("link", { name: `Подключить ${name}` })).toHaveAttribute(
        "href",
        `/app/integrations/${marketplace}`,
      );
    }
    expect(screen.queryByText("Пока недоступно")).not.toBeInTheDocument();
  });

  it("does not present failed account loading as zero connections", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "API unavailable" }), { status: 503 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByText("Не удалось загрузить подключения")).toBeInTheDocument();
    expect(screen.queryAllByText("Нет подключений")).toHaveLength(0);
    expect(screen.getAllByText("Состояние неизвестно")).toHaveLength(4);
  });
});

describe("MarketplaceIntegrationWorkspace", () => {
  it("lets an owner create a tenant-scoped account and never puts organization id into a manual field", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            organization_id: payload.organization_id,
            display_name: payload.display_name,
            id: "44444444-4444-4444-8444-444444444444",
            seller_id: payload.seller_id ?? null,
            credentials_masked: "sha256:new1…safe",
            credentials_status: "pending_validation",
            status: "pending_validation",
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<MarketplaceIntegrationWorkspace marketplace="wildberries" />);

    const form = await screen.findByRole("form", { name: "Новое подключение Wildberries" });
    expect(within(form).queryByLabelText(/Organization ID/i)).not.toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText("Название подключения"), {
      target: { value: "WB второй кабинет" },
    });
    fireEvent.change(within(form).getByLabelText("API-ключ Wildberries"), {
      target: { value: "super-secret-wb-token" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const payload = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      organization_id: organization.id,
      marketplace: "wildberries",
      display_name: "WB второй кабинет",
      credentials: "super-secret-wb-token",
      default_response_mode: "inherit",
    });
  });

  it("keeps viewer membership read-only and hides credential actions", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([account]), { status: 200 })));

    renderWithQueryClient(<MarketplaceIntegrationWorkspace marketplace="wildberries" />);

    expect(await screen.findByRole("heading", { name: account.display_name })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Новое подключение Wildberries" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить доступ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Синхронизировать сейчас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отозвать доступ" })).not.toBeInTheDocument();
  });

  it("tells the owner to revalidate after changing an account reference", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({
          ...account,
          seller_id: "seller-43",
          status: "pending_validation",
          credentials_status: "pending_validation",
          scopes_json: {},
        }), { status: 200 });
      }
      return new Response(JSON.stringify([account]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<MarketplaceIntegrationWorkspace marketplace="wildberries" />);
    const form = await screen.findByRole("form", { name: "Настройки кабинета Wildberries" });
    fireEvent.change(within(form).getByLabelText(/Seller ID/), { target: { value: "seller-43" } });
    fireEvent.click(within(form).getByRole("button", { name: "Сохранить настройки" }));

    expect(await screen.findByText("ID кабинета изменён. Проверьте доступ заново перед синхронизацией и отправкой."))
      .toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({ seller_id: "seller-43" });
  });

  it.each([
    { marketplace: "ozon" as const, label: "Ozon", sellerLabel: "Client ID Ozon", sellerId: "123456", credentials: "ozon-api-key-123", expected: "ozon-api-key-123" },
    { marketplace: "yandex_market" as const, label: "Яндекс Маркет", sellerLabel: "Business ID Яндекс Маркета", sellerId: "123456", credentials: "yandex-api-key-123", expected: "yandex-api-key-123" },
  ])("creates $marketplace with provider-specific account ID and API key", async ({ marketplace, label, sellerLabel, sellerId, credentials, expected }) => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ ...account, marketplace, seller_id: sellerId, status: "pending_validation" }), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<MarketplaceIntegrationWorkspace marketplace={marketplace} />);
    const form = await screen.findByRole("form", { name: `Новое подключение ${label}` });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: `${label} кабинет` } });
    fireEvent.change(within(form).getByLabelText(sellerLabel), { target: { value: sellerId } });
    fireEvent.change(within(form).getByLabelText(`API-ключ ${label}`), { target: { value: credentials } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({ marketplace, seller_id: sellerId, credentials: expected });
  });

  it("serializes Avito client credentials without exposing the secret in the account response", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ ...account, marketplace: "avito", seller_id: "123456", status: "pending_validation" }), { status: 201 });
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<MarketplaceIntegrationWorkspace marketplace="avito" />);
    const form = await screen.findByRole("form", { name: "Новое подключение Авито" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), { target: { value: "Авито кабинет" } });
    fireEvent.change(within(form).getByLabelText("ID аккаунта Авито"), { target: { value: "123456" } });
    fireEvent.change(within(form).getByLabelText("Client ID Авито"), { target: { value: "client-123" } });
    fireEvent.change(within(form).getByLabelText("Client Secret Авито"), { target: { value: "secret-123" } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const payload = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({ marketplace: "avito", seller_id: "123456" });
    expect(JSON.parse(String(payload.credentials))).toEqual({ version: 1, client_id: "client-123", client_secret: "secret-123" });
  });
});
