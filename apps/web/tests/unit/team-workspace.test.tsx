import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamWorkspace } from "../../components/team/TeamWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const organization = { id: "11111111-1111-4111-8111-111111111111", name: "Seller Group", slug: "seller-group", owner_user_id: "22222222-2222-4222-8222-222222222222", plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner" as const, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" };
const member = { membership_id: "33333333-3333-4333-8333-333333333333", user_id: organization.owner_user_id, email: "owner@example.com", name: "Owner", role: "owner", status: "active", created_at: organization.created_at, updated_at: organization.updated_at };
const invitation = { id: "44444444-4444-4444-8444-444444444444", organization_id: organization.id, email: "manager@example.com", role: "manager", status: "pending", expires_at: "2026-08-20T06:00:00Z", invited_by_user_id: organization.owner_user_id, accepted_by_user_id: null, accepted_at: null, revoked_at: null, created_at: organization.created_at, updated_at: organization.updated_at };
const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => vi.unstubAllGlobals());

function mockWorkspace(role: "owner" | "admin" | "manager" | "viewer") {
  const activeOrganization = { ...organization, current_user_role: role };
  mockedUseWorkspace.mockReturnValue({ user: { id: organization.owner_user_id, email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: organization.created_at, updated_at: organization.updated_at }, organizations: [activeOrganization], activeOrganization, setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false });
}

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><TeamWorkspace /></QueryClientProvider>);
}

describe("TeamWorkspace", () => {
  it("loads members and invitations and submits one invitation once", async () => {
    mockWorkspace("owner");
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === "POST") return new Response(JSON.stringify({ ...invitation, accept_token: "a".repeat(48) }), { status: 201 });
      return new Response(JSON.stringify(url.endsWith("/members") ? [member] : [invitation]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Сотрудники" })).toBeInTheDocument();
    expect(screen.getByText("manager@example.com")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email сотрудника"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить приглашение" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Удалить Owner" })).not.toBeInTheDocument();
  });

  it("does not request protected team data for manager and explains access", () => {
    mockWorkspace("manager");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Список сотрудников недоступен" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
