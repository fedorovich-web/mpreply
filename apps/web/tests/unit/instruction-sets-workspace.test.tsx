import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstructionSetsWorkspace } from "../../components/instruction-sets/InstructionSetsWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: "2026-08-13T06:00:00Z",
  updated_at: "2026-08-13T06:00:00Z",
};

const instructionSet = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  name: "Основной стиль",
  response_tone: "friendly",
  brand_rules: "Обращаться на Вы.",
  reply_signature: "Команда магазина",
  prohibited_phrases: ["гарантируем"],
  status: "active",
  is_default: true,
  created_by: null,
  updated_by: null,
  created_at: "2026-08-13T06:00:00Z",
  updated_at: "2026-08-13T06:00:00Z",
};

const account = {
  id: "44444444-4444-4444-8444-444444444444",
  organization_id: organization.id,
  marketplace: "wildberries",
  display_name: "Основной кабинет WB",
  seller_id: null,
  status: "active",
  credentials_masked: "***1234",
  credentials_status: "valid",
  scopes_json: {},
  default_response_mode: "auto",
  ai_instruction_set_id: instructionSet.id,
  last_success_sync_at: null,
  last_error_sync_at: null,
  error_count: 0,
  created_at: "2026-08-13T06:00:00Z",
  updated_at: "2026-08-13T06:00:00Z",
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => vi.unstubAllGlobals());

function mockWorkspace(role: "owner" | "admin" | "manager" | "viewer") {
  const activeOrganization = { ...organization, current_user_role: role };
  mockedUseWorkspace.mockReturnValue({
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "owner@example.com",
      name: "Owner",
      status: "active",
      is_superadmin: false,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
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
      <InstructionSetsWorkspace />
    </QueryClientProvider>,
  );
}

describe("InstructionSetsWorkspace", () => {
  it("loads policies, creates a set once and exposes account assignment", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("marketplace-accounts") && init?.method !== "PATCH") {
        return new Response(JSON.stringify([account]), { status: 200 });
      }
      if (init?.method === "POST" && url.endsWith("/instruction-sets")) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...instructionSet, ...body, id: "55555555-5555-4555-8555-555555555555", is_default: false }), { status: 201 });
      }
      return new Response(JSON.stringify([instructionSet]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Основной стиль" })).toBeInTheDocument();
    expect(screen.getByLabelText("Набор для кабинета Основной кабинет WB")).toHaveValue(instructionSet.id);
    fireEvent.click(screen.getByRole("button", { name: "Создать набор" }));
    const form = screen.getByRole("form", { name: "Редактор набора инструкций" });
    fireEvent.change(within(form).getByLabelText("Название"), { target: { value: "Стиль поддержки" } });
    fireEvent.click(within(form).getByRole("button", { name: "Создать набор" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  });

  it("shows explicit read-only access and no write actions for a viewer", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal("fetch", vi.fn(async (input) => (
      new Response(JSON.stringify(String(input).includes("marketplace-accounts") ? [account] : [instructionSet]), { status: 200 })
    )));

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Основной стиль" })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Создать набор" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Набор для кабинета Основной кабинет WB")).toBeDisabled();
  });

  it("renders a retry action after a safe loading error", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Временно недоступно" }), { status: 503 })));

    renderWorkspace();

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить наборы");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });
});
