import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewQueueWorkspace } from "../../components/review-queue/ReviewQueueWorkspace";
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

const reviewItem = {
  reply: {
    id: "55555555-5555-4555-8555-555555555555",
    organization_id: organization.id,
    message_id: "33333333-3333-4333-8333-333333333333",
    ai_draft_id: null,
    automation_rule_id: null,
    reply_text: "Здравствуйте! Отправим заказ сегодня после подтверждения комплектации.",
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
  },
  message: {
    id: "33333333-3333-4333-8333-333333333333",
    organization_id: organization.id,
    marketplace_account_id: "44444444-4444-4444-8444-444444444444",
    product_id: null,
    marketplace: "avito",
    external_id: "avito-chat-1",
    type: "chat",
    status: "waiting_review",
    rating: null,
    customer_display_name: "Алексей",
    customer_text: "Здравствуйте, когда сможете отправить заказ?",
    customer_photos_json: [],
    marketplace_created_at: timestamp,
    imported_at: timestamp,
    last_synced_at: timestamp,
    assigned_to: null,
    priority: "normal",
    metadata_json: {},
    product: null,
    created_at: timestamp,
    updated_at: timestamp,
  },
  safety: {
    decision: "manual_review",
    flags: ["missing_product_context"],
    reasons: ["Для ответа требуется подтверждение срока отправки."],
  },
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
    logout: vi.fn(async () => undefined),
    isLoggingOut: false,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ items: [reviewItem], total: 1, page: 1, page_size: 100 }), { status: 200 })),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewQueueWorkspace />
    </QueryClientProvider>,
  );
}

describe("ReviewQueueWorkspace", () => {
  it("labels marketplace chats as buyer messages", async () => {
    renderWorkspace();

    expect(await screen.findByText(/Сообщение\s*·\s*без оценки/)).toBeInTheDocument();
    expect(screen.getByText(/Сообщение покупателя/)).toBeInTheDocument();
    expect(screen.queryByText("chat")).not.toBeInTheDocument();
    expect(screen.getByText("Для ответа требуется подтверждение срока отправки.")).toBeInTheDocument();
  });
});