import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthEmailFlow } from "../../components/auth/AuthEmailFlow";
import EnglishForgotPasswordPage from "../../app/en/auth/forgot-password/page";
import EnglishResendVerificationPage from "../../app/en/auth/resend-verification/page";

const navigation = vi.hoisted(() => ({ query: "token=first" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));

const fetchMock = vi.fn();
function response(message: string) {
  return new Response(JSON.stringify({ message }));
}
function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function show(mode: "reset-password" | "verify-email") {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = () => <StrictMode><QueryClientProvider client={client}><AuthEmailFlow mode={mode} /></QueryClientProvider></StrictMode>;
  const result = render(view());
  return { changeToken(token: string) { navigation.query = `token=${token}`; result.rerender(view()); } };
}
function resetPassword() {
  fireEvent.change(screen.getByLabelText("Новый пароль", { selector: "input" }), { target: { value: "a-valid-test-password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Изменить пароль" }).closest("form")!);
}

describe("token-owned email actions", () => {
  beforeEach(() => { navigation.query = "token=first"; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it.each([200, 400])("verifies a replacement token once and ignores a late result for the previous token (HTTP %s)", async (status) => {
    const first = deferredResponse();
    const second = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const page = show("verify-email");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    page.changeToken("second");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => { second.resolve(response("Second email verified")); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Second email verified"));
    await act(async () => { first.resolve(new Response(JSON.stringify(status === 200 ? { message: "First email verified" } : { detail: "First link expired" }), { status })); });
    expect(screen.getByRole("status")).toHaveTextContent("Second email verified");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    page.changeToken("second");
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).token)).toEqual(["first", "second"]);
  });

  it("starts verification when an initially absent token becomes available", async () => {
    navigation.query = "";
    fetchMock.mockResolvedValue(response("Email verified"));
    const page = show("verify-email");
    expect(screen.getByRole("alert")).toHaveTextContent("некорректна");
    expect(fetchMock).not.toHaveBeenCalled();
    page.changeToken("second");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Email verified"));
  });

  it("clears a reset password and ignores the previous token's late success", async () => {
    const first = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise).mockResolvedValueOnce(response("Second password reset"));
    const page = show("reset-password");
    resetPassword();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    page.changeToken("second");
    expect(screen.getByLabelText("Новый пароль", { selector: "input" })).toHaveValue("");
    await act(async () => { first.resolve(response("First password reset")); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resetPassword();
    expect(await screen.findByRole("status")).toHaveTextContent("Second password reset");
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).token)).toEqual(["first", "second"]);
  });

  it.each([200, 400])("clears a completed reset result for a replacement token (HTTP %s)", async (status) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(status === 200 ? { message: "Password reset" } : { detail: "Link expired" }), { status }));
    const page = show("reset-password");
    resetPassword();
    await screen.findByRole(status === 200 ? "status" : "alert");
    page.changeToken("second");
    expect(screen.getByLabelText("Новый пароль", { selector: "input" })).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("English account recovery entry points", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { Page: EnglishForgotPasswordPage, title: "Recover your password", action: "Send reset link", endpoint: "/api/auth/forgot-password", success: "If an account exists, check its email for a password reset link." },
    { Page: EnglishResendVerificationPage, title: "Verify your email", action: "Resend verification email", endpoint: "/api/auth/resend-verification", success: "If this address needs verification, check your email for a new verification link." },
  ])("submits $endpoint from its localized route and returns to English login", async ({ Page, title, action, endpoint, success }) => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("Если аккаунт существует, мы отправили письмо.")));
    render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByRole("link", { name: "MPReply — home" })).toHaveAttribute("href", "/en");
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "seller@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: action }).closest("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent(success);
    expect(screen.getAllByRole("link", { name: "Back to login" }).every((link) => link.getAttribute("href") === "/en/auth/login")).toBe(true);
    expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).pathname).toBe(endpoint);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ email: "seller@example.com" });
  });

  it("keeps the English email form recoverable after rate limiting", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Слишком много запросов" }), { status: 429 })));
    render(<QueryClientProvider client={client}><EnglishForgotPasswordPage /></QueryClientProvider>);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "seller@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts. Wait a moment and try again.");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("seller@example.com");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
