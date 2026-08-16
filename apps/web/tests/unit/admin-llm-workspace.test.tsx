import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminLLMWorkspace } from "../../components/admin/AdminLLMWorkspace";
import { openRouterConfigurationSchema } from "../../lib/api/schemas";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-08-16T12:00:00Z";
const routes = {
  review_model: "openai/review",
  negative_review_model: "anthropic/negative",
  question_model: "google/question",
  chat_model: "openai/chat",
  safety_retry_model: "anthropic/safety",
  fallback_model: "google/fallback",
};
const configuration = {
  provider: "openrouter" as const,
  state: "active" as const,
  source: "database" as const,
  enabled: true,
  credential_fingerprint_masked: "••••••••A1B2",
  validated_at: timestamp,
  updated_at: timestamp,
  routes,
};
const catalog = {
  provider: "openrouter" as const,
  validated_at: timestamp,
  items: Object.values(routes).map((id) => ({
    id,
    name: id,
    input_modalities: ["text"],
    output_modalities: ["text"],
    context_length: 128000,
    prompt_price: "0.000001",
    completion_price: "0.000002",
    expiration_date: null,
  })),
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockWorkspace(isSuperadmin: boolean) {
  const organization = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Системный кабинет",
    slug: "system",
    owner_user_id: "22222222-2222-4222-8222-222222222222",
    plan_id: null,
    default_response_mode: "auto",
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
      is_superadmin: isSuperadmin,
      created_at: timestamp,
      updated_at: timestamp,
    },
    organizations: [organization],
    activeOrganization: organization,
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
      <AdminLLMWorkspace />
    </QueryClientProvider>,
  );
}

describe("AdminLLMWorkspace", () => {
  it("does not issue protected requests for a regular user", () => {
    mockWorkspace(false);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(screen.getByText("Доступ запрещён")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates a candidate key, saves six routes and clears the secret input", async () => {
    mockWorkspace(true);
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as unknown : undefined;
      calls.push({ method, path: url.pathname, body });
      if (method === "GET" && url.pathname === "/api/admin/llm/openrouter") {
        return new Response(JSON.stringify(configuration), { status: 200 });
      }
      if (method === "POST" && url.pathname === "/api/admin/llm/openrouter/validate") {
        return new Response(JSON.stringify(catalog), { status: 200 });
      }
      if (method === "PUT" && url.pathname === "/api/admin/llm/openrouter") {
        return new Response(JSON.stringify(configuration), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    expect(await screen.findByText("Ключ из админки")).toBeInTheDocument();
    expect(screen.getByText("••••••••A1B2")).toBeInTheDocument();
    const keyInput = screen.getByLabelText("Новый inference-ключ OpenRouter");
    expect(keyInput).toHaveAttribute("type", "password");
    expect(keyInput).toHaveValue("");

    fireEvent.change(keyInput, { target: { value: "sk-or-v1-candidate-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить ключ и модели" }));
    expect(await screen.findByText("Доступно моделей: 6")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Сохранить маршруты" }));
    await waitFor(() => expect(keyInput).toHaveValue(""));

    const put = calls.find((call) => call.method === "PUT");
    expect(put?.body).toEqual({ api_key: "sk-or-v1-candidate-key", routes });
    expect(screen.getByRole("status")).toHaveTextContent("Конфигурация сохранена");
  });

  it("states that local deletion does not revoke the provider key", async () => {
    mockWorkspace(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(configuration), { status: 200 })));

    renderWorkspace();

    expect(await screen.findByText(/не отзывает ключ в OpenRouter/i)).toBeInTheDocument();
  });
});

describe("OpenRouter admin response schema", () => {
  it("rejects key material returned by the backend", () => {
    expect(() => openRouterConfigurationSchema.parse({ ...configuration, api_key: "leaked" })).toThrow();
    expect(() => openRouterConfigurationSchema.parse({ ...configuration, api_key_encrypted: "leaked" })).toThrow();
  });
});
