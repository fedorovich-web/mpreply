import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewQueueWorkspace } from "../../components/review-queue/ReviewQueueWorkspace";
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
  status: "waiting_review",
  rating: 2,
  customer_display_name: "Анна К.",
  customer_text: "Обещали заменить товар, но я не понимаю условия.",
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
  reply_text: "Мы обязательно заменим товар завтра.",
  status: "waiting_review",
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
  submitted_for_review_at: timestamp,
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

const safety = {
  decision: "manual_review",
  flags: ["risky_promise", "negative_review"],
  reasons: ["Draft contains an unverified promise or guaranteed outcome"],
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockWorkspace(role: "owner" | "viewer") {
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
    organizations: [{ ...organization, current_user_role: role }],
    activeOrganization: { ...organization, current_user_role: role },
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
      <ReviewQueueWorkspace />
    </QueryClientProvider>,
  );
}

function queueResponse(status = reply.status) {
  return {
    items: [{ reply: { ...reply, status }, message, safety }],
    total: 1,
    page: 1,
    page_size: 20,
  };
}

describe("ReviewQueueWorkspace", () => {
  it("translates internal safety metadata into seller-facing review reasons", async () => {
    mockWorkspace("owner");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(queueResponse()), { status: 200 })),
    );

    renderWorkspace();

    expect(await screen.findByText("Почему требуется внимание")).toBeInTheDocument();
    expect(screen.getByText("В тексте есть обещание результата, которое нужно проверить.")).toBeInTheDocument();
    expect(screen.getByText("Низкая оценка покупателя требует особенно внимательного ответа.")).toBeInTheDocument();
    expect(screen.queryByText("Draft contains an unverified promise or guaranteed outcome")).not.toBeInTheDocument();
    expect(screen.getByText("Обращение покупателя")).toBeInTheDocument();
    expect(screen.getByText("Контекст товара")).toBeInTheDocument();
  });

  it("lets users reach review items after the first 20 results", async () => {
    mockWorkspace("owner");
    const pageTwoMessage = {
      ...message,
      id: "77777777-7777-4777-8777-777777777777",
      external_id: "wb-message-21",
      product: { ...message.product, id: "88888888-8888-4888-8888-888888888888", name: "Товар 21" },
    };
    const pageTwoReply = {
      ...reply,
      id: "99999999-9999-4999-8999-999999999999",
      message_id: pageTwoMessage.id,
    };
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("page=2")) {
        return new Response(
          JSON.stringify({
            items: [{ reply: pageTwoReply, message: pageTwoMessage, safety }],
            total: 21,
            page: 2,
            page_size: 20,
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ items: [{ reply, message, safety }], total: 21, page: 1, page_size: 20 }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByText("Страница 1 из 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(await screen.findByText("Страница 2 из 2")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Товар 21/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("page=2"))).toBe(true);
  });

  it("keeps loaded review work visible when a manual refresh fails", async () => {
    mockWorkspace("owner");
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      requests += 1;
      if (requests === 1) {
        return new Response(JSON.stringify(queueResponse()), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "temporary failure" }), { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByText("Почему требуется внимание")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));

    const refreshError = await screen.findByRole("alert");
    expect(refreshError).toHaveTextContent("Не удалось обновить очередь проверки");
    expect(screen.getByText("Почему требуется внимание")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("translates a safety approval conflict into seller-facing copy", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/replies/review-queue")) {
        return new Response(JSON.stringify(queueResponse()), { status: 200 });
      }
      if (url.includes(`/api/replies/${reply.id}/approve`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({ detail: "SafetyGate blocked this reply. Reject it back to draft and edit the text" }),
          { status: 409 },
        );
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "Одобрить ответ" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Ответ нельзя одобрить в текущем виде");
    expect(error).not.toHaveTextContent("SafetyGate");
  });

  it("shows viewer role as read-only before any mutation is attempted", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify(queueResponse()), { status: 200 })),
    );

    renderWorkspace();

    const editor = await screen.findByLabelText("Ответ покупателю");
    expect(editor).toBeDisabled();
    expect(screen.getByText(/Ваша роль позволяет просматривать очередь/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Одобрить ответ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вернуть на доработку" })).not.toBeInTheDocument();
  });

  it("submits an unchanged draft through the existing live review endpoint", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/replies/review-queue")) {
        return new Response(JSON.stringify(queueResponse("draft")), { status: 200 });
      }
      if (url.includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            reply: { ...reply, status: "waiting_review" },
            safety,
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    const submit = await screen.findByRole("button", { name: "Передать на проверку" });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});