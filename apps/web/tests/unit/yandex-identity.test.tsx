import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YandexIdentityPanel } from "../../components/auth/YandexIdentityPanel";

const workspace = vi.hoisted(() => ({ user: { id: "22222222-2222-4222-8222-222222222222", status: "active" }, locale: "ru" as const }));
vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: () => workspace }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => { vi.unstubAllGlobals(); workspace.user.status = "active"; });

function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><YandexIdentityPanel /></QueryClientProvider>);
}

describe("explicit Yandex account linking", () => {
  it("shows linked state without another link mutation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ yandex_linked: true, can_link_yandex: false }))));
    show();
    expect(await screen.findByText("Яндекс подключён")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Связать Яндекс" })).not.toBeInTheDocument();
  });
  it("requires an explicit action before starting OAuth", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ yandex_linked: false, can_link_yandex: true })));
    vi.stubGlobal("fetch", fetch);
    show();
    expect(await screen.findByRole("button", { name: "Связать Яндекс" })).toBeEnabled();
    expect(fetch.mock.calls.every((call) => !String(call[0]).includes("/link/start"))).toBe(true);
  });
  it("does not offer demo account linking", async () => {
    workspace.user.status = "demo";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ yandex_linked: false, can_link_yandex: true }))));
    show();
    expect(await screen.findByText("В демо нельзя связывать аккаунты.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Связать Яндекс" })).not.toBeInTheDocument();
  });
});
