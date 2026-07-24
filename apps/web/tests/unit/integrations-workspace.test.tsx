import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { WildberriesIntegrationWorkspace } from "../../components/integrations/WildberriesIntegrationWorkspace";
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
  it("loads real marketplace accounts and keeps unsupported adapters explicit", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([account]), { status: 200 })));

    renderWithQueryClient(<IntegrationsWorkspace />);

    expect(await screen.findByText("1 подключение")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Управлять подключениями" })).toHaveAttribute(
      "href",
      "/app/integrations/wildberries",
    );
    expect(screen.getByRole("link", { name: "Подключить Яндекс Маркет" })).toHaveAttribute(
      "href",
      "/app/integrations/yandex-market",
    );
    expect(screen.getAllByText("Пока недоступно")).toHaveLength(2);
    expect(screen.getAllByText("Без ложного обещания production readiness.")).toHaveLength(2);
  });
});

describe("WildberriesIntegrationWorkspace", () => {
  it("lets an owner create a tenant-scoped account and never puts organization id into a manual field", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            ...payload,
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

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

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

    renderWithQueryClient(<WildberriesIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: account.display_name })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Новое подключение Wildberries" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить ключ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Синхронизировать сейчас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отозвать ключ" })).not.toBeInTheDocument();
  });
});

describe("YandexMarketIntegrationWorkspace", () => {
  it("requires Business ID and creates a Yandex Market account", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            ...payload,
            id: "55555555-5555-4555-8555-555555555555",
            marketplace: "yandex_market",
            seller_id: payload.seller_id,
            display_name: payload.display_name,
            credentials_masked: "sha256:ym01…safe",
            credentials_status: "pending_validation",
            status: "pending_validation",
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<YandexMarketIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Яндекс Маркета" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), {
      target: { value: "Маркет основной" },
    });
    fireEvent.change(within(form).getByLabelText("Business ID"), {
      target: { value: "123456" },
    });
    fireEvent.change(within(form).getByLabelText("API-ключ Яндекс Маркета"), {
      target: { value: "super-secret-market-token" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить кабинет" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const payload = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      organization_id: organization.id,
      marketplace: "yandex_market",
      display_name: "Маркет основной",
      seller_id: "123456",
      credentials: "super-secret-market-token",
      default_response_mode: "inherit",
    });
  });
});


describe("Yandex Market integration observability", () => {
  it("shows health, scopes, stream state and failed sync history without exposing secrets", async () => {
    mockWorkspace("owner");
    const yandexAccount = {
      ...account,
      marketplace: "yandex_market",
      display_name: "Маркет основной",
      seller_id: "123456",
      scopes_json: { validated: true, scopes: ["COMMUNICATION"] },
      last_error_sync_at: "2026-07-24T11:00:00Z",
      error_count: 2,
    };
    const overview = {
      account: yandexAccount,
      health_status: "error",
      health_reasons: [
        "Ошибки синхронизации: reviews.",
        "Последняя ручная синхронизация завершилась ошибкой.",
      ],
      scopes: ["COMMUNICATION"],
      sync_states: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          marketplace_account_id: yandexAccount.id,
          stream: "reviews",
          status: "error",
          next_run_at: "2026-07-24T12:00:00Z",
          last_attempt_at: "2026-07-24T11:00:00Z",
          last_success_at: timestamp,
          last_error_at: "2026-07-24T11:00:00Z",
          last_cycle_completed_at: timestamp,
          consecutive_failures: 2,
        },
        {
          id: "77777777-7777-4777-8777-777777777777",
          marketplace_account_id: yandexAccount.id,
          stream: "questions",
          status: "idle",
          next_run_at: "2026-07-24T12:05:00Z",
          last_attempt_at: timestamp,
          last_success_at: timestamp,
          last_error_at: null,
          last_cycle_completed_at: timestamp,
          consecutive_failures: 0,
        },
      ],
      recent_jobs: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          job_type: "manual_sync",
          status: "failed",
          started_at: "2026-07-24T11:00:00Z",
          finished_at: "2026-07-24T11:01:00Z",
          error_message_safe: "Marketplace API request failed",
          stats: { imported_reviews: 3, skipped: 1 },
          created_at: "2026-07-24T11:00:00Z",
        },
      ],
      recent_events: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          event_type: "sync.feedbacks",
          status: "failed",
          error_code: "rate_limited",
          error_message_safe: "Marketplace API rate limit exceeded",
          details: { pages_processed: 2 },
          created_at: "2026-07-24T11:01:00Z",
        },
      ],
    };

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes(`/api/marketplace-accounts/${yandexAccount.id}/overview`)) {
        return new Response(JSON.stringify(overview), { status: 200 });
      }
      return new Response(JSON.stringify([yandexAccount]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<YandexMarketIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Маркет основной" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Есть ошибки" })).toBeInTheDocument();
    expect(screen.getByText("Общение с покупателями")).toBeInTheDocument();
    expect(screen.getByText("Состояние потоков")).toBeInTheDocument();
    expect(screen.getByText("Отзывы")).toBeInTheDocument();
    expect(screen.getByText("История синхронизаций")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить синхронизацию" })).toBeInTheDocument();
    expect(screen.getByText(/Яндекс Маркет временно ограничил частоту запросов/)).toBeInTheDocument();
    expect(screen.queryByText(/must-not-leak|api_key|token/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("jobs_limit=10"))).toBe(true);
  });
});
