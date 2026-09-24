import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxWorkspace } from "../../components/inbox/InboxWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-09-12T18:00:00Z";
const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "semi_auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: timestamp,
  updated_at: timestamp,
};

const baseMessage = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: "44444444-4444-4444-8444-444444444444",
  product_id: "55555555-5555-4555-8555-555555555555",
  marketplace: "wildberries",
  external_id: "wb-message-1",
  type: "review",
  status: "needs_reply",
  rating: 3 as number | null,
  customer_display_name: "Анна К.",
  customer_text: "Товар хороший, но упаковка была повреждена.",
  customer_photos_json: [],
  marketplace_created_at: timestamp,
  imported_at: timestamp,
  last_synced_at: timestamp,
  assigned_to: null,
  priority: "normal",
  metadata_json: {},
  product: {
    id: "55555555-5555-4555-8555-555555555555",
    external_id: "product-1",
    sku: "SKU-1",
    name: "Товар 1",
    brand: "MPReply",
    category: "Тест",
    image_url: null,
    product_url: null,
  },
  created_at: timestamp,
  updated_at: timestamp,
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockWorkspace() {
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
    logout: vi.fn(),
    isLoggingOut: false,
    logoutError: null,
    locale: "ru",
  });
}

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InboxWorkspace />
    </QueryClientProvider>,
  );
}

function installPagedMessages() {
  const pageTwoMessage = {
    ...baseMessage,
    id: "77777777-7777-4777-8777-777777777777",
    external_id: "wb-message-101",
    rating: null,
    product: {
      ...baseMessage.product,
      id: "88888888-8888-4888-8888-888888888888",
      name: "Товар 101",
    },
  };
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes("page=2")) {
      return new Response(
        JSON.stringify({ items: [pageTwoMessage], total: 9, page: 2, page_size: 8 }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ items: [baseMessage], total: 9, page: 1, page_size: 8 }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("InboxWorkspace pagination", () => {
  it("lets users reach messages after the first compact page", async () => {
    mockWorkspace();
    const fetchMock = installPagedMessages();

    renderWorkspace();

    expect(await screen.findByText("Страница 1 из 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(await screen.findByText("Страница 2 из 2")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Товар 101/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page=2"))).toBe(true);
  });

  it("keeps the unrated fallback honest and navigable across server pages", async () => {
    mockWorkspace();
    installPagedMessages();

    renderWorkspace();

    expect(await screen.findByRole("button", { name: /Товар 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    const filters = screen.getByRole("complementary", { name: "Фильтры обращений" });
    fireEvent.click(within(filters).getByRole("button", { name: "Без оценки" }));

    expect(await screen.findByText("0 без оценки на странице")).toBeInTheDocument();
    expect(screen.getByText("На этой странице обращений без оценки нет")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(await screen.findByText("1 без оценки на странице")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Товар 101/ })).toBeInTheDocument();
  });
});
