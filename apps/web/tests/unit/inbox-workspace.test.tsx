import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { InboxWorkspace } from "../../components/inbox/InboxWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const timestamp = "2026-09-24T06:00:00Z";
const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Seller Group",
  slug: "seller-group",
  owner_user_id: "22222222-2222-4222-8222-222222222222",
  plan_id: null,
  default_response_mode: "auto",
  status: "active",
  current_user_role: "owner" as const,
  created_at: timestamp,
  updated_at: timestamp,
};

afterEach(() => vi.unstubAllGlobals());

it("distinguishes accepted Avito and Wildberries answers from confirmed publication", async () => {
  vi.mocked(useWorkspace).mockReturnValue({
    user: {
      id: organization.owner_user_id,
      email: "owner@example.test",
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
  const message = {
    id: "33333333-3333-4333-8333-333333333333",
    organization_id: organization.id,
    marketplace_account_id: "44444444-4444-4444-8444-444444444444",
    product_id: null,
    marketplace: "avito",
    external_id: "92312343",
    type: "review",
    status: "answered",
    rating: 5,
    customer_display_name: null,
    customer_text: "",
    customer_photos_json: [],
    marketplace_created_at: timestamp,
    imported_at: timestamp,
    last_synced_at: timestamp,
    assigned_to: null,
    priority: "normal",
    metadata_json: { provider_publication: "unverified" },
    product: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const chat = {
    ...message,
    id: "55555555-5555-4555-8555-555555555555",
    external_id: "chat-message-1",
    type: "chat",
    status: "needs_reply",
    customer_text: "Здравствуйте",
    metadata_json: {},
  };
  const question = {
    ...message,
    id: "66666666-6666-4666-8666-666666666666",
    marketplace: "wildberries",
    external_id: "question-1",
    type: "question",
    customer_text: "Когда поступит товар?",
  };
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ items: [message, chat, question], total: 3, page: 1, page_size: 100 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(<QueryClientProvider client={queryClient}><InboxWorkspace /></QueryClientProvider>);

  expect(await screen.findByText(/Публикация не подтверждена/)).toBeInTheDocument();
  expect(screen.getAllByText("Принято API")).toHaveLength(3);
  expect(screen.queryByText("Отвечено")).not.toBeInTheDocument();
  expect(screen.getAllByText(/Текст отзыва не передан Авито/)).toHaveLength(2);
  expect(screen.getByText("Чат")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Wildberries/ }));
  expect(screen.getByText("Ответ принят API Wildberries. Публикация не подтверждена.")).toBeInTheDocument();
  expect(screen.getAllByText("Принято API")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Чаты" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("type=chat"))).toBe(true));
});

it("shows documented Wildberries review evidence without inventing customer text", async () => {
  vi.mocked(useWorkspace).mockReturnValue({
    user: {
      id: organization.owner_user_id,
      email: "owner@example.test",
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
  const message = {
    id: "33333333-3333-4333-8333-333333333333",
    organization_id: organization.id,
    marketplace_account_id: "44444444-4444-4444-8444-444444444444",
    product_id: null,
    marketplace: "wildberries",
    external_id: "feedback-video-1",
    type: "review",
    status: "needs_reply",
    rating: 2,
    customer_display_name: null,
    customer_text: "",
    customer_photos_json: ["https://feedback04.wbbasket.ru/review/photo.webp"],
    marketplace_created_at: timestamp,
    imported_at: timestamp,
    last_synced_at: timestamp,
    assigned_to: null,
    priority: "normal",
    metadata_json: {
      review_video_url: "https://videofeedback01.wbbasket.ru/review/index.m3u8",
      review_deficiencies: ["цена"],
    },
    product: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const other = {
    ...message,
    id: "55555555-5555-4555-8555-555555555555",
    marketplace: "ozon",
    external_id: "review-no-text",
    customer_photos_json: [],
    metadata_json: {},
  };
  const chat = { ...other, id: "66666666-6666-4666-8666-666666666666", marketplace: "avito", external_id: "chat-no-text", type: "chat" };
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ items: [message, other, chat], total: 3, page: 1, page_size: 100 }), { status: 200 })));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(<QueryClientProvider client={queryClient}><InboxWorkspace /></QueryClientProvider>);

  expect(await screen.findByText("Текст отзыва не передан Wildberries.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Видео отзыва" })).toHaveAttribute("href", "https://videofeedback01.wbbasket.ru/review/index.m3u8");
  expect(screen.getByRole("link", { name: "Фото 1" })).toHaveAttribute("href", "https://feedback04.wbbasket.ru/review/photo.webp");
  expect(screen.getByText("цена")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Ozon/ }));
  expect(screen.getByText("Текст отзыва не передан маркетплейсом.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Авито/ }));
  expect(screen.getByText("Текст обращения не передан маркетплейсом.")).toBeInTheDocument();
});
