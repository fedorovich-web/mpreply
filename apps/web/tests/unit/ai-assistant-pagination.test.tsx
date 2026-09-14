import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AIAssistantWorkspace } from "../../components/ai-assistant/AIAssistantWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({
  useWorkspace: vi.fn(),
}));

const timestamp = "2026-09-14T06:00:00Z";
const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "manager" as const,
  created_at: timestamp,
  updated_at: timestamp,
};
const secondOrganization = {
  ...organization,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Second Store",
  slug: "second-store",
};

const firstMessage = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: "44444444-4444-4444-8444-444444444444",
  product_id: "55555555-5555-4555-8555-555555555555",
  marketplace: "wildberries",
  external_id: "message-1",
  type: "review",
  status: "needs_reply",
  rating: 5,
  customer_display_name: "Покупатель",
  customer_text: "Первое обращение",
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

const message51 = {
  ...firstMessage,
  id: "66666666-6666-4666-8666-666666666666",
  product_id: "77777777-7777-4777-8777-777777777777",
  external_id: "message-51",
  customer_text: "Пятьдесят первое обращение",
  product: {
    ...firstMessage.product,
    id: "77777777-7777-4777-8777-777777777777",
    external_id: "product-51",
    sku: "SKU-51",
    name: "Товар 51",
  },
};
const secondOrganizationMessage = {
  ...firstMessage,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  organization_id: secondOrganization.id,
  external_id: "second-store-message-1",
  customer_text: "Обращение второго магазина",
  product: {
    ...firstMessage.product,
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    external_id: "second-product-1",
    sku: "SECOND-1",
    name: "Товар второго магазина",
  },
};

const mockedUseWorkspace = vi.mocked(useWorkspace);
const user = {
  id: organization.owner_user_id,
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  is_superadmin: false,
  created_at: timestamp,
  updated_at: timestamp,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockActiveOrganization(activeOrganization = organization) {
  mockedUseWorkspace.mockReturnValue({
    user,
    organizations: [organization, secondOrganization],
    activeOrganization,
    setActiveOrganizationId: vi.fn(),
    logout: vi.fn(),
    isLoggingOut: false,
    logoutError: null,
  });
}

function renderWorkspace() {
  mockActiveOrganization();

  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes("/api/messages")) {
      if (url.includes(secondOrganization.id)) {
        if (url.includes("page=2")) {
          return new Response(JSON.stringify({ items: [], total: 1, page: 2, page_size: 50 }), { status: 200 });
        }
        return new Response(JSON.stringify({ items: [secondOrganizationMessage], total: 1, page: 1, page_size: 50 }), { status: 200 });
      }
      if (url.includes("page=2")) {
        return new Response(JSON.stringify({ items: [message51], total: 51, page: 2, page_size: 50 }), { status: 200 });
      }
      return new Response(JSON.stringify({ items: [firstMessage], total: 51, page: 1, page_size: 50 }), { status: 200 });
    }
    if (url.includes("/api/ai/drafts")) {
      return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
    }
    return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AIAssistantWorkspace />
    </QueryClientProvider>,
  );
  return { fetchMock, queryClient, ...view };
}

describe("AIAssistantWorkspace message pagination", () => {
  it("lets the user reach messages after the first 50 results", async () => {
    const { fetchMock } = renderWorkspace();

    expect(await screen.findByText("Страница 1 из 2")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Товар 1/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Следующая страница обращений" }));

    expect(await screen.findByText("Страница 2 из 2")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Товар 51/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page=2"))).toBe(true);
  });

  it("returns to the first message page when the active workspace changes", async () => {
    const { queryClient, rerender } = renderWorkspace();

    expect(await screen.findByText("Страница 1 из 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница обращений" }));
    expect(await screen.findByText("Страница 2 из 2")).toBeInTheDocument();

    mockActiveOrganization(secondOrganization);
    rerender(
      <QueryClientProvider client={queryClient}>
        <AIAssistantWorkspace />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: /Товар второго магазина/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Товар 51/ })).not.toBeInTheDocument();
  });
});
