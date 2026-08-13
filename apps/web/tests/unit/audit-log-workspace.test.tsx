import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditLogWorkspace } from "../../components/audit/AuditLogWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const organization = { id: "11111111-1111-4111-8111-111111111111", name: "Seller Group", slug: "seller-group", owner_user_id: "22222222-2222-4222-8222-222222222222", plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner" as const, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" };
const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => vi.unstubAllGlobals());

function mockWorkspace(role: "owner" | "admin" | "manager" | "viewer") {
  const activeOrganization = { ...organization, current_user_role: role };
  mockedUseWorkspace.mockReturnValue({ user: { id: organization.owner_user_id, email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: organization.created_at, updated_at: organization.updated_at }, organizations: [activeOrganization], activeOrganization, setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false });
}

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuditLogWorkspace /></QueryClientProvider>);
}

describe("AuditLogWorkspace", () => {
  it("translates actions, suppresses sensitive metadata and loads the next cursor", async () => {
    mockWorkspace("admin");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const next = String(input).includes("cursor=next-page");
      return new Response(JSON.stringify({ items: [{ id: next ? "55555555-5555-4555-8555-555555555555" : "33333333-3333-4333-8333-333333333333", organization_id: organization.id, actor_user_id: organization.owner_user_id, action: next ? "unknown.event" : "organization.member.role_updated", entity_type: "organization_user", entity_id: "44444444-4444-4444-8444-444444444444", ip_address: null, user_agent: null, metadata: { role: "manager", access_token: "never-render", password_hint: "never-render" }, created_at: organization.created_at }], next_cursor: next ? null : "next-page", has_more: !next, limit: 50 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    expect(await screen.findByText("Изменена роль сотрудника")).toBeInTheDocument();
    expect(screen.queryByText("never-render")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await waitFor(() => expect(screen.getByText("Другое действие")).toBeInTheDocument());
  });

  it("does not request audit data without owner or admin role", () => {
    mockWorkspace("viewer");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Журнал доступен владельцу и администратору" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
