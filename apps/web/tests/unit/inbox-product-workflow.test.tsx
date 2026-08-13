import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { InboxWorkspace } from "../../components/inbox/InboxWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/inbox",
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("type=chat&status=needs_reply"),
}));
vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it("restores chat filters from URL and synchronizes changes", async () => {
  vi.mocked(useWorkspace).mockReturnValue({
    user: { id: "22222222-2222-4222-8222-222222222222", email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" },
    organizations: [],
    activeOrganization: { id: "11111111-1111-4111-8111-111111111111", name: "Seller Group", slug: "seller-group", owner_user_id: null, plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner", created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" },
    setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false,
  });
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 100 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InboxWorkspace /></QueryClientProvider>);

  expect(screen.getByRole("button", { name: "Чаты" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("type=chat"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Отзывы" }));
  expect(replace).toHaveBeenCalledWith(expect.stringContaining("type=review"), { scroll: false });
});
