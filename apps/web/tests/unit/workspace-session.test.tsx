import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceProvider } from "../../components/workspace/WorkspaceProvider";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/app/inbox",
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkspaceProvider>Workspace</WorkspaceProvider></QueryClientProvider>);
}

describe("workspace session recovery", () => {
  it.each(["service", "network"])("offers retry instead of redirecting when session refresh has a %s failure", async (failure) => {
    let recovered = false;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/auth/refresh")) {
        if (failure === "network") throw new TypeError("Connection unavailable");
        return new Response("{}", { status: 503 });
      }
      if (recovered && url.endsWith("/api/auth/me")) {
        return Response.json({
          id: "22222222-2222-4222-8222-222222222222", email: "owner@example.com", name: "Owner",
          status: "active", is_superadmin: false, created_at: "2026-10-24T00:00:00Z", updated_at: "2026-10-24T00:00:00Z",
        });
      }
      if (url.endsWith("/api/organizations")) return Response.json([]);
      return new Response("{}", { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    recovered = true;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Создайте рабочее пространство" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to login after the refresh endpoint confirms session expiry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    renderWorkspace();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/login?next=%2Fapp%2Finbox"));
    expect(screen.getByRole("heading", { name: "Нужно войти снова" })).toBeInTheDocument();
  });
});
