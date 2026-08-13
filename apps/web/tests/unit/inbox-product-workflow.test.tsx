import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { InboxWorkspace } from "../../components/inbox/InboxWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it("restores chat filters from URL and synchronizes changes", async () => {
  const accountId = "33333333-3333-4333-8333-333333333333";
  window.history.replaceState(null, "", `/app/inbox?type=chat&status=needs_reply&marketplace_account_id=${accountId}&search=${encodeURIComponent("доставка")}`);
  vi.mocked(useWorkspace).mockReturnValue({
    user: { id: "22222222-2222-4222-8222-222222222222", email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" },
    organizations: [],
    activeOrganization: { id: "11111111-1111-4111-8111-111111111111", name: "Seller Group", slug: "seller-group", owner_user_id: null, plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner", created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" },
    setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false,
  });
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    if (String(input).includes("/api/marketplace-accounts")) {
      return new Response(JSON.stringify([{
        id: accountId,
        organization_id: "11111111-1111-4111-8111-111111111111",
        marketplace: "wildberries",
        display_name: "WB основной",
        seller_id: null,
        status: "active",
        credentials_masked: "sha256:ab12…90ef",
        credentials_status: "valid",
        scopes_json: { validated: true },
        default_response_mode: "inherit",
        ai_instruction_set_id: null,
        last_success_sync_at: null,
        last_error_sync_at: null,
        error_count: 0,
        created_at: "2026-08-13T06:00:00Z",
        updated_at: "2026-08-13T06:00:00Z",
      }]), { status: 200 });
    }
    return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 100 }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InboxWorkspace /></QueryClientProvider>);

  expect(screen.getByRole("button", { name: "Чаты" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("searchbox", { name: "Поиск по обращениям" })).toHaveValue("доставка");
  await waitFor(() => expect(screen.getByLabelText("Кабинет маркетплейса")).toHaveValue(accountId));
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
    const url = String(input);
    return url.includes("type=chat") && url.includes("status=needs_reply") && url.includes(`marketplace_account_id=${accountId}`) && url.includes("search=");
  })).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Отзывы" }));
  expect(window.location.search).toContain("type=review");
  expect(window.location.search).toContain("status=needs_reply");
  expect(window.location.search).toContain(`marketplace_account_id=${accountId}`);
  expect(window.location.search).toContain("search=");
  expect(screen.getByRole("region", { name: "Список обращений" })).toBeInTheDocument();
});
