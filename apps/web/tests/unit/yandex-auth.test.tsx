import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { YandexAuthButton } from "../../components/auth/YandexAuthButton";

function show(locale: "ru" | "en" = "ru") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><YandexAuthButton locale={locale} next="/en/app/billing" intent="connect-marketplace" /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("Yandex registration action", () => {
  it("does not advertise a disabled provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ yandex: false }))));
    show();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("preserves locale, next and marketplace intent in a server authorization URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ yandex: true }))));
    show("en");
    const action = await screen.findByRole("link", { name: "Continue with Yandex" });
    const url = new URL(action.getAttribute("href")!);
    expect(url.pathname).toBe("/api/auth/yandex/start");
    expect(url.searchParams.get("locale")).toBe("en");
    expect(url.searchParams.get("next")).toBe("/en/app/billing");
    expect(url.searchParams.get("intent")).toBe("connect-marketplace");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});
