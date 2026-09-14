import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

const lowConfidenceDraft = {
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
  confidence_score: 0.6,
  safety_flags_json: [],
  created_by: organization.owner_user_id,
  created_at: timestamp,
  updated_at: timestamp,
};

const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderWorkspace() {
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
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/messages")) {
        return new Response(JSON.stringify({ items: [message], total: 1, page: 1, page_size: 50 }), { status: 200 });
      }
      if (url.includes("/api/ai/drafts")) {
        return new Response(JSON.stringify({ items: [lowConfidenceDraft], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "Unexpected request" }), { status: 500 });
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AIAssistantWorkspace />
    </QueryClientProvider>,
  );
}

describe("AIAssistantWorkspace low-confidence review state", () => {
  it("does not call a low-confidence draft successfully checked when there are no safety flags", async () => {
    renderWorkspace();

    expect(await screen.findByLabelText("Ответ для проверки")).toHaveValue(lowConfidenceDraft.draft_text);
    expect(screen.getByText("Уверенность 60%")).toBeInTheDocument();
    expect(screen.getByText("Нужна дополнительная проверка")).toBeInTheDocument();
    expect(screen.queryByText("Проверка пройдена")).not.toBeInTheDocument();
  });
});
