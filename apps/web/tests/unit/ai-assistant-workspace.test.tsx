import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AIAssistantWorkspace } from "../../components/ai-assistant/AIAssistantWorkspace";
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
  current_user_role: "manager" as const,
  created_at: timestamp,
  updated_at: timestamp,
};

const message = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: organization.id,
  marketplace_account_id: "44444444-4444-4444-8444-444444444444",
  product_id: "77777777-7777-4777-8777-777777777777",
  marketplace: "wildberries",
  external_id: "wb-review-1",
  type: "review",
  status: "needs_reply",
  rating: 2,
  customer_display_name: "Покупатель",
  customer_text: "Коробка пришла повреждённой. Что делать?",
  customer_photos_json: [],
  marketplace_created_at: timestamp,
  imported_at: timestamp,
  last_synced_at: timestamp,
  assigned_to: null,
  priority: "normal",
  metadata_json: {},
  product: {
    id: "77777777-7777-4777-8777-777777777777",
    external_id: "wb-product-1",
    sku: "SKU-1",
    name: "Термокружка",
    brand: "MPReply Test",
    category: "Посуда",
    image_url: null,
    product_url: null,
  },
  created_at: timestamp,
  updated_at: timestamp,
};

const chatMessage = {
  ...message,
  id: "88888888-8888-4888-8888-888888888888",
  external_id: "avito-chat-1",
  marketplace: "avito",
  type: "chat",
  rating: null,
  customer_text: "Здравствуйте, когда сможете отправить заказ?",
};

const draft = {
  id: "55555555-5555-4555-8555-555555555555",
  organization_id: organization.id,
  message_id: message.id,
  provider: "groq",
  model: "qwen/qwen3.8-27b",
  prompt_version: "marketplace-reply-v1",
  draft_text: "Сожалеем, что коробка пришла повреждённой. Пожалуйста, оформите обращение через площадку.",
  tokens_input: 320,
  tokens_output: 54,
  latency_ms: 840,
  cost_estimate: 0.0042,
  confidence_score: 0.91,
  safety_flags_json: [],
  created_by: organization.owner_user_id,
  created_at: timestamp,
  updated_at: timestamp,
};

const reply = {
  id: "99999999-9999-4999-8999-999999999999",
  organization_id: organization.id,
  message_id: message.id,
  ai_draft_id: draft.id,
  automation_rule_id: null,
  reply_text: draft.draft_text,
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

const safety = { decision: "allow", flags: [], reasons: [] };
const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
      <AIAssistantWorkspace />
    </QueryClientProvider>,
  );
}

