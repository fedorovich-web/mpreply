import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsWorkspace } from "../../components/integrations/IntegrationsWorkspace";
import { AvitoIntegrationWorkspace } from "../../components/integrations/AvitoIntegrationWorkspace";
import { OzonIntegrationWorkspace } from "../../components/integrations/OzonIntegrationWorkspace";
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
  ai_instruction_set_id: null,
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
  it("loads real marketplace accounts and exposes every implemented marketplace route", async () => {
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
    expect(screen.getByRole("link", { name: "Подключить Ozon" })).toHaveAttribute(
      "href",
      "/app/integrations/ozon",
    );
    expect(screen.getByRole("link", { name: "Подключить Авито" })).toHaveAttribute(
      "href",
      "/app/integrations/avito",
    );
    expect(screen.queryByText("Пока недоступно")).not.toBeInTheDocument();
    expect(screen.queryByText("Подключение пока не поддерживается.")).not.toBeInTheDocument();
  });
});

describe("AvitoIntegrationWorkspace", () => {
  it("requires Avito user ID and client credentials and submits the exact opaque credential payload", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            ...payload,
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            marketplace: "avito",
            display_name: payload.display_name,
            seller_id: null,
            credentials_masked: "sha256:av01…safe",
            credentials_status: "pending_validation",
            status: "pending_validation",
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AvitoIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Авито" });
    const submit = within(form).getByRole("button", { name: "Добавить кабинет" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), {
      target: { value: "Авито основной" },
    });
    fireEvent.change(within(form).getByLabelText("ID пользователя Авито"), {
      target: { value: "123456" },
    });
    fireEvent.change(within(form).getByLabelText("Client ID"), {
      target: { value: "client-123" },
    });
    expect(submit).toBeDisabled();

    const clientSecretInput = within(form).getByLabelText("Client Secret");
    fireEvent.change(clientSecretInput, { target: { value: "synthetic-secret" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      organization_id: organization.id,
      marketplace: "avito",
      display_name: "Авито основной",
      seller_id: "123456",
      credentials: '{"client_id":"client-123","client_secret":"synthetic-secret"}',
      default_response_mode: "inherit",
    });
    await waitFor(() => {
      expect(within(form).getByLabelText("ID пользователя Авито")).toHaveValue("");
      expect(within(form).getByLabelText("Client ID")).toHaveValue("");
      expect(clientSecretInput).toHaveValue("");
    });
  });

  it("shows chat access, authentication and safe failed history without exposing Avito secrets", async () => {
    mockWorkspace("owner");
    const avitoAccount = {
      ...account,
      marketplace: "avito",
      display_name: "Авито основной",
      seller_id: null,
      scopes_json: {
        validated: true,
        checked_at: timestamp,
        scopes: ["fetch_chats"],
        authentication: "client_credentials",
        client_id: "must-not-leak-client-id",
        client_secret: "must-not-leak-client-secret",
        access_token: "must-not-leak-access-token",
      },
      last_error_sync_at: "2026-08-13T10:00:00Z",
      error_count: 1,
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${avitoAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: avitoAccount,
          health_status: "error",
          health_reasons: ["Последняя синхронизация чатов завершилась ошибкой."],
          scopes: ["fetch_chats"],
          sync_states: [{
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            marketplace_account_id: avitoAccount.id,
            stream: "chats",
            status: "error",
            next_run_at: "2026-08-13T11:00:00Z",
            last_attempt_at: "2026-08-13T10:00:00Z",
            last_success_at: timestamp,
            last_error_at: "2026-08-13T10:00:00Z",
            last_cycle_completed_at: timestamp,
            consecutive_failures: 1,
          }],
          recent_jobs: [{
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            job_type: "manual_sync",
            status: "failed",
            started_at: "2026-08-13T10:00:00Z",
            finished_at: "2026-08-13T10:01:00Z",
            error_message_safe: "Не удалось завершить синхронизацию чатов.",
            stats: { imported_chats: 2 },
            created_at: "2026-08-13T10:00:00Z",
          }],
          recent_events: [{
            id: "12121212-1212-4212-8212-121212121212",
            event_type: "sync.chats",
            status: "failed",
            error_code: "rate_limited",
            error_message_safe: "must-not-leak-provider-error-body",
            details: {
              pages_processed: 2,
              provider_body: "must-not-leak-provider-body",
              client_id: "must-not-leak-event-client-id",
              client_secret: "must-not-leak-event-client-secret",
              access_token: "must-not-leak-event-access-token",
              seller_id: "must-not-leak-user-id",
              cursor: "must-not-leak-cursor",
              context: {
                count: 3,
                seller_id: "must-not-leak-nested-user-id",
                provider_body: "must-not-leak-nested-provider-body",
              },
            },
            created_at: "2026-08-13T10:01:00Z",
          }, {
            id: "13131313-1313-4313-8313-131313131313",
            event_type: "sync.chats",
            status: "success",
            error_code: null,
            error_message_safe: null,
            details: {
              context: {
                count: 3,
                seller_id: "must-not-leak-nested-user-id",
                provider_body: "must-not-leak-nested-provider-body",
              },
              message: "must-not-leak-customer-message",
              text: "must-not-leak-customer-text",
              content: "must-not-leak-customer-content",
              response_body: "must-not-leak-response-body",
              raw_response: "must-not-leak-raw-response",
            },
            created_at: "2026-08-13T10:02:00Z",
          }, {
            id: "14141414-1414-4414-8414-141414141414",
            event_type: "sync.chats",
            status: "failed",
            error_code: "sync_page_limit_exceeded",
            error_message_safe: "must-not-leak-page-limit-provider-copy",
            details: {},
            created_at: "2026-08-13T10:03:00Z",
          }, {
            id: "15151515-1515-4515-8515-151515151515",
            event_type: "sync.chats",
            status: "failed",
            error_code: "sync_pagination_checkpoint_invalid",
            error_message_safe: "must-not-leak-checkpoint-provider-copy",
            details: {},
            created_at: "2026-08-13T10:04:00Z",
          }, {
            id: "16161616-1616-4616-8616-161616161616",
            event_type: "sync.chats",
            status: "failed",
            error_code: null,
            error_message_safe: "Безопасное описание сбоя синхронизации.",
            details: { count: 1 },
            created_at: "2026-08-13T10:05:00Z",
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([avitoAccount]), { status: 200 });
    }));

    renderWithQueryClient(<AvitoIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Авито основной" })).toBeInTheDocument();
    expect(await screen.findByText("Доступ к чатам")).toBeInTheDocument();
    expect(screen.getByText("Client ID и Client Secret")).toBeInTheDocument();
    expect(screen.getByText("Синхронизация чатов")).toBeInTheDocument();
    expect(screen.getByText("Не удалось завершить синхронизацию чатов.")).toBeInTheDocument();
    expect(screen.getByText(/Авито временно ограничил частоту запросов/)).toBeInTheDocument();
    expect(screen.getByText(/обработано: 3/)).toBeInTheDocument();
    expect(screen.getByText(/достигла защитного лимита страниц/)).toBeInTheDocument();
    expect(screen.getByText(/некорректной точки продолжения/)).toBeInTheDocument();
    expect(screen.getByText("Безопасное описание сбоя синхронизации.")).toBeInTheDocument();
    expect(screen.getByText(/ID пользователя Авито хранится защищённо и не отображается/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить синхронизацию" })).toBeInTheDocument();
    expect(screen.queryByText(/must-not-leak/)).not.toBeInTheDocument();
    expect(screen.queryByText("rate_limited")).not.toBeInTheDocument();
  });

  it("replaces the hidden Avito user ID and rotates only encoded client credentials", async () => {
    mockWorkspace("owner");
    const avitoAccount = {
      ...account,
      marketplace: "avito",
      display_name: "Авито основной",
      seller_id: null,
      scopes_json: { validated: true, scopes: ["fetch_chats"], authentication: "client_credentials" },
    };
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ ...avitoAccount, ...JSON.parse(String(init.body)), seller_id: null }), { status: 200 });
      }
      if (init?.method === "POST" && url.includes("rotate-credentials")) {
        return new Response(JSON.stringify({
          id: avitoAccount.id,
          status: "pending_validation",
          credentials_status: "pending_validation",
          credentials_masked: "sha256:rotated…safe",
          message: "Credentials rotated.",
        }), { status: 200 });
      }
      if (url.includes(`/api/marketplace-accounts/${avitoAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: avitoAccount,
          health_status: "healthy",
          health_reasons: ["Подключение работает."],
          scopes: ["fetch_chats"],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([avitoAccount]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AvitoIntegrationWorkspace />);
    await screen.findByRole("heading", { name: "Авито основной" });

    const userIdForm = screen.getByRole("form", { name: "Замена ID пользователя Авито" });
    fireEvent.change(within(userIdForm).getByLabelText("Новый ID пользователя Авито"), {
      target: { value: "654321" },
    });
    fireEvent.click(within(userIdForm).getByRole("button", { name: "Заменить ID" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ seller_id: "654321" });

    const rotationForm = screen.getByRole("form", { name: "Замена данных доступа Авито" });
    fireEvent.change(within(rotationForm).getByLabelText("Новый Client ID"), {
      target: { value: "client-new" },
    });
    const newSecretInput = within(rotationForm).getByLabelText("Новый Client Secret");
    fireEvent.change(newSecretInput, { target: { value: "synthetic-new-secret" } });
    fireEvent.click(within(rotationForm).getByRole("button", { name: "Заменить данные доступа" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("rotate-credentials"))).toBe(true);
    });
    const rotateCall = fetchMock.mock.calls.find(([input]) => String(input).includes("rotate-credentials"));
    expect(JSON.parse(String(rotateCall?.[1]?.body))).toEqual({
      credentials: '{"client_id":"client-new","client_secret":"synthetic-new-secret"}',
    });
    await waitFor(() => {
      expect(within(rotationForm).getByLabelText("Новый Client ID")).toHaveValue("");
      expect(newSecretInput).toHaveValue("");
    });
  });

  it.each(["manager", "viewer"] as const)("keeps Avito %s membership read-only", async (role) => {
    mockWorkspace(role);
    const avitoAccount = {
      ...account,
      marketplace: "avito",
      display_name: "Авито основной",
      seller_id: null,
      scopes_json: { validated: true, scopes: ["fetch_chats"], authentication: "client_credentials" },
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${avitoAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: avitoAccount,
          health_status: "healthy",
          health_reasons: ["Подключение работает."],
          scopes: ["fetch_chats"],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([avitoAccount]), { status: 200 });
    }));

    renderWithQueryClient(<AvitoIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Авито основной" })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Новое подключение Авито" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить подключение" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Синхронизировать сейчас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отозвать доступ" })).not.toBeInTheDocument();
  });
});

describe("OzonIntegrationWorkspace", () => {
  it("requires Client ID and API key and creates the exact Ozon account payload", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ...account,
            ...payload,
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            marketplace: "ozon",
            display_name: payload.display_name,
            seller_id: null,
            credentials_masked: "sha256:oz01…safe",
            credentials_status: "pending_validation",
            status: "pending_validation",
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    const form = await screen.findByRole("form", { name: "Новое подключение Ozon" });
    const submit = within(form).getByRole("button", { name: "Добавить кабинет" });
    fireEvent.change(within(form).getByLabelText("Название подключения"), {
      target: { value: "Ozon основной" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(within(form).getByLabelText("Client ID"), {
      target: { value: "client-123" },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(within(form).getByLabelText("API-ключ Ozon"), {
      target: { value: "synthetic-ozon-api-key" },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      organization_id: organization.id,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: "client-123",
      credentials: "synthetic-ozon-api-key",
      default_response_mode: "inherit",
    });
  });

  it.each(["manager", "viewer"] as const)("keeps %s membership read-only without credential or mutation controls", async (role) => {
    mockWorkspace(role);
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: null,
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "attention",
          health_reasons: ["Требуется проверка подключения."],
          scopes: [],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    }));

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Ozon основной" })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Новое подключение Ozon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить ключ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Синхронизировать сейчас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отозвать ключ" })).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "review-only",
      scopes: ["fetch_reviews", "send_review_reply"],
      expected: ["Отзывы и ответы на отзывы"],
      missing: "Вопросы и ответы на вопросы",
    },
    {
      name: "question-only",
      scopes: ["fetch_questions", "send_question_reply"],
      expected: ["Вопросы и ответы на вопросы"],
      missing: "Отзывы и ответы на отзывы",
    },
    {
      name: "reviews and questions",
      scopes: ["fetch_reviews", "send_review_reply", "fetch_questions", "send_question_reply"],
      expected: ["Отзывы и ответы на отзывы", "Вопросы и ответы на вопросы"],
      missing: null,
    },
  ])("groups $name permissions and shows the API key expiry", async ({ scopes, expected, missing }) => {
    mockWorkspace("owner");
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: null,
      scopes_json: {
        validated: true,
        scopes,
        expires_at: "2026-12-01T00:00:00Z",
      },
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "healthy",
          health_reasons: ["Подключение работает."],
          scopes,
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    }));

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    expect(await screen.findByRole("heading", { name: "Ozon основной" })).toBeInTheDocument();
    expect(await screen.findByText(expected[0])).toBeInTheDocument();
    for (const label of expected.slice(1)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    if (missing) expect(screen.queryByText(missing)).not.toBeInTheDocument();
    expect(screen.getByText("Срок действия ключа")).toBeInTheDocument();
    expect(screen.getByText(/1 дек\. 2026 г\./)).toBeInTheDocument();
  });

  it("shows safe failed history and hides Client ID, API key and provider bodies", async () => {
    mockWorkspace("owner");
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: null,
      scopes_json: {
        validated: true,
        scopes: ["fetch_reviews", "send_review_reply"],
        expires_at: "2026-12-01T00:00:00Z",
        client_id: "must-not-leak-client-id",
        api_key: "must-not-leak-api-key",
      },
      last_error_sync_at: "2026-08-13T10:00:00Z",
      error_count: 1,
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "error",
          health_reasons: ["Последняя ручная синхронизация завершилась ошибкой."],
          scopes: ["fetch_reviews", "send_review_reply"],
          sync_states: [],
          recent_jobs: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            job_type: "manual_sync",
            status: "failed",
            started_at: "2026-08-13T10:00:00Z",
            finished_at: "2026-08-13T10:01:00Z",
            error_message_safe: "Не удалось завершить синхронизацию Ozon.",
            stats: { imported_reviews: 2 },
            created_at: "2026-08-13T10:00:00Z",
          }],
          recent_events: [{
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            event_type: "sync.feedbacks",
            status: "failed",
            error_code: "rate_limited",
            error_message_safe: "must-not-leak-provider-error-body",
            details: {
              pages_processed: 2,
              provider_body: "must-not-leak-provider-body",
              api_key: "must-not-leak-event-api-key",
            },
            created_at: "2026-08-13T10:01:00Z",
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    }));

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    expect(await screen.findByText("Не удалось завершить синхронизацию Ozon.")).toBeInTheDocument();
    expect(screen.getByText(/Ozon временно ограничил частоту запросов/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить синхронизацию" })).toBeInTheDocument();
    expect(screen.getByText(/Client ID хранится защищённо и не отображается/)).toBeInTheDocument();
    expect(screen.queryByText(/must-not-leak/)).not.toBeInTheDocument();
    expect(screen.queryByText("rate_limited")).not.toBeInTheDocument();
  });

  it("shows a validated empty permission set as an account problem", async () => {
    mockWorkspace("owner");
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon без прав",
      seller_id: null,
      status: "error",
      scopes_json: { validated: true, scopes: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      if (String(input).includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "error",
          health_reasons: ["API-ключу не хватает прав для работы MPReply."],
          scopes: [],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    }));

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    expect(await screen.findByText("Проверка завершена, но у API-ключа нет прав на отзывы или вопросы Ozon.")).toBeInTheDocument();
    expect(screen.queryByText("Разрешения появятся после успешной проверки API-ключа.")).not.toBeInTheDocument();
  });

  it("maps validation and synchronization errors to Ozon customer copy", async () => {
    mockWorkspace("owner");
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: null,
      scopes_json: { validated: true, scopes: ["fetch_reviews", "send_review_reply"] },
    };
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === "POST" && url.endsWith("/validate")) {
        return new Response(JSON.stringify({
          id: ozonAccount.id,
          status: "error",
          credentials_status: "invalid_credentials",
          scopes: [],
          checked_at: timestamp,
          error_code: "invalid_credentials",
          error_message_safe: "Ozon API key is invalid",
        }), { status: 200 });
      }
      if (init?.method === "POST" && url.endsWith("/sync")) {
        return new Response(JSON.stringify({
          account_id: ozonAccount.id,
          marketplace: "ozon",
          status: "failed",
          imported_reviews: 0,
          imported_questions: 0,
          updated_reviews: 0,
          updated_questions: 0,
          skipped: 0,
          error_code: "rate_limited",
          error_message_safe: "Ozon Seller API rate limit exceeded",
        }), { status: 202 });
      }
      if (url.includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "healthy",
          health_reasons: ["Подключение работает."],
          scopes: ["fetch_reviews", "send_review_reply"],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    await screen.findByRole("heading", { name: "Ozon основной" });
    fireEvent.click(screen.getByRole("button", { name: "Проверить ключ" }));
    expect(await screen.findByText("Client ID или API-ключ отклонён. Проверьте данные подключения.")).toBeInTheDocument();
    expect(screen.queryByText("Ozon API key is invalid")).not.toBeInTheDocument();

    const syncButton = screen.getByRole("button", { name: "Синхронизировать сейчас" });
    await waitFor(() => expect(syncButton).toBeEnabled());
    fireEvent.click(syncButton);
    expect(await screen.findByText("Ozon временно ограничил частоту запросов. Повторите синхронизацию позже.")).toBeInTheDocument();
    expect(screen.queryByText("Ozon Seller API rate limit exceeded")).not.toBeInTheDocument();
  });

  it("replaces Client ID separately and rotates only the API key", async () => {
    mockWorkspace("owner");
    const ozonAccount = {
      ...account,
      marketplace: "ozon",
      display_name: "Ozon основной",
      seller_id: null,
      scopes_json: { validated: true, scopes: ["fetch_reviews", "send_review_reply"] },
    };
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ ...ozonAccount, ...JSON.parse(String(init.body)), seller_id: null }), { status: 200 });
      }
      if (init?.method === "POST" && url.includes("rotate-credentials")) {
        return new Response(JSON.stringify({
          id: ozonAccount.id,
          status: "pending_validation",
          credentials_status: "pending_validation",
          credentials_masked: "sha256:rotated…safe",
          message: "Credentials rotated.",
        }), { status: 200 });
      }
      if (url.includes(`/api/marketplace-accounts/${ozonAccount.id}/overview`)) {
        return new Response(JSON.stringify({
          account: ozonAccount,
          health_status: "healthy",
          health_reasons: ["Подключение работает."],
          scopes: ["fetch_reviews", "send_review_reply"],
          sync_states: [],
          recent_jobs: [],
          recent_events: [],
        }), { status: 200 });
      }
      return new Response(JSON.stringify([ozonAccount]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OzonIntegrationWorkspace />);

    const clientIdForm = await screen.findByRole("form", { name: "Замена Client ID Ozon" });
    fireEvent.change(within(clientIdForm).getByLabelText("Новый Client ID"), {
      target: { value: "client-456" },
    });
    fireEvent.click(within(clientIdForm).getByRole("button", { name: "Заменить Client ID" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ seller_id: "client-456" });

    const rotationForm = screen.getByRole("form", { name: "Замена API-ключа Ozon" });
    fireEvent.change(within(rotationForm).getByLabelText("Новый API-ключ"), {
      target: { value: "synthetic-rotated-api-key" },
    });
    fireEvent.click(within(rotationForm).getByRole("button", { name: "Заменить ключ" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("rotate-credentials") && init?.method === "POST")).toBe(true);
    });
    const rotateCall = fetchMock.mock.calls.find(([input, init]) => String(input).includes("rotate-credentials") && init?.method === "POST");
    expect(JSON.parse(String(rotateCall?.[1]?.body))).toEqual({ credentials: "synthetic-rotated-api-key" });
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
    expect(screen.getByRole("heading", { name: "Состояние подключения" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Права" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Синхронизация" })).toBeInTheDocument();
    expect(screen.getByText("Общение с покупателями")).toBeInTheDocument();
    expect(screen.getByText("Состояние потоков")).toBeInTheDocument();
    expect(screen.getByText("Отзывы")).toBeInTheDocument();
    expect(screen.getByText("История синхронизаций")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить синхронизацию" })).toBeInTheDocument();
    expect(screen.getByText(/Яндекс Маркет временно ограничил частоту запросов/)).toBeInTheDocument();
    expect(screen.queryByText(/must-not-leak|api_key|token/i)).not.toBeInTheDocument();
    for (const forbidden of ["Accounts", "New account", "Selected account", "Credentials", "Connection health", "Permissions", "Scheduler", "Manual sync", "Audit trail"]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("jobs_limit=10"))).toBe(true);
  });
});
