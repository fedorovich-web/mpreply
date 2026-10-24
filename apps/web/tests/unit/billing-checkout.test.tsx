import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingCheckout } from "../../components/billing/BillingCheckout";

const workspace = vi.hoisted(() => ({ user: { id: "22222222-2222-4222-8222-222222222222", status: "active" },
  activeOrganization: { id: "33333333-3333-4333-8333-333333333333", current_user_role: "owner" }, locale: "ru" as const }));
vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: () => workspace }));
const catalog = { enabled: true, can_purchase: true, currency: "RUB", plans: [{ code: "start", amount_month_minor: 129000, amount_year_minor: 1238400, monthly_credits: 300 }], packs: [{ quantity: 50, amount_minor: 29900 }] };
const order = { id: "44444444-4444-4444-8444-444444444444", organization_id: workspace.activeOrganization.id, kind: "plan", amount_minor: 129000, currency: "RUB",
  state: "review_required", payment_url: null, monthly_credits: 300, addon_credits: 0, created_at: "2026-10-01T12:00:00Z", paid_at: null, last_error: "lava_unavailable" };
function show() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><BillingCheckout /></QueryClientProvider>); }
beforeEach(() => { localStorage.clear(); workspace.user.status = "active"; workspace.activeOrganization.current_user_role = "owner"; });
afterEach(() => vi.unstubAllGlobals());

describe("manual Lava purchases", () => {
  it("retains its locked key after a rejection without explicit server proof", async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) => Promise.resolve(init?.method === "POST"
      ? new Response(JSON.stringify({ detail: "Upstream unavailable" }), { status: 502 })
      : new Response(JSON.stringify(catalog))));
    vi.stubGlobal("fetch", fetch);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Подготовить оплату" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Покупка" })).toBeDisabled();
    expect(localStorage.getItem(`mpreply.billing.purchase.${workspace.user.id}.${workspace.activeOrganization.id}`)).toContain("key");
  });
  it("unlocks a definitively rejected purchase without retaining a key", async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) => Promise.resolve(init?.method === "POST"
      ? new Response(JSON.stringify({ detail: "Purchase exceeds supported amount" }), { status: 400, headers: { "X-Billing-Order-Not-Created": "1" } })
      : new Response(JSON.stringify(catalog))));
    vi.stubGlobal("fetch", fetch);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Подготовить оплату" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Покупка" })).toBeEnabled();
    expect(localStorage.getItem(`mpreply.billing.purchase.${workspace.user.id}.${workspace.activeOrganization.id}`)).toBeNull();
  });
  it("does not offer disabled payments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...catalog, enabled: false, can_purchase: false }))));
    show();
    expect(await screen.findByText("Оплата пока недоступна.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Подготовить оплату" })).not.toBeInTheDocument();
  });
  it.each(["viewer", "manager"])("does not expose purchase to %s", async (role) => {
    workspace.activeOrganization.current_user_role = role;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...catalog, can_purchase: false }))));
    show();
    expect(await screen.findByText("Оплачивать тариф может владелец или администратор.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Подготовить оплату" })).not.toBeInTheDocument();
  });
  it("sends a server-priced purchase and retains ambiguous order instead of retrying", async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(url.endsWith("/orders") && init?.method === "POST" ? order : url.includes("/orders/") ? order : catalog))));
    vi.stubGlobal("fetch", fetch);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Подготовить оплату" }));
    expect(await screen.findByText("Проверяем создание платежа. Повторная оплата пока недоступна.")).toBeVisible();
    const posts = fetch.mock.calls.filter((call) => call[1]?.method === "POST");
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0][1]!.body as string);
    expect(body).toMatchObject({ organization_id: workspace.activeOrganization.id, kind: "plan", plan_code: "start", months: 1 });
    expect(body.idempotency_key).toMatch(/^[\da-f-]{36}$/);
    expect(body.amount_minor).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Подготовить оплату" })).not.toBeInTheDocument();
    expect(localStorage.getItem(`mpreply.billing.purchase.${workspace.user.id}.${workspace.activeOrganization.id}`)).toContain(body.idempotency_key);
  });
});