describe("AIAssistantWorkspace", () => {
  it("preserves the newer generation key when an earlier message finishes during its pending request", async () => {
    mockWorkspace("manager");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const nextMessage = { ...chatMessage, product: { ...message.product, name: "Другой товар" } };
    const nextDraft = { ...draft, message_id: nextMessage.id };
    let finishFirst!: (response: Response) => void;
    let failSecond!: (error: Error) => void;
    const firstGeneration = new Promise<Response>((resolve) => { finishFirst = resolve; });
    const secondGeneration = new Promise<Response>((_resolve, reject) => { failSecond = reject; });
    const nextKeys: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) return Response.json({ items: [message, nextMessage], total: 2, page: 1, page_size: 50 });
      if (url.endsWith("/api/ai/drafts/generate")) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if (body.message_id === message.id) return firstGeneration;
        nextKeys.push(body.operation_key);
        return nextKeys.length === 1 ? secondGeneration : Response.json(nextDraft);
      }
      if (url.includes("/api/ai/drafts")) return Response.json({ items: [], total: 0 });
      throw new Error(`Unexpected request: ${url}`);
    }));
    renderWorkspace();
    await screen.findByRole("button", { name: /Термокружка/ });
    fireEvent.click(screen.getByRole("button", { name: "Подготовить черновик" }));
    fireEvent.click(screen.getByRole("button", { name: /Другой товар/ }));
    fireEvent.click(screen.getByRole("button", { name: "Подготовить черновик" }));
    await waitFor(() => expect(nextKeys).toHaveLength(1));
    await act(async () => { finishFirst(Response.json(draft)); await firstGeneration; });
    await act(async () => { failSecond(new TypeError("Lost response")); await secondGeneration.catch(() => undefined); });
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Подготовить черновик" }));
    await screen.findByLabelText("Ответ для проверки");
    expect(nextKeys).toHaveLength(2);
    expect(nextKeys[1]).toBe(nextKeys[0]);
  });

  it.each(["select", "refresh"])("keeps delayed manual-reply errors on their original draft after a message %s", async (change) => {
    mockWorkspace("manager");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const nextMessage = { ...chatMessage, product: { ...message.product, name: "Другой товар" } };
    const nextDraft = { ...draft, id: "66666666-6666-4666-8666-666666666666", message_id: nextMessage.id, draft_text: "Ответ для другого обращения" };
    let finishCreate!: (response: Response) => void;
    let hideFirst = false;
    const pendingCreate = new Promise<Response>((resolve) => { finishCreate = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/api/messages")) return Response.json({ items: hideFirst ? [nextMessage] : [message, nextMessage], total: hideFirst ? 1 : 2, page: 1, page_size: 50 });
      if (url.includes("/api/ai/drafts")) return Response.json({ items: [new URL(url).searchParams.get("message_id") === message.id ? draft : nextDraft], total: 1 });
      if (url.endsWith("/api/replies/manual")) return pendingCreate;
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await screen.findByLabelText("Ответ для проверки");
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/api/replies/manual"))).toBe(true));
    if (change === "refresh") {
      hideFirst = true;
      fireEvent.click(screen.getByRole("button", { name: "Обновить обращения" }));
    } else fireEvent.click(screen.getByRole("button", { name: /Другой товар/ }));
    await waitFor(() => expect(screen.getByLabelText("Ответ для проверки")).toHaveValue(nextDraft.draft_text));
    await act(async () => { finishCreate(new Response("{}", { status: 503 })); await pendingCreate; });
    await waitFor(() => expect(screen.getByRole("button", { name: "Передать на проверку" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    if (change === "refresh") {
      hideFirst = false;
      fireEvent.click(screen.getByRole("button", { name: "Обновить обращения" }));
    } else fireEvent.click(screen.getByRole("button", { name: /Термокружка/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось сохранить ответ. Попробуйте ещё раз.");
  });

  it.each([
    { status: 200, retry: false }, { status: 503, retry: false },
    { status: 200, retry: true }, { status: 503, retry: true },
  ])("keeps a delayed review handoff ($status, retry=$retry) attached to its original draft after switching messages", async ({ status, retry }) => {
    mockWorkspace("manager");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const nextMessage = { ...chatMessage, product: { ...message.product, name: "Другой товар" } };
    const nextDraft = { ...draft, id: "66666666-6666-4666-8666-666666666666", message_id: nextMessage.id, draft_text: "Ответ для другого обращения" };
    let finishSubmit!: (response: Response) => void;
    let submitAttempts = 0;
    const pendingSubmit = new Promise<Response>((resolve) => { finishSubmit = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/api/messages")) return Response.json({ items: [message, nextMessage], total: 2, page: 1, page_size: 50 });
      if (url.includes("/api/ai/drafts")) {
        const currentDraft = new URL(url).searchParams.get("message_id") === message.id ? draft : nextDraft;
        return Response.json({ items: [currentDraft], total: 1 });
      }
      if (url.endsWith("/api/replies/manual")) return Response.json({ reply, safety });
      if (url.endsWith("/submit-review")) {
        submitAttempts += 1;
        if (retry && submitAttempts === 1) return new Response("{}", { status: 503 });
        return pendingSubmit;
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await screen.findByLabelText("Ответ для проверки");
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));
    if (retry) fireEvent.click(await screen.findByRole("button", { name: "Попробовать ещё раз" }));
    await waitFor(() => expect(submitAttempts).toBe(retry ? 2 : 1));
    fireEvent.click(screen.getByRole("button", { name: /Другой товар/ }));
    await waitFor(() => expect(screen.getByLabelText("Ответ для проверки")).toHaveValue(nextDraft.draft_text));
    fireEvent.click(screen.getByRole("button", { name: /Термокружка/ }));
    expect(await screen.findByRole("button", { name: "Передаём..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Другой товар/ }));
    await waitFor(() => expect(screen.getByLabelText("Ответ для проверки")).toHaveValue(nextDraft.draft_text));
    await act(async () => {
      finishSubmit(status === 200 ? Response.json({ reply: { ...reply, status: "waiting_review" }, safety }) : new Response("{}", { status }));
      await pendingSubmit;
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Передать на проверку" })).toBeEnabled());
    expect(screen.queryByText("Ответ передан на проверку")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Попробовать ещё раз" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Термокружка/ }));
    expect(await screen.findByText(status === 200 ? "Ответ передан на проверку" : "Ответ сохранён, но пока не передан на проверку")).toBeInTheDocument();
  });

  it("keeps the generation key after a lost response and uses a new key for a new variant", async () => {
    mockWorkspace("manager");
    const keys: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }));
      }
      if (url.includes("/api/ai/drafts/generate")) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        keys.push(body.operation_key);
        if (keys.length === 1) throw new TypeError("Lost response");
        return new Response(JSON.stringify(draft));
      }
      if (url.includes("/api/ai/drafts")) return new Response(JSON.stringify({ items: [], total: 0 }));
      throw new Error("Unexpected request");
    }));
    renderWorkspace();
    await screen.findByRole("button", { name: /Термокружка/ });
    const form = screen.getByRole("form", { name: "Настройки подготовки черновика ответа" });
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));
    await screen.findByRole("alert");
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));
    await screen.findByLabelText("Ответ для проверки");
    expect(keys[0]).toEqual(keys[1]);
    expect(keys[0]).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    fireEvent.click(screen.getByRole("button", { name: "Подготовить другой вариант" }));
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[2]).not.toEqual(keys[1]);
  });

  it("starts a fresh attempt only after the API confirms the old reservation was released", async () => {
    mockWorkspace("manager");
    const keys: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }));
      }
      if (url.includes("/api/ai/drafts/generate")) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        keys.push(body.operation_key);
        if (keys.length === 1) return new Response(JSON.stringify({ detail: "Provider failed" }), { status: 502 });
        if (keys.length === 2) return new Response(JSON.stringify({ detail: "Reservation released" }), { status: 410 });
        return new Response(JSON.stringify(draft));
      }
      if (url.includes("/api/ai/drafts")) return new Response(JSON.stringify({ items: [], total: 0 }));
      throw new Error("Unexpected request");
    }));
    renderWorkspace();
    await screen.findByRole("button", { name: /Термокружка/ });
    const form = screen.getByRole("form", { name: "Настройки подготовки черновика ответа" });
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));
    await screen.findByRole("alert");
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));
    await screen.findByLabelText("Ответ для проверки");
    expect(keys).toHaveLength(3);
    expect(keys[0]).toEqual(keys[1]);
    expect(keys[2]).not.toEqual(keys[1]);
  });

  it("lets a manager generate, edit and hand an AI draft to the live review queue", async () => {
    mockWorkspace("manager");
    const editedReply = `${draft.draft_text} Мы проверим детали обращения.`;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }), { status: 200 });
      }
      if (url.includes("/api/ai/drafts/generate") && init?.method === "POST") {
        return new Response(JSON.stringify(draft), { status: 200 });
      }
      if (url.includes("/api/ai/drafts")) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.endsWith("/api/replies/manual") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ reply: { ...reply, reply_text: editedReply }, safety }),
          { status: 201 },
        );
      }
      if (url.includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            reply: { ...reply, reply_text: editedReply, status: "waiting_review", submitted_for_review_at: timestamp },
            safety,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByRole("button", { name: /Термокружка/ })).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Настройки подготовки черновика ответа" });
    fireEvent.change(within(form).getByLabelText("Тон ответа"), { target: { value: "friendly" } });
    fireEvent.change(within(form).getByLabelText("Как должен звучать ответ"), { target: { value: "Обращаться на Вы" } });
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));

    const editor = await screen.findByLabelText("Ответ для проверки");
    expect(editor).toHaveValue(draft.draft_text);
    expect(screen.getByText("Проверка пройдена")).toBeInTheDocument();
    expect(screen.queryByText("groq")).not.toBeInTheDocument();
    expect(screen.queryByText("qwen/qwen3.8-27b")).not.toBeInTheDocument();

    fireEvent.change(editor, { target: { value: editedReply } });
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));

    expect(await screen.findByText("Ответ передан на проверку")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть очередь проверки" })).toHaveAttribute("href", "/app/review-queue");

    const generateCall = fetchMock.mock.calls.find(([input, init]) =>
      String(input).includes("/api/ai/drafts/generate") && init?.method === "POST"
    );
    const generateBody = JSON.parse(String(generateCall?.[1]?.body)) as Record<string, unknown>;
    expect(generateBody).toMatchObject({
      message_id: message.id,
      tone: "friendly",
      brand_rules: "Обращаться на Вы",
      knowledge_base: null,
    });

    const manualCall = fetchMock.mock.calls.find(([input, init]) =>
      String(input).endsWith("/api/replies/manual") && init?.method === "POST"
    );
    const manualBody = JSON.parse(String(manualCall?.[1]?.body)) as Record<string, unknown>;
    expect(manualBody).toMatchObject({
      message_id: message.id,
      ai_draft_id: draft.id,
      reply_text: editedReply,
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) => String(input).includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST",
        ),
      ).toBe(true);
    });
  });

  it("keeps loaded appeals visible when a manual refresh fails", async () => {
    mockWorkspace("manager");
    let messageRequests = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        messageRequests += 1;
        if (messageRequests === 1) {
          return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: "upstream_timeout" }), { status: 503 });
      }
      if (url.includes("/api/ai/drafts")) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByRole("button", { name: /Термокружка/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Обновить обращения" }));

    const refreshError = await screen.findByRole("alert");
    expect(refreshError).toHaveTextContent("Не удалось обновить обращения");
    expect(refreshError).toHaveTextContent("Показываем ранее загруженные обращения");
    expect(refreshError).not.toHaveTextContent("upstream_timeout");
    expect(screen.getByRole("button", { name: /Термокружка/ })).toBeInTheDocument();
  });

  it("retries review handoff without creating a second reply", async () => {
    mockWorkspace("manager");
    let submitAttempts = 0;
    let manualCreates = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }), { status: 200 });
      }
      if (url.includes("/api/ai/drafts")) {
        return new Response(JSON.stringify({ items: [draft], total: 1 }), { status: 200 });
      }
      if (url.endsWith("/api/replies/manual") && init?.method === "POST") {
        manualCreates += 1;
        return new Response(JSON.stringify({ reply, safety }), { status: 201 });
      }
      if (url.includes(`/api/replies/${reply.id}/submit-review`) && init?.method === "POST") {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          return new Response(JSON.stringify({ detail: "queue_worker_timeout" }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            reply: { ...reply, status: "waiting_review", submitted_for_review_at: timestamp },
            safety,
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    expect(await screen.findByLabelText("Ответ для проверки")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));

    const handoffError = await screen.findByRole("alert");
    expect(handoffError).toHaveTextContent("Ответ сохранён, но пока не передан на проверку");
    expect(handoffError).not.toHaveTextContent("queue_worker_timeout");

    fireEvent.click(screen.getByRole("button", { name: "Попробовать ещё раз" }));

    expect(await screen.findByText("Ответ передан на проверку")).toBeInTheDocument();
    expect(manualCreates).toBe(1);
    expect(submitAttempts).toBe(2);
  });

  it("keeps viewer membership read-only while preserving draft history visibility", async () => {
    mockWorkspace("viewer");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/api/messages")) {
          return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }), { status: 200 });
        }
        if (url.includes("/api/ai/drafts")) {
          return new Response(JSON.stringify({ items: [draft], total: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
      }),
    );

    renderWorkspace();

    const editor = await screen.findByLabelText("Ответ для проверки");
    expect(editor).toHaveValue(draft.draft_text);
    expect(editor).toBeDisabled();
    expect(screen.getByText(/С вашим уровнем доступа можно просматривать готовые варианты, но нельзя создавать новые/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Подготовить черновик" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Передать на проверку" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Подготовить другой вариант" })).not.toBeInTheDocument();
  });

  it("labels marketplace chats as buyer messages", async () => {
    mockWorkspace("manager");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = String(input);
        if (url.includes("/api/messages")) {
          return new Response(JSON.stringify({ items: [chatMessage], total: 1, page: 1, page_size: 50 }), { status: 200 });
        }
        if (url.includes("/api/ai/drafts")) {
          return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
      }),
    );

    renderWorkspace();

    expect(await screen.findAllByText("Сообщение")).toHaveLength(2);
    expect(screen.queryByText("chat")).not.toBeInTheDocument();
  });
});
