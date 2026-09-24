import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const message = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: "44444444-4444-4444-8444-444444444444",
  product_id: "55555555-5555-4555-8555-555555555555",
  marketplace: "wildberries",
  external_id: "wb-message-1",
  type: "review",
  status: "needs_reply",
  rating: 3,
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
    name: "Тестовый товар",
    brand: "MPReply",
    category: "Тест",
    image_url: null,
    product_url: null,
  },
  created_at: timestamp,
  updated_at: timestamp,
};

const reply = {
  id: "66666666-6666-4666-8666-666666666666",
  organization_id: organization.id,
  message_id: message.id,
  ai_draft_id: null,
  automation_rule_id: null,
  reply_text: "Спасибо за обратную связь. Проверим упаковку.",
  status: "draft",
  mode: "semi_auto",
  revision: 1,
  idempotency_key: null,
  worker_message_id: null,
  attempt_count: 0,
  max_attempts: 3,
  last_attempt_at: null,
  next_retry_at: null,
  error_code: null,
  created_by: organization.owner_user_id,
  approved_by: null,
  sent_by: null,
  submitted_for_review_at: null,
  approved_at: null,
  rejected_at: null,
  rejection_reason: null,
  marketplace_reply_id: null,
  sent_at: null,
  failed_reason: null,
  metadata_json: {},
  created_at: timestamp,
  updated_at: timestamp,
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.restoreAllMocks();
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
    logout: vi.fn(async () => undefined),
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

describe("InboxWorkspace", () => {
  it("applies marketplace as a real server-side queue filter", async () => {
    mockWorkspace();
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 100 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByText("Тестовый товар")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    const filters = screen.getByRole("complementary", { name: "Фильтры обращений" });
    fireEvent.click(within(filters).getByRole("button", { name: "Ozon" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("marketplace=ozon")),
      ).toBe(true);
    });
  });

  it("keeps the queue usable when browser storage is unavailable", async () => {
    mockWorkspace();
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 100 }), { status: 200 }),
      ),
    );

    renderWorkspace();

    expect(await screen.findByText("Тестовый товар")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    expect(screen.getByRole("complementary", { name: "Фильтры обращений" })).toBeVisible();
    expect(getItemSpy).toHaveBeenCalled();
    await waitFor(() => expect(setItemSpy).toHaveBeenCalled());
  });

  it("keeps the loaded queue visible when a manual refresh fails", async () => {
    mockWorkspace();
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      requests += 1;
      if (requests === 1) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 100 }), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "temporary failure" }), { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByText("Тестовый товар")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));

    const refreshError = await screen.findByRole("alert");
    expect(refreshError).toHaveTextContent("Не удалось обновить обращения");
    expect(screen.getByText("Тестовый товар")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("routes approved replies back to review workflow and hides conflicting message actions", async () => {
    mockWorkspace();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ items: [{ ...message, status: "approved" }], total: 1, page: 1, page_size: 100 }),
          { status: 200 },
        ),
      ),
    );

    renderWorkspace();

    await screen.findByText("Тестовый товар");
    fireEvent.click(screen.getByRole("button", { name: "Открыть обращение: Тестовый товар" }));
    expect(await screen.findByText("Ответ одобрен и ожидает отправки")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть очередь проверки" })).toHaveAttribute("href", "/app/review-queue");
    expect(screen.queryByLabelText("Ответ для проверки")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Передать менеджеру" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Архивировать" })).not.toBeInTheDocument();
  });

  it("creates a manual reply and actually submits it to review from the inbox", async () => {
    mockWorkspace();
    let messageRequests = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        messageRequests += 1;
        const currentMessage = messageRequests > 1 ? { ...message, status: "waiting_review" } : message;
        return new Response(JSON.stringify({ items: [currentMessage], total: 1, page: 1, page_size: 100 }), { status: 200 });
      }
      if (url.endsWith("/api/replies/manual") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ reply, safety: { decision: "allow", flags: [], reasons: [] } }),
          { status: 201 },
        );
      }
      if (url.includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            reply: { ...reply, status: "waiting_review", submitted_for_review_at: timestamp },
            safety: { decision: "allow", flags: [], reasons: [] },
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    await screen.findByText("Тестовый товар");
    fireEvent.click(screen.getByRole("button", { name: "Открыть обращение: Тестовый товар" }));
    const editor = await screen.findByLabelText("Ответ для проверки");
    fireEvent.change(editor, { target: { value: reply.reply_text } });
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST",
        ),
      ).toBe(true);
    });

    expect(await screen.findByText("Ответ передан на проверку")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText("Ответ для проверки")).not.toBeInTheDocument();
    });
  });

  it("does not offer a duplicate draft when draft creation succeeded but review submission failed", async () => {
    mockWorkspace();
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 100 }), { status: 200 });
      }
      if (url.endsWith("/api/replies/manual") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ reply, safety: { decision: "allow", flags: [], reasons: [] } }),
          { status: 201 },
        );
      }
      if (url.includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST") {
        return new Response(JSON.stringify({ detail: "Review service unavailable" }), { status: 503 });
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    await screen.findByText("Тестовый товар");
    fireEvent.click(screen.getByRole("button", { name: "Открыть обращение: Тестовый товар" }));
    const editor = await screen.findByLabelText("Ответ для проверки");
    fireEvent.change(editor, { target: { value: reply.reply_text } });
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));

    const recovery = await screen.findByRole("alert");
    expect(recovery).toHaveTextContent("Черновик создан, но не удалось передать его на проверку");
    expect(within(recovery).getByRole("link", { name: "Открыть очередь проверки" })).toHaveAttribute(
      "href",
      "/app/review-queue",
    );
    expect(screen.queryByLabelText("Ответ для проверки")).not.toBeInTheDocument();
  });
});
