import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    brand: "Respio Test",
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
    fireEvent.change(within(form).getByLabelText("Правила бренда"), { target: { value: "Обращаться на Вы" } });
    fireEvent.click(within(form).getByRole("button", { name: "Подготовить черновик" }));

    const editor = await screen.findByLabelText("Ответ для проверки");
    expect(editor).toHaveValue(draft.draft_text);
    expect(screen.getByText("Проверка пройдена")).toBeInTheDocument();
    expect(screen.queryByText("groq")).not.toBeInTheDocument();
    expect(screen.queryByText("qwen/qwen3.8-27b")).not.toBeInTheDocument();

    fireEvent.change(editor, { target: { value: editedReply } });
    fireEvent.click(screen.getByRole("button", { name: "Передать на проверку" }));

    expect(await screen.findByText("Ответ передан на проверку")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть модерацию" })).toHaveAttribute("href", "/app/review-queue");

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
    expect(screen.getByText(/может просматривать историю, но не создавать новые черновики/)).toBeInTheDocument();
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
