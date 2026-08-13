import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsWorkspace } from "../../components/settings/SettingsWorkspace";
import { useWorkspace } from "../../components/workspace/WorkspaceProvider";

vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: vi.fn() }));

const organization = { id: "11111111-1111-4111-8111-111111111111", name: "Seller Group", slug: "seller-group", owner_user_id: "22222222-2222-4222-8222-222222222222", plan_id: null, default_response_mode: "auto", status: "active", current_user_role: "owner" as const, created_at: "2026-08-13T06:00:00Z", updated_at: "2026-08-13T06:00:00Z" };
const mockedUseWorkspace = vi.mocked(useWorkspace);

afterEach(() => vi.unstubAllGlobals());

function renderWorkspace(role: "owner" | "admin" | "manager" | "viewer", fetchMock: typeof fetch) {
  const activeOrganization = { ...organization, current_user_role: role };
  mockedUseWorkspace.mockReturnValue({ user: { id: organization.owner_user_id, email: "owner@example.com", name: "Owner", status: "active", is_superadmin: false, created_at: organization.created_at, updated_at: organization.updated_at }, organizations: [activeOrganization], activeOrganization, setActiveOrganizationId: vi.fn(), logout: vi.fn(async () => undefined), isLoggingOut: false });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><SettingsWorkspace /></QueryClientProvider>);
}

describe("SettingsWorkspace", () => {
  it("saves organization name and default response mode", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...organization, ...body }), { status: 200 });
      }
      return new Response(JSON.stringify(organization), { status: 200 });
    });
    renderWorkspace("owner", fetchMock);

    const name = await screen.findByLabelText("Название организации");
    expect(screen.queryByRole("link", { name: /Наборы AI|База знаний|Правила/ })).not.toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Seller Operations" } });
    fireEvent.change(screen.getByLabelText("Режим ответов по умолчанию"), { target: { value: "semi_auto" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  });

  it("renders settings read-only for viewer", async () => {
    renderWorkspace("viewer", vi.fn(async () => new Response(JSON.stringify({ ...organization, current_user_role: "viewer" }), { status: 200 })));

    expect(await screen.findByLabelText("Название организации")).toBeDisabled();
    expect(screen.getAllByText(/Только просмотр/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Сохранить настройки" })).not.toBeInTheDocument();
  });
});
