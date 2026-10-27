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

function mockWorkspace(role: "owner" | "viewer", locale: "ru" | "en" = "ru") {
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
    locale,
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
  it("adopts refreshed reply text when there are no unsaved edits", async () => {
    mockWorkspace("owner");
    let requests = 0;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => {
      requests += 1;
      const data = queueResponse("draft");
      if (requests > 1) data.items[0].reply = { ...data.items[0].reply, revision: 2, reply_text: "Обновлённый ответ." };
      return Response.json(data);
    }));
    renderWorkspace();

    expect(await screen.findByLabelText("Ответ покупателю")).toHaveValue(reply.reply_text);
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(screen.getByLabelText("Ответ покупателю")).toHaveValue("Обновлённый ответ."));
    expect(screen.getByRole("button", { name: "Сохранить правки" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Передать на проверку" })).toBeEnabled();
  });

  it("preserves unsaved edits and their original revision when refreshed data changes", async () => {
    mockWorkspace("owner");
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PATCH") {
        return Response.json({ detail: "Reply revision changed" }, { status: 409 });
      }
      requests += 1;
      const data = queueResponse("draft");
      if (requests > 1) {
        data.items[0].reply = { ...data.items[0].reply, revision: 2, reply_text: "Изменение другого сотрудника." };
      }
      return Response.json(data);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    fireEvent.change(await screen.findByLabelText("Ответ покупателю"), { target: { value: "Мой несохранённый ответ." } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить правки" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(requests).toBe(2));
    await waitFor(() => expect(screen.getByLabelText("Ответ покупателю")).toHaveValue("Мой несохранённый ответ."));

    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ reply_text: "Мой несохранённый ответ.", expected_revision: 1 });
    expect(screen.getByLabelText("Ответ покупателю")).toHaveValue("Мой несохранённый ответ.");
  });

  it.each(["ru", "en"] as const)("recovers from a revision conflict only after explicitly adopting the server text (%s)", async (locale) => {
    mockWorkspace("owner", locale);
    let requests = 0;
    let saved = false;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PATCH") {
        saved = true;
        return Response.json({ reply: { ...reply, status: "draft", revision: 3, reply_text: "Новый согласованный ответ." }, safety });
      }
      requests += 1;
      const data = queueResponse("draft");
      if (requests > 1) data.items[0].reply = { ...data.items[0].reply, revision: saved ? 3 : 2, reply_text: saved ? "Новый согласованный ответ." : "Текущий ответ сотрудника." };
      return Response.json(data);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    const editorLabel = locale === "ru" ? "Ответ покупателю" : "Reply to customer";
    const saveLabel = locale === "ru" ? "Сохранить правки" : "Save changes";
    fireEvent.change(await screen.findByLabelText(editorLabel), { target: { value: "Мой несохранённый ответ." } });
    fireEvent.click(screen.getByRole("button", { name: locale === "ru" ? "Обновить" : "Refresh" }));

    expect(await screen.findByText("Текущий ответ сотрудника.")).toBeVisible();
    expect(screen.getByLabelText(editorLabel)).toHaveValue("Мой несохранённый ответ.");
    expect(screen.getByRole("button", { name: saveLabel })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: locale === "ru" ? "Использовать обновлённый текст" : "Use updated text" }));
    expect(screen.getByLabelText(editorLabel)).toHaveValue("Текущий ответ сотрудника.");
    fireEvent.change(screen.getByLabelText(editorLabel), { target: { value: "Новый согласованный ответ." } });
    fireEvent.click(screen.getByRole("button", { name: saveLabel }));
    await waitFor(() => expect(screen.getByRole("button", { name: saveLabel })).toBeDisabled());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ reply_text: "Новый согласованный ответ.", expected_revision: 2 });
    expect(screen.getByLabelText(editorLabel)).toHaveValue("Новый согласованный ответ.");
  });

  it.each([
    ["waiting_review", "Одобрить ответ"],
    ["approved", "Отправить в маркетплейс"],
  ])("preserves dirty text across a background %s transition and blocks decisions until adoption", async (status, actionLabel) => {
    mockWorkspace("owner");
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(queueResponse(++requests === 1 ? "draft" : status)));
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    fireEvent.change(await screen.findByLabelText("Ответ покупателю"), { target: { value: "Несохранённый текст." } });
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));

    expect(await screen.findByRole("button", { name: actionLabel })).toBeDisabled();
    expect(screen.getByLabelText("Ответ покупателю")).toHaveValue("Несохранённый текст.");
    fireEvent.click(screen.getByRole("button", { name: "Использовать обновлённый текст" }));
    expect(screen.getByLabelText("Ответ покупателю")).toHaveValue(reply.reply_text);
    expect(screen.getByRole("button", { name: actionLabel })).toBeEnabled();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === undefined)).toBe(true);
  });

  it("keeps the acknowledged saved text and revision when the following queue refresh fails", async () => {
    mockWorkspace("owner");
    let requests = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { reply_text: string; expected_revision: number };
        return Response.json({ reply: { ...reply, status: "draft", revision: body.expected_revision + 1, reply_text: body.reply_text }, safety });
      }
      requests += 1;
      return requests === 1 ? Response.json(queueResponse("draft")) : Response.json({ detail: "unavailable" }, { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    fireEvent.change(await screen.findByLabelText("Ответ покупателю"), { target: { value: "Сохранённый текст." } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить правки" }));

    await screen.findByText("Не удалось обновить очередь проверки");
    await waitFor(() => expect(screen.getByLabelText("Ответ покупателю")).toHaveValue("Сохранённый текст."));
    expect(screen.getByRole("button", { name: "Сохранить правки" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ответ покупателю"), { target: { value: "Следующая правка." } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить правки" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(2));
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(String(patches[1][1]?.body))).toEqual({ reply_text: "Следующая правка.", expected_revision: 2 });
  });

  it("does not reuse a typed rejection reason after the reply leaves and returns to review", async () => {
    mockWorkspace("owner");
    let requests = 0;
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => Response.json(queueResponse(++requests === 2 ? "approved" : "waiting_review"))));
    renderWorkspace();
    fireEvent.change(await screen.findByLabelText("Причина возврата на доработку"), { target: { value: "Старое замечание." } });
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await screen.findByRole("button", { name: "Отправить в маркетплейс" });
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    expect(await screen.findByLabelText("Причина возврата на доработку")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Вернуть на доработку" })).toBeDisabled();
  });

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
