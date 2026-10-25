import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "../../components/auth/AuthForm";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const navigation = vi.hoisted(() => ({ query: "intent=connect-marketplace" }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const fetchMock = vi.fn();

function submit(mode: "login" | "register", locale: "ru" | "en" = "ru") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><AuthForm mode={mode} locale={locale} /></QueryClientProvider>);
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "seller@example.com" } });
  fireEvent.change(document.querySelector('input[name="password"]')!, { target: { value: "a-valid-test-password" } });
  fireEvent.submit(document.querySelector("form")!);
}

describe("AuthForm registration response contract", () => {
  beforeEach(() => {
    navigation.query = "intent=connect-marketplace";
    router.replace.mockReset();
    router.refresh.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith("/api/auth/providers")
      ? Promise.resolve(new Response(JSON.stringify({ yandex: false }))) : fetchMock(input, init));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["ru", "en"] as const)("makes password recovery and verification reachable from %s login", (locale) => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><AuthForm mode="login" locale={locale} /></QueryClientProvider>);
    const prefix = locale === "en" ? "/en" : "";
    expect(screen.getByRole("link", { name: locale === "ru" ? "Забыли пароль?" : "Forgot password?" })).toHaveAttribute("href", `${prefix}/auth/forgot-password`);
    expect(screen.getByRole("link", { name: locale === "ru" ? "Отправить письмо подтверждения ещё раз" : "Resend verification email" })).toHaveAttribute("href", `${prefix}/auth/resend-verification`);
  });

  it.each(["ru", "en"] as const)("accepts the real HTTP 202 message response in %s without entering the workspace", async (locale) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Если адрес доступен для регистрации, мы отправили письмо для подтверждения email." }), { status: 202 }));
    submit("register", locale);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(locale === "ru" ? "подтверждения email" : "verify your email"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector('input[name="password"]')).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/register$/);
  });

  it("still validates the login session and enters the requested marketplace flow", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ user: {
      id: "22222222-2222-4222-8222-222222222222", email: "seller@example.com", name: null,
      status: "active", is_superadmin: false, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
    } }), { status: 200 }));
    submit("login");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/app/integrations"));
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("rejects a malformed registration response instead of showing success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 202 }));
    submit("register");
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("completes pending Yandex linking after password login before entering the workspace", async () => {
    navigation.query = "oauth_error=account_link_required&next=%2Fapp%2Fdashboard";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user: {
      id: "22222222-2222-4222-8222-222222222222", email: "seller@example.com", name: null,
      status: "active", is_superadmin: false, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
    } }))).mockResolvedValueOnce(new Response(JSON.stringify({ message: "Yandex linked" })));
    submit("login");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/app/dashboard"));
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
      "/api/auth/login", "/api/auth/yandex/link/complete",
    ]);
  });
  it("preserves password login if the pending Yandex link expired", async () => {
    navigation.query = "oauth_error=account_link_required&next=%2Fapp%2Fdashboard";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ user: {
      id: "22222222-2222-4222-8222-222222222222", email: "seller@example.com", name: null,
      status: "active", is_superadmin: false, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
    } }))).mockResolvedValueOnce(new Response(JSON.stringify({ detail: "oauth_expired" }), { status: 409 }));
    submit("login");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/app/account?oauth_error=link_retry_required"));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
      "/api/auth/login", "/api/auth/yandex/link/complete",
    ]);
  });
});
