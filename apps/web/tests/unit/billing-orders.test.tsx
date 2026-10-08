import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BillingOrders } from "../../components/billing/BillingOrders";
vi.mock("../../components/workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ locale: "ru", activeOrganization: { id: "33333333-3333-4333-8333-333333333333" } }) }));
afterEach(() => vi.unstubAllGlobals());
it("shows the verified order state without exposing provider errors or declaring a pending order paid", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "44444444-4444-4444-8444-444444444444", organization_id: "33333333-3333-4333-8333-333333333333", kind: "plan", amount_minor: 129000, currency: "RUB", state: "pending", payment_url: "https://app.lava.top/pay", monthly_credits: 300, addon_credits: 0, created_at: "2026-10-01T12:00:00Z", paid_at: null, last_error: "internal-secret-response" }]))));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BillingOrders /></QueryClientProvider>);
  expect(await screen.findByText("Ожидает оплаты")).toBeVisible();
  expect(screen.queryByText("Оплачен")).not.toBeInTheDocument();
  expect(screen.queryByText("internal-secret-response")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Продолжить оплату" })).toHaveAttribute("href", "https://app.lava.top/pay");
});
