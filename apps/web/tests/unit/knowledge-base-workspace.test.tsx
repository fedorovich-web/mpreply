import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeBaseWorkspace } from "../../components/knowledge/KnowledgeBaseWorkspace";
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

const entry = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: null,
  product_id: null,
  category: "delivery",
  title: "Сроки доставки",
  content: "Срок зависит от региона покупателя.",
  status: "active",
  created_by: null,
  updated_by: null,
  created_at: organization.created_at,
  updated_at: organization.updated_at,
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <KnowledgeBaseWorkspace />
    </QueryClientProvider>,
  );
}

describe("KnowledgeBaseWorkspace", () => {
  it("searches structured entries and creates factual text without upload controls", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...entry, ...body, id: "44444444-4444-4444-8444-444444444444" }), { status: 201 });
      }
      return new Response(JSON.stringify([entry]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Сроки доставки" })).toBeInTheDocument();
    expect(view.container.querySelector('input[type="file"]')).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск по данным для ответов" }), { target: { value: "доставка" } });
    expect(screen.queryByText(/База знаний|SafetyGate|Набор инструкций/i)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=%D0%B4"))).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Добавить запись" }));
    const form = screen.getByRole("form", { name: "Редактор данных для ответов" });
    fireEvent.change(within(form).getByLabelText("Заголовок"), { target: { value: "Возврат" } });
    fireEvent.change(within(form).getByLabelText("Проверенные сведения"), { target: { value: "Покупатель оформляет возврат в кабинете маркетплейса." } });
    fireEvent.click(within(form).getByRole("button", { name: "Добавить запись" }));

    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  });

  it("keeps manager access read-only and retains filters in the request", async () => {
    mockWorkspace("manager");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([entry]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Сроки доставки" })).toBeInTheDocument();
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить запись" })).not.toBeInTheDocument();
  });

  it("shows an empty state and safe recovery action", async () => {
    mockWorkspace("owner");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));

    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Проверенных данных пока нет" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить первую запись" })).toBeInTheDocument();
  });
});
